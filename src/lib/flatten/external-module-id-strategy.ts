import * as path from 'path';
import { readJsonSync } from 'fs-extra';
import { flatten } from '../util/array';

export const externalModuleIdStrategy = (moduleId: string, moduleFormat: any, external: string[] = []): boolean => {
  // more information about why we don't check for 'node_modules' path
  // https://github.com/rollup/rollup-plugin-node-resolve/issues/110#issuecomment-350353632
  if (
    path.isAbsolute(moduleId) ||
    moduleId.startsWith('.') ||
    moduleId.startsWith('/') ||
    (moduleFormat === 'umd' && !external.some(x => x === moduleId))
  ) {
    // if it's either 'absolute', marked to embed, starts with a '.' or '/' it's not external
    return false;
  }

  return true;
};
