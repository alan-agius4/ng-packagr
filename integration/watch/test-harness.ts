import * as fs from 'fs-extra';
import * as path from 'path';
import * as log from '../../src/lib/util/log';
import { Subscription } from 'rxjs';
import { ngPackagr } from 'ng-packagr';
import { tap } from 'rxjs/operators';

/**
 * A testing harness class to setup the enviroment andtest the incremental builds.
 */
export class TestHarness {
  private completeHandler = () => undefined;
  private harnessTempDir = path.join(process.env.TEST_TMPDIR, '.tmp');
  private testTempPath = path.join(this.harnessTempDir, this.testName);
  private testSrc = path.dirname(require.resolve(`ngpackagr/integration/watch/${this.testName}`));
  private testDistPath = path.join(this.testTempPath, 'dist');
  private ngPackagr$$: Subscription;
  private loggerStubs: Record<string, jasmine.Spy> = {};

  constructor(private testName: string) {}

  initialize(): Promise<void> {
    // the below is done in order to avoid poluting the test reporter with build logs
    for (const key in log) {
      if (log.hasOwnProperty(key)) {
        //    this.loggerStubs[key] = spyOn(log, key as keyof typeof log).and.stub();
      }
    }

    this.emptyTestDirectory();
    fs.copySync(this.testSrc, this.testTempPath);

    return this.setUpNgPackagr();
  }

  dispose(): void {
    this.reset();

    for (const key in this.loggerStubs) {
      this.loggerStubs[key].and.callThrough();
    }

    if (this.ngPackagr$$) {
      this.ngPackagr$$.unsubscribe();
    }

    this.emptyTestDirectory();
  }

  reset(): void {
    this.loggerStubs['error'].and.callThrough();
    this.completeHandler = () => undefined;
  }

  readFileSync(filePath: string, isJson = false): string | object {
    const file = path.join(this.testDistPath, filePath);
    return isJson ? fs.readJsonSync(file) : fs.readFileSync(file, { encoding: 'utf-8' });
  }

  /**
   * Copy a test case to it's temporary destination immediately.
   */
  copyTestCase(caseName: string) {
    fs.copySync(path.join(this.testSrc, 'test_files', caseName), this.testTempPath);
  }

  expectFesm5ToMatch(fileName: string, regexp: RegExp): boolean {
    return expect(this.readFileSync(`fesm5/${fileName}.js`)).toMatch(regexp);
  }

  expectFesm2015ToMatch(fileName: string, regexp: RegExp): boolean {
    return expect(this.readFileSync(`fesm2015/${fileName}.js`)).toMatch(regexp);
  }

  expectDtsToMatch(fileName: string, regexp: RegExp): boolean {
    return expect(this.readFileSync(`${fileName}.d.ts`)).toMatch(regexp);
  }

  expectMetadataToContain(fileName: string, path: string, value: any): boolean {
    const data = this.readFileSync(`${fileName}.metadata.json`, true);
    return expect(data).toContain(path, value);
  }

  /**
   * Gets invoked when a compilation completes succesfully.
   */
  onComplete(done: () => void): void {
    this.completeHandler = done;
  }

  /**
   * Gets invoked when a compilation error occuries.
   */
  onFailure(done: (error: Error) => void): void {
    this.loggerStubs['error'].and.callFake(done);
  }

  /**
   * Remove the entire directory for the current test case.
   */
  emptyTestDirectory(): void {
    fs.emptyDirSync(this.testTempPath);
  }

  getFilePath(filePath: string): string {
    return path.join(this.testDistPath, filePath);
  }

  private setUpNgPackagr(): Promise<void> {
    return new Promise(resolve => {
      this.ngPackagr$$ = ngPackagr()
        .forProject(path.join(this.testTempPath, 'package.json'))
        .watch()
        .pipe(
          tap(() => resolve()), // we are only interested when in the first builds, that's why we are resolving it
          tap(() => this.completeHandler()),
        )
        .subscribe();
    });
  }
}
