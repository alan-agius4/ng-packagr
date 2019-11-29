import { ParsedConfiguration } from '@angular/compiler-cli/src/perform_compile';
import { ngPackagr, NgPackagr } from './packagr';
import { provideProject, PROJECT_TOKEN } from './project.di';
import { DEFAULT_TS_CONFIG_TOKEN } from './init/init-tsconfig.di';

describe(`ngPackagr()`, () => {
  let packager: NgPackagr;
  beforeEach(() => {
    packager = ngPackagr();
  });

  it(`should have a default tsconfig`, () => {
    const defaultTsConfigProvider = packager['providers'].filter(p => (p as any).provide === DEFAULT_TS_CONFIG_TOKEN);
    expect(defaultTsConfigProvider.length).toBe(1);
  });

  describe(`forProject()`, () => {
    it(`should return self instance for chaining`, () => {
      expect(packager.forProject('foo')).toEqual(packager);
    });

    it(`should set project provider`, () => {
      const providers = packager.forProject('foobar')['providers'].filter(p => (p as any).provide === PROJECT_TOKEN);

      expect(providers.length).toBe(1);
      expect((providers[0] as any).useValue).toEqual('foobar');
    });
  });

  describe(`withTsConfig()`, () => {
    it(`should return self instance for chaining`, () => {
      const mockConfig = ({ project: 'foo' } as any) as ParsedConfiguration;
      expect(packager.withTsConfig(mockConfig)).toEqual(packager);
    });

    it(`should override the default tsconfig provider`, () => {
      const mockConfig = ({ project: 'foo' } as any) as ParsedConfiguration;
      const providers = packager
        .withTsConfig(mockConfig)
        ['providers'].filter(p => (p as any).provide === DEFAULT_TS_CONFIG_TOKEN);

      expect(providers.length).toBe(2);
      expect(typeof (providers[1] as any).useFactory).toBe('function');
      expect((providers[1] as any).useFactory().project).toBe('foo');
    });
  });
});

describe(`provideProject()`, () => {
  it(`should return the ValueProvider`, () => {
    const provider = provideProject('foo');
    expect(provider.provide).toEqual(PROJECT_TOKEN);
    expect(provider.useValue).toEqual('foo');
  });
});
