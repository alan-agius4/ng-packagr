import { umdModuleIdStrategy } from './umd-module-id-strategy';

describe(`rollup`, () => {
  describe(`umdModuleIdStrategy()`, () => {
    it(`should map 'rxjs' to 'rxjs'`, () => {
      expect(umdModuleIdStrategy('rxjs')).toBe('rxjs');
    });

    it(`should map 'rxjs/operators' to 'rxjs.operators'`, () => {
      expect(umdModuleIdStrategy('rxjs/operators')).toBe('rxjs.operators');
    });

    it(`should map '@angular/core' to 'ng.core'`, () => {
      expect(umdModuleIdStrategy('@angular/core')).toBe('ng.core');
    });

    it(`should map '@angular/common/http' to 'ng.common.http'`, () => {
      expect(umdModuleIdStrategy('@angular/common/http')).toBe('ng.common.http');
    });

    it(`should map '@angular/common/http/testing' to 'ng.common.http.testing'`, () => {
      expect(umdModuleIdStrategy('@angular/common/http/testing')).toBe('ng.common.http.testing');
    });

    it(`should map '@angular/platform-browser' to 'ng.platformBrowser'`, () => {
      expect(umdModuleIdStrategy('@angular/platform-browser')).toBe('ng.platformBrowser');
    });

    it(`should map '@angular/platform-browser/animations' to 'ng.platformBrowser.animations'`, () => {
      expect(umdModuleIdStrategy('@angular/platform-browser/animations')).toBe('ng.platformBrowser.animations');
    });

    it(`should map '@angular/platform-browser-dynamic' to 'ng.platformBrowserDynamic'`, () => {
      expect(umdModuleIdStrategy('@angular/platform-browser-dynamic')).toBe('ng.platformBrowserDynamic');
    });

    it(`should map 'tslib' to 'tslib'`, () => {
      expect(umdModuleIdStrategy('tslib')).toBe('tslib');
    });

    const FOO_MODULE = 'FooModule';
    it(`should map 'foo' to '${FOO_MODULE}' when 'umdModuleIds' is provided`, () => {
      expect(umdModuleIdStrategy('foo', { foo: FOO_MODULE })).toBe(FOO_MODULE);
    });

    it(`should map 'foo' to '' when no 'umdModuleIds' is provided`, () => {
      expect(umdModuleIdStrategy('foo')).toBe('');
    });
  });
});
