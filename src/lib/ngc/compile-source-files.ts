import * as fs from 'fs-extra';
import * as ng from '@angular/compiler-cli';
import * as ts from 'typescript';
import * as path from 'path';
import { createCompilerHostForSynthesizedSourceFiles } from '../ts/synthesized-compiler-host';
import { TsConfig } from '../ts/tsconfig';
import * as log from '../util/log';
import { createEmitCallback } from './create-emit-callback';
import { redirectWriteFileCompilerHost } from '../ts/redirect-write-file-compiler-host';
import { watchCompilerHost } from '../ts/watch-compiler-host';

export async function compileSourceFiles(
  sourceFiles: ts.SourceFile[],
  tsConfig: TsConfig,
  extraOptions?: Partial<ng.CompilerOptions>,
  declarationDir?: string,
  compilerHost?: ng.CompilerHost,
  fileCache?: any
) {
  log.debug(`ngc (v${ng.VERSION.full})`);

  const tsConfigOptions: ng.CompilerOptions = { ...tsConfig.options, ...extraOptions };

  let ngCompilerHost;

  // if (fileCache && compilerHost) {
  //   ngCompilerHost = watchCompilerHost(fileCache, compilerHost);
  // } else {
    // ts.CompilerHost
    let tsCompilerHost = createCompilerHostForSynthesizedSourceFiles(sourceFiles, tsConfigOptions);
    if (declarationDir) {
      tsCompilerHost = redirectWriteFileCompilerHost(tsCompilerHost, tsConfigOptions.baseUrl, declarationDir);
    }

    // ng.CompilerHost
    ngCompilerHost = ng.createCompilerHost({
      options: tsConfigOptions,
      tsHost: tsCompilerHost
    });

  // }

  // ngc
  const result = ng.performCompilation({
    rootNames: tsConfig.rootNames,
    options: tsConfigOptions,
    emitCallback: createEmitCallback(tsConfigOptions),
    emitFlags: tsConfig.emitFlags,
    host: ngCompilerHost
  });

  const flatModuleFile = tsConfigOptions.flatModuleOutFile;
  const flatModuleFileExtension = path.extname(flatModuleFile);

  // XX(hack): redirect the `*.metadata.json` to the correct outDir
  // @link https://github.com/angular/angular/pull/21787
  if (declarationDir) {
    const metadataBundleFile = flatModuleFile.replace(flatModuleFileExtension, '.metadata.json');
    const metadataSrc = path.resolve(tsConfigOptions.declarationDir, metadataBundleFile);
    const metadataDest = path.resolve(declarationDir, metadataBundleFile);
    if (metadataDest !== metadataSrc && fs.existsSync(metadataSrc)) {
      await fs.move(metadataSrc, metadataDest, { overwrite: true });
    }
  }

  const exitCode = ng.exitCodeFromResult(result.diagnostics);
  return exitCode === 0
    ? Promise.resolve({ program: result.program as any, compilerHost: ngCompilerHost as any })
    : Promise.reject(new Error(ng.formatDiagnostics(result.diagnostics)));
}