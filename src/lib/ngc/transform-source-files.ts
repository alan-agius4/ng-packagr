import * as ng from '@angular/compiler-cli/ngtools2';
import * as ts from 'typescript';
import { TsConfig } from '../ts/tsconfig';
import { watchCompilerHost, WatchFileCache } from '../ts/watch-compiler-host';

function isTransformationResult<T extends ts.Node>(value: any): value is ts.TransformationResult<T> {
  return value.transformed instanceof Array && typeof value.dispose === 'function';
}

export function transformSourceFiles(
  source: TsConfig | ts.TransformationResult<ts.SourceFile>,
  transformers: ts.TransformerFactory<ts.SourceFile>[],
  fileCache?: WatchFileCache
): ts.TransformationResult<ts.SourceFile> {
  if (isTransformationResult<ts.SourceFile>(source)) {
    console.log('transform files');
    // Apply subsequent typescript transformation to previous TransformationResult
    return ts.transform([...source.transformed], transformers);
  } else {
    // Apply initial typescript transformation to initial sources from TsConfig
    if (!fileCache) {
      throw new Error('fileCache is required.');
    }

    console.log('transform files');

    const tsConfig = source;

    let compilerHost: ng.CompilerHost = ng.createCompilerHost({
      options: tsConfig.options
    });

    // compilerHost = watchCompilerHost(fileCache, compilerHost);

    const program: ng.Program = ng.createProgram({
      rootNames: [...tsConfig.rootNames],
      options: tsConfig.options,
      host: compilerHost
    });

    const sourceFiles = program.getTsProgram().getSourceFiles();
    const transformationResult: ts.TransformationResult<ts.SourceFile> = ts.transform(
      // XX: circumvent tsc compile error in 2.6
      Array.from(sourceFiles),
      transformers,
      tsConfig.options
    );

    return transformationResult;
  }
}
