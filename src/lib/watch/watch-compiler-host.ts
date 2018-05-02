import * as ts from 'typescript';
import * as path from 'path';

export interface CacheEntry {
  exists?: boolean;
  sourceFile?: ts.SourceFile;
  content?: string;
}

export type WatchFileCache = Map<string, CacheEntry>;

export function watchCompilerHost(fileCache: WatchFileCache, compilerHost: ts.CompilerHost): ts.CompilerHost {
  function cacheEntry(fileName: string): CacheEntry {
    const normalizeFileName = path.normalize(fileName);
    let entry = fileCache.get(normalizeFileName);
    if (!entry) {
      entry = {};
      fileCache.set(normalizeFileName, entry);
    }
    return entry;
  }

  return {
    ...compilerHost,
    fileExists: (fileName: string) => {
      const cache = cacheEntry(fileName);
      if (cache.exists == null) {
        cache.exists = compilerHost.fileExists.call(this, fileName);
      }
      return cache.exists;
    },
    getSourceFile: (fileName: string, languageVersion: ts.ScriptTarget) => {
      const cache = cacheEntry(fileName);
      if (!cache.sourceFile) {
        cache.sourceFile = compilerHost.getSourceFile.call(this, fileName, languageVersion);
      }
      return cache.sourceFile;
    },
    readFile: (fileName: string) => {
      const cache = cacheEntry(fileName);
      if (cache.content == null) {
        cache.content = compilerHost.readFile.call(this, fileName);
      }
      return cache.content;
    }
  };
}
