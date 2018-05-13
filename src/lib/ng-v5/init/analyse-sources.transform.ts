import * as ng from '@angular/compiler-cli';
import * as path from 'path';
import { pipe } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import * as log from '../../util/log';
import { Transform } from '../../brocc/transform';
import { isEntryPoint, TemplateNode, StylesheetNode, fileUrl } from '../nodes';
import { Node } from '../../brocc/node';

export const analyseSourcesTransform: Transform = pipe(
  map(graph => {
    const entryPoints = graph.filter(isEntryPoint);
    const analyseEntryPoint = (entryPoint: Node) => {
      const { tsConfig } = entryPoint.data;

      const compilerHost: ng.CompilerHost = {
        ...ng.createCompilerHost({
          options: tsConfig.options
        }),

        moduleNameToFileName: (moduleName: string, containingFile: string) => {
          log.debug(`Found dependency in ${containingFile}: ${moduleName}`);
          const dep = entryPoints.find(ep => ep.data.entryPoint.moduleId === moduleName);

          if (dep) {
            log.debug(
              `Found entry point dependency: ${entryPoint.data.entryPoint.moduleId} -> ${dep.data.entryPoint.moduleId}`
            );
            entryPoint.dependsOn(dep);
          }

          return moduleName;
        },

        resourceNameToFileName: (resourceName: string, containingFilePath: string) => {
          const uri = path.resolve(path.dirname(containingFilePath), resourceName);
          const nodeType = resourceName.endsWith('html') ? TemplateNode : StylesheetNode;
          const node = new nodeType(fileUrl(uri));
          graph.put(node);

          // mark that entryPoint depends on node
          entryPoint.dependsOn(node);
          return resourceName;
        }
      };

      const program: ng.Program = ng.createProgram({
        rootNames: tsConfig.rootNames,
        options: tsConfig.options,
        host: compilerHost
      });

      program.getNgSemanticDiagnostics();
    };

    for (let entryPoint of entryPoints) {
      analyseEntryPoint(entryPoint);
    }

    return graph;
  })
);
