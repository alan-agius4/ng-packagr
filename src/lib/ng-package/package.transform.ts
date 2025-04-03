import { DepGraph } from 'dependency-graph';
import {
  EMPTY,
  NEVER,
  Observable,
  catchError,
  concatMap,
  debounceTime,
  defaultIfEmpty,
  filter,
  finalize,
  from,
  map,
  of as observableOf,
  of,
  pipe,
  repeat,
  startWith,
  switchMap,
  takeLast,
  tap,
} from 'rxjs';
import { createFileWatch } from '../file-system/file-watcher';
import { BuildGraph } from '../graph/build-graph';
import { Node, STATE_DIRTY, STATE_DONE, STATE_IN_PROGRESS, STATE_PENDING } from '../graph/node';
import { Transform } from '../graph/transform';
import { colors } from '../utils/color';
import { rmdir } from '../utils/fs';
import * as log from '../utils/log';
import { ensureUnixPath } from '../utils/path';
import { discoverPackages } from './discover-packages';
import {
  EntryPointNode,
  OutputFileCacheEntry,
  PackageNode,
  byEntryPoint,
  fileUrl,
  fileUrlPath,
  isEntryPoint,
  isEntryPointDirty,
  isEntryPointInProgress,
  isPackage,
  ngUrl,
} from './nodes';
import { NgPackagrOptions } from './options.di';

/**
 * A transformation for building an npm package:
 *
 *  - discoverPackages
 *  - options
 *  - initTsConfig
 *  - analyzeTsSources (thereby extracting template and stylesheet files)
 *  - for each entry point
 *    - run the entryPontTransform
 *
 * @param project Project token, reference to `ng-package.json`
 * @param options ng-packagr options
 * @param initTsConfigTransform Transformation initializing the tsconfig of each entry point.
 * @param analyseSourcesTransform Transformation analyzing the typescript source files of each entry point.
 * @param entryPointTransform Transformation for asset rendering and compilation of a single entry point.
 */
export const packageTransformFactory =
  (
    project: string,
    options: NgPackagrOptions,
    initTsConfigTransform: Transform,
    analyseSourcesTransform: Transform,
    entryPointTransform: Transform,
  ) =>
  (source$: Observable<BuildGraph>): Observable<BuildGraph> => {
    log.info(`Building Angular Package`);

    const buildTransform = options.watch
      ? watchTransformFactory(project, options, analyseSourcesTransform, entryPointTransform)
      : buildTransformFactory(project, analyseSourcesTransform, entryPointTransform);

    const pkgUri = ngUrl(project);
    const ngPkg = new PackageNode(pkgUri);

    return source$.pipe(
      // Discover packages and entry points
      // Clean the primary dest folder (should clean all secondary sub-directory, as well)
      switchMap(async graph => {
        ngPkg.data = await discoverPackages({ project });

        graph.put(ngPkg);
        const { dest, deleteDestPath } = ngPkg.data;

        if (deleteDestPath) {
          try {
            await rmdir(dest, { recursive: true });
          } catch {}
        }

        const entryPoints = [ngPkg.data.primary, ...ngPkg.data.secondaries].map(entryPoint => {
          const { destinationFiles, moduleId } = entryPoint;
          const node = new EntryPointNode(
            ngUrl(moduleId),
            ngPkg.cache.sourcesFileCache,
            ngPkg.cache.moduleResolutionCache,
          );
          node.data = { entryPoint, destinationFiles };
          node.state = STATE_DIRTY;
          ngPkg.dependsOn(node);

          return node;
        });

        // Add entry points to graph
        return graph.put(entryPoints);
      }),
      // Initialize the tsconfig for each entry point
      initTsConfigTransform,
      // perform build
      buildTransform,
      finalize(() => {
        for (const node of ngPkg.dependents) {
          if (node instanceof EntryPointNode) {
            node.cache.stylesheetProcessor?.destroy();
          }
        }
      }),
    );
  };

const watchTransformFactory =
  (project: string, options: NgPackagrOptions, analyseSourcesTransform: Transform, entryPointTransform: Transform) =>
  (source$: Observable<BuildGraph>): Observable<BuildGraph> => {
    const CompleteWaitingForFileChange = '\nCompilation complete. Watching for file changes...';
    const FileChangeDetected = '\nFile change detected. Starting incremental compilation...';
    const FailedWaitingForFileChange = '\nCompilation failed. Watching for file changes...';

    return source$.pipe(
      switchMap(graph => {
        const pkgNode = graph.find(isPackage);
        const { onFileChange, watcher } = createFileWatch([], [pkgNode.data.dest + '/'], options.poll);
        graph.watcher = watcher;

        return onFileChange.pipe(
          tap(filePath => invalidateEntryPointsOnFileChange(graph, pkgNode, [filePath.filePath])),
          debounceTime(200),
          tap(() => log.msg(FileChangeDetected)),
          startWith(undefined),
          switchMap(() => {
            return observableOf(graph).pipe(
              buildTransformFactory(project, analyseSourcesTransform, entryPointTransform),
              repeat({ delay: () => (graph.some(isEntryPointDirty()) ? of(1) : EMPTY) }),
              filter(graph => !graph.some(isEntryPointDirty())),
              tap(() => log.msg(CompleteWaitingForFileChange)),
              catchError(error => {
                const entryPoint = graph.find(isEntryPointInProgress());
                if (entryPoint) {
                  entryPoint.state = STATE_PENDING;
                }

                log.error(error);
                log.msg(FailedWaitingForFileChange);

                return NEVER;
              }),
            );
          }),
        );
      }),
    );
  };

