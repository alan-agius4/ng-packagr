import { expect } from 'chai';
import * as path from 'path';
import * as fs from 'fs-extra';

describe(`@sample/rollup`, () => {

  describe(`UMD Bundle`, () => {
    let BUNDLE;
    before(() => {
      BUNDLE = fs.readFileSync(path.resolve(__dirname, '../dist/bundles/sample-rollup.umd.js'), { encoding: 'utf-8' });
    });

    it(`should import '@angular/core'`, () => {
      expect(BUNDLE).to.contain("require('@angular/core')")
    });

    it(`should embed 'createCommonjsModule' method`, () => {
      expect(BUNDLE).to.contain("function createCommonjsModule")
    });

    it(`should embed 'fn.start' method`, () => {
      expect(BUNDLE).to.contain("n.start = function")
    });
  });

});
