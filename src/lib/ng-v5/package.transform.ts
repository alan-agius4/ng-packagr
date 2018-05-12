import * as chokidar from 'chokidar';
import * as path from 'path';
import { Observable, concat as concatStatic, from as fromPromise, of as observableOf, pipe, combineLatest } from 'rxjs';
import { concatMap, map, retry, switchMap, takeLast, tap, mapTo } from 'rxjs/operators';
import { BuildGraph } from '../brocc/build-graph';
import { DepthBuilder, Groups } from '../brocc/depth';
import { Node, STATE_IN_PROGESS } from '../brocc/node';
import { Transform } from '../brocc/transform';
import * as log from '../util/log';
import { copyFiles } from '../util/copy';
import { rimraf } from '../util/rimraf';
import { PackageNode, EntryPointNode, ngUrl, isEntryPoint, byEntryPoint } from './nodes';
import { discoverPackages } from './discover-packages';

/**
 * A transformation for building an npm package:
 *
 *  - discoverPackages
 *  - initTsConfig
 *  - analyzeTsSources (thereby extracting template and stylesheet files)
 *  - for each entry point
 *    - run the entryPontTransform
 *  - writeNpmPackage
 *
 * @param project Project token, reference to `ng-package.json`
 * @param initTsConfigTransform Transformation initializing the tsconfig of each entry point.
 * @param analyseSourcesTransform Transformation analyzing the typescript source files of each entry point.
 * @param entryPointTransform Transformation for asset rendering and compilation of a single entry point.
 */
export const packageTransformFactory = (
  project: string,
  initTsConfigTransform: Transform,
  analyseSourcesTransform: Transform,
  entryPointTransform: Transform
) => (source$: Observable<BuildGraph>): Observable<BuildGraph> => {
  const pkgUri = ngUrl(project);

  const build$ = source$.pipe(
    tap(() => {
      log.info(`Building Angular Package`);
    }),
    // Discover packages and entry points
    switchMap(graph => {
      const pkg = discoverPackages({ project });

      return fromPromise(pkg).pipe(
        map(value => {
          const ngPkg = new PackageNode(pkgUri);
          ngPkg.data = value;

          return graph.put(ngPkg);
        })
      );
    }),
    // Clean the primary dest folder (should clean all secondary sub-directory, as well)
    switchMap(graph => {
      const { dest, deleteDestPath } = graph.get(pkgUri).data;
      return fromPromise(deleteDestPath ? rimraf(dest) : Promise.resolve());
    }, (graph, _) => graph),
    // Add entry points to graph
    map(graph => {
      const ngPkg = graph.get(pkgUri);
      const entryPoints = [ngPkg.data.primary, ...ngPkg.data.secondaries].map(entryPoint => {
        const { destinationFiles, moduleId } = entryPoint;
        const node = new EntryPointNode(ngUrl(moduleId));
        node.data = { entryPoint, destinationFiles };
        node.state = 'dirty';
        ngPkg.dependsOn(node);

        return node;
      });

      return graph.put(entryPoints);
    }),
    // Initialize the tsconfig for each entry point
    initTsConfigTransform,
    // Analyse dependencies and external resources for each entry point
    analyseSourcesTransform,
    // Next, run through the entry point transformation (assets rendering, code compilation)
    scheduleEntryPoints(entryPointTransform),
    // Write npm package to dest folder
    writeNpmPackage(pkgUri),
    tap(graph => {
      const ngPkg = graph.get(pkgUri);
      log.success(`Built Angular Package!
- from: ${ngPkg.data.src}
- to:   ${ngPkg.data.dest}`);
    })
  );

  const watch$ = createWatcher(project);
  const x = combineLatest(build$, watch$).pipe(
    tap(([graph, fileWatched]) => {
      console.log('file changed');
      const ngPkg = graph.get(pkgUri);
      if (ngPkg) {
        const file = path.resolve(fileWatched.replace(/\\/g, '/'));
        ngPkg.data.watchFileCache.delete(file);
      }
    }),
    map(([graph, fileWatched]) => {
      return graph;
    }),
    map(graph => {
      const entryPoints = graph.filter(isEntryPoint);
      entryPoints.forEach(x => (x.state = 'dirty'));
      return graph;
    }),
    analyseSourcesTransform,
    scheduleEntryPoints(entryPointTransform)
  );

  return x || build$;
};

const writeNpmPackage = (pkgUri: string): Transform =>
  pipe(
    switchMap(graph => {
      const ngPkg = graph.get(pkgUri);

      return fromPromise(copyFiles([`${ngPkg.data.src}/LICENSE`, `${ngPkg.data.src}/README.md`], ngPkg.data.dest)).pipe(
        map(() => graph)
      );
    })
  );

const scheduleEntryPoints = (epTransform: Transform): Transform =>
  pipe(
    concatMap(graph => {
      // Calculate node/dependency depth and determine build order
      const depthBuilder = new DepthBuilder();
      const entryPoints = graph.filter(isEntryPoint);
      entryPoints.forEach(entryPoint => {
        const deps = entryPoint.filter(isEntryPoint).map(ep => ep.url);
        depthBuilder.add(entryPoint.url, deps);
      });

      // The array index is the depth.
      const groups = depthBuilder.build();
      const flattenedGroups = groups.reduce((prev, current) => prev.concat(current), []);
      let currentIndex = 0;

      // Build entry points with lower depth values first.
      const eps$ = flattenedGroups.map(() =>
        observableOf(graph).pipe(
          tap(() => {
            // Find current entry point in progress
            const epUrl = flattenedGroups[currentIndex];
            const entryPoint = graph.find(byEntryPoint().and(ep => ep.url === epUrl));

            // Mark the entry point as 'in-progress'
            entryPoint.state = STATE_IN_PROGESS;
          }),
          epTransform,
          tap(() => {
            currentIndex += 1;
          })
        )
      );

      // Build all entry points, then continue
      return concatStatic(...eps$).pipe(takeLast(1));
    })
  );

const createWatcher = project => {
  const watcher = chokidar.watch(path.resolve(path.dirname(project)), {
    ignoreInitial: true,
    ignored: /((^[\/\\])\..)|(\.js$)|(\.map$)|(dist)|(\.metadata\.json)/,
    persistent: true,
    interval: 100,
    awaitWriteFinish: true
  });

  return Observable.create(observer => watcher.on('all', (event: string, filePath: string) => observer.next(filePath)));
};