const buildTransformFactory =
  (project: string, analyseSourcesTransform: Transform, entryPointTransform: Transform) =>
  (source$: Observable<BuildGraph>): Observable<BuildGraph> => {
    const startTime = Date.now();

    const pkgUri = ngUrl(project);

    return source$.pipe(
      // Analyse dependencies and external resources for each entry point
      analyseSourcesTransform,
      // Next, run through the entry point transformation (assets rendering, code compilation)
      scheduleEntryPoints(entryPointTransform),
      tap(graph => {
        const ngPkg = graph.get(pkgUri) as PackageNode;
        const updatedNodes: OutputFileCacheEntry[] = [];
        const updatedFiles = new Set<string>();
        for (const node of graph.entries()) {
          if (!isEntryPoint(node)) {
            continue;
          }

          if (node.state !== STATE_DONE) {
            continue;
          }

          for (const [filename, value] of node.cache.outputCache) {
            updatedNodes.push(value);
            if (value.updated && filename.endsWith('.d.ts') && !filename.endsWith('.map.d.ts')) {
              updatedFiles.add(filename);
            }
          }
        }

        for (const entry of updatedNodes) {
          entry.updated = false;
        }

        if (updatedFiles.size > 0 && invalidateEntryPointsOnFileChange(graph, ngPkg, updatedFiles)) {
          return;
        }

        log.success('\n------------------------------------------------------------------------------');
        log.success(`Built Angular Package
 - from: ${ngPkg.data.src}
 - to:   ${ngPkg.data.dest}`);
        log.success('------------------------------------------------------------------------------');
        const b = colors.bold;
        const w = colors.white;
        log.msg(w(`\nBuild at: ${b(new Date().toISOString())} - Time: ${b('' + (Date.now() - startTime))}ms\n`));
      }),
    );
  };

const scheduleEntryPoints = (epTransform: Transform): Transform =>
  pipe(
    concatMap(graph => {
      // Calculate node/dependency depth and determine build order
      const depGraph = new DepGraph({ circular: false });
      for (const node of graph.values()) {
        if (!isEntryPoint(node)) {
          continue;
        }

        // Remove `ng://` prefix for better error messages
        const from = node.url.substring(5);
        depGraph.addNode(from);

        for (const dep of node.dependents) {
          if (!isEntryPoint(dep)) {
            continue;
          }

          const to = dep.url.substring(5);
          depGraph.addNode(to);
          depGraph.addDependency(from, to);
        }
      }

      // The array index is the depth.
      const groups = depGraph.overallOrder().map(ngUrl);

      // Build entry points with lower depth values first.
      return from(groups).pipe(
        map((epUrl: string): EntryPointNode => graph.find(byEntryPoint().and(ep => ep.url === epUrl))),
        filter((entryPoint: EntryPointNode): boolean => entryPoint.state !== STATE_DONE),
        concatMap(ep =>
          observableOf(ep).pipe(
            // Mark the entry point as 'in-progress'
            tap(entryPoint => (entryPoint.state = STATE_IN_PROGRESS)),
            map(() => graph),
            epTransform,
          ),
        ),
        takeLast(1), // don't use last as sometimes it this will cause 'no elements in sequence',
        defaultIfEmpty(graph),
      );
    }),
  );

function invalidateEntryPointsOnFileChange(
  graph: BuildGraph,
  packageNode: PackageNode,
  filePaths: string[] | Set<string>,
): boolean {
  const { sourcesFileCache } = packageNode.cache;
  if (!sourcesFileCache) {
    return false;
  }

  const allNodesToClean = new Set<Node>();
  for (const filePath of filePaths) {
    const cachedSourceFile = sourcesFileCache.get(filePath);
    if (!cachedSourceFile) {
      continue;
    }

    const uriToClean = fileUrl(ensureUnixPath(filePath));
    const nodeToClean = graph.find(node => uriToClean === node.url);
    if (!nodeToClean) {
      continue;
    }

    // if a non ts file changes we need to clean up its direct dependees
    // this is mainly done for resources such as html and css
    if (!nodeToClean.url.endsWith('.ts')) {
      for (const dependee of nodeToClean.dependees) {
        allNodesToClean.add(dependee);
      }
    }

    allNodesToClean.add(nodeToClean);
  }

  if (!allNodesToClean.size) {
    return false;
  }


let hasDirtyEntryPoint = false;
  for (const node of graph.values()) {
    if (!isEntryPoint(node)) {
      continue;
    }

    for (const dependent of allNodesToClean.values()) {
      const uriToClean = fileUrlPath(dependent.url);
      sourcesFileCache.delete(uriToClean);
      const isDirty = node.dependents.has(dependent);

      if (isDirty) {
        node.state = STATE_DIRTY;
        hasDirtyEntryPoint = true;
        node.cache.analysesSourcesFileCache.delete(uriToClean);
      }
    }
  }

  return hasDirtyEntryPoint;
}
