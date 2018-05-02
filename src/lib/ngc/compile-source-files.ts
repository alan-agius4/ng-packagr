import * as fs from 'fs-extra';
import * as ng from '@angular/compiler-cli';
import * as ts from 'typescript';
import * as path from 'path';
import { createCompilerHostForSynthesizedSourceFiles } from '../ts/synthesized-compiler-host';
import { TsConfig } from '../ts/tsconfig';
import * as log from '../util/log';
import { createEmitCallback } from './create-emit-callback';
import { redirectWriteFileCompilerHost } from '../ts/redirect-write-file-compiler-host';
import { watchCompilerHost } from '../watch/watch-compiler-host';

export async function compileSourceFiles(
  sourceFiles: ts.SourceFile[],
  tsConfig: TsConfig,
  outDir?: string,
  declarationDir?: string,
  program?: ng.Program,
  compilerHost?: ng.CompilerHost,
  fileCache?: any
) {
  log.debug(`ngc (v${ng.VERSION.full})`);

  const tsConfigOptions = { ...tsConfig.options };
  if (outDir) {
    tsConfigOptions.outDir = outDir;
  }

  // ng.CompilerHost
  let ngCompilerHost: ng.CompilerHost;
  if (compilerHost) {
    ngCompilerHost = compilerHost;
  } else {
  let ngCompilerHost = createCompilerHostForSynthesizedSourceFiles(sourceFiles, tsConfigOptions);
  if (declarationDir) {
    ngCompilerHost = redirectWriteFileCompilerHost(ngCompilerHost, tsConfig.options.baseUrl, declarationDir);
  }

  ngCompilerHost = watchCompilerHost(fileCache, ngCompilerHost);

  const result = ng.performCompilation({
    rootNames: tsConfig.rootNames,
    options: tsConfigOptions,
    emitCallback: createEmitCallback(tsConfigOptions),
    host: ngCompilerHost
    // oldProgram: program
  });

  const flatModuleFile = tsConfigOptions.flatModuleOutFile;
  const flatModuleFileExtension = path.extname(flatModuleFile);

  // XX(hack): redirect the `*.metadata.json` to the correct outDir
  // @link https://github.com/angular/angular/pull/21787
  const metadataBundleFile = flatModuleFile.replace(flatModuleFileExtension, '.metadata.json');
  const metadataSrc = path.resolve(tsConfigOptions.declarationDir, metadataBundleFile);
  const metadataDest = path.resolve(declarationDir, metadataBundleFile);
  if (metadataDest !== metadataSrc && fs.existsSync(metadataSrc)) {
    await fs.move(metadataSrc, metadataDest, { overwrite: true });
  }

  const exitCode = ng.exitCodeFromResult(result.diagnostics);
  return exitCode === 0
    ? Promise.resolve({ program: result.program as any, compilerHost: ngCompilerHost as any })
    : Promise.reject(new Error(ng.formatDiagnostics(result.diagnostics)));
}
