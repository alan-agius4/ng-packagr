import * as ng from '@angular/compiler-cli';
import { pipe } from 'rxjs';
import { map } from 'rxjs/operators';
import * as log from '../../util/log';
import { Transform } from '../../brocc/transform';
import { isEntryPoint, isPackage, PackageNode, EntryPointNode } from '../nodes';
import { cacheCompilerHost } from '../../ts/cache-compiler-host';

export const analyseSourcesTransform: Transform = pipe(
  map(graph => {
    const entryPoints = graph.filter(isEntryPoint);
    const ngPkg = graph.find(isPackage) as PackageNode;
    const { moduleResolutionCache } = ngPkg;

    const analyseEntryPoint = (entryPoint: EntryPointNode) => {
      const { tsConfig } = entryPoint.data;

      let compilerHost = cacheCompilerHost(tsConfig.options, entryPoint.fileCache, moduleResolutionCache);
      const { moduleNameToFileName } = compilerHost;

      compilerHost = {
        ...compilerHost,

        moduleNameToFileName: (moduleName: string, containingFile: string) => {
          log.debug(`Found dependency in ${containingFile}: ${moduleName}`);
          const dep = entryPoints.find(ep => ep.data.entryPoint.moduleId === moduleName);

          if (dep) {
            log.debug(
              `Found entry point dependency: ${entryPoint.data.entryPoint.moduleId} -> ${dep.data.entryPoint.moduleId}`
            );
            entryPoint.dependsOn(dep);
          }

          return moduleNameToFileName.call(this, moduleName, containingFile);
        }
      };

      const program: ng.Program = ng.createProgram({
        rootNames: tsConfig.rootNames,
        options: tsConfig.options,
        host: compilerHost
      });

      const diagnostics = program.getNgStructuralDiagnostics();
      if (diagnostics.length) {
        throw new Error(ng.formatDiagnostics(diagnostics));
      }
    };

    entryPoints.forEach(analyseEntryPoint);
    return graph;
  })
);
