import { ExternalModuleIdStrategy } from './external-module-id-strategy';

describe(`rollup`, () => {
  describe(`ExternalModuleIdStrategy`, () => {
    let externalModuleIdStrategy: ExternalModuleIdStrategy;

    describe(`when module format is 'umd'`, () => {
      describe(`and no 'bundledDependencies' are specified`, () => {
        beforeEach(() => {
          externalModuleIdStrategy = new ExternalModuleIdStrategy('umd', {});
        });

        it(`should return 'false' paths starting with '.'`, () => {
          expect(externalModuleIdStrategy.isExternalDependency('./foo/bar')).toBe(false);
        });

        it(`should return 'false' for paths starting with '/'`, () => {
          expect(externalModuleIdStrategy.isExternalDependency('/foo/bar')).toBe(false);
        });

        it(`should return 'false' for absolute paths`, () => {
          expect(externalModuleIdStrategy.isExternalDependency(__filename)).toBe(false);
        });

        it(`should return 'true' for external modules like '@angular/core'`, () => {
          expect(externalModuleIdStrategy.isExternalDependency('@angular/core')).toBe(true);
        });

        it(`should return 'true' for modules with '.' like 'ui.core'`, () => {
          expect(externalModuleIdStrategy.isExternalDependency('ui.core')).toBe(true);
        });

        it(`should return 'false' for external module 'tslib'`, () => {
          expect(externalModuleIdStrategy.isExternalDependency('tslib')).toBe(false);
        });
      });

      describe(`and 'bundledDependencies' are specified`, () => {
        beforeEach(() => {
          externalModuleIdStrategy = new ExternalModuleIdStrategy('umd', {
            bundledDependencies: ['@angular/core'],
            dependencies: ['ui.core'],
          });
        });

        it(`should return 'false' paths starting with '.'`, () => {
          expect(externalModuleIdStrategy.isExternalDependency('./foo/bar')).toBe(false);
        });

        it(`should return 'false' for paths starting with '/'`, () => {
          expect(externalModuleIdStrategy.isExternalDependency('/foo/bar')).toBe(false);
        });

        it(`should return 'false' for absolute paths`, () => {
          expect(externalModuleIdStrategy.isExternalDependency(__filename)).toBe(false);
        });

        it(`should return 'false' for a bundled dependency like '@angular/core'`, () => {
          expect(externalModuleIdStrategy.isExternalDependency('@angular/core')).toBe(false);
        });

        it(`should return 'false' for a bundled dependency like '@angular/core/testing'`, () => {
          expect(externalModuleIdStrategy.isExternalDependency('@angular/core/testing')).toBe(false);
        });

        it(`should return 'true' for modules with '.' like 'ui.core'`, () => {
          expect(externalModuleIdStrategy.isExternalDependency('ui.core')).toBe(true);
        });

        it(`should return 'false' for external module 'tslib'`, () => {
          expect(externalModuleIdStrategy.isExternalDependency('tslib')).toBe(false);
        });
      });
    });

    describe(`when module format is 'es'`, () => {
      describe(`and no 'bundledDependencies' are specified`, () => {
        beforeEach(() => {
          externalModuleIdStrategy = new ExternalModuleIdStrategy('es', {});
        });

        it(`should return 'false' paths starting with '.'`, () => {
          expect(externalModuleIdStrategy.isExternalDependency('./foo/bar')).toBe(false);
        });

        it(`should return 'false' for paths starting with '/'`, () => {
          expect(externalModuleIdStrategy.isExternalDependency('/foo/bar')).toBe(false);
        });

        it(`should return 'false' for absolute paths`, () => {
          expect(externalModuleIdStrategy.isExternalDependency(__filename)).toBe(false);
        });

        it(`should return 'true' for external modules like '@angular/core'`, () => {
          expect(externalModuleIdStrategy.isExternalDependency('@angular/core')).toBe(true);
        });

        it(`should return 'true' for modules with '.' like 'ui.core'`, () => {
          expect(externalModuleIdStrategy.isExternalDependency('ui.core')).toBe(true);
        });

        it(`should return 'true' for external module 'tslib'`, () => {
          expect(externalModuleIdStrategy.isExternalDependency('tslib')).toBe(true);
        });
      });

      describe(`and 'bundledDependencies' are specified`, () => {
        beforeEach(() => {
          externalModuleIdStrategy = new ExternalModuleIdStrategy('es', {
            bundledDependencies: ['@angular/core'],
          });
        });

        it(`should return 'false' paths starting with '.'`, () => {
          expect(externalModuleIdStrategy.isExternalDependency('./foo/bar')).toBe(false);
        });

        it(`should return 'false' for paths starting with '/'`, () => {
          expect(externalModuleIdStrategy.isExternalDependency('/foo/bar')).toBe(false);
        });

        it(`should return 'false' for absolute paths`, () => {
          expect(externalModuleIdStrategy.isExternalDependency(__filename)).toBe(false);
        });

        it(`should return 'true' for a bundled dependency like '@angular/core'`, () => {
          expect(externalModuleIdStrategy.isExternalDependency('@angular/core')).toBe(true);
        });

        it(`should return 'true' for a bundled dependency like '@angular/core/testing'`, () => {
          expect(externalModuleIdStrategy.isExternalDependency('@angular/core/testing')).toBe(true);
        });

        it(`should return 'true' for modules with '.' like 'ui.core'`, () => {
          expect(externalModuleIdStrategy.isExternalDependency('ui.core')).toBe(true);
        });

        it(`should return 'true' for external module 'tslib'`, () => {
          expect(externalModuleIdStrategy.isExternalDependency('tslib')).toBe(true);
        });
      });
    });
  });
});
