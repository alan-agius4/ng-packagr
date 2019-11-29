import { DepthBuilder } from './depth';

describe(`DepthBuilder`, () => {
  it(`should group a->b, a->c`, () => {
    const builder = new DepthBuilder();
    builder.add('a', ['b']);
    builder.add('a', ['c']);

    const groups = builder.build();
    expect(groups[0][0]).toBe('b');
    expect(groups[0][1]).toBe('c');
    expect(groups[1][0]).toBe('a');
  });

  it(`should group a->b, a->c, b->c`, () => {
    const builder = new DepthBuilder();
    builder.add('a', ['b', 'c']);
    builder.add('b', ['c']);

    const groups = builder.build();
    expect(groups[0][0]).toBe('c');
    expect(groups[1][0]).toBe('b');
    expect(groups[2][0]).toBe('a');
  });

  /*
   * This scenario is also visually documented:
   *  - [Dependencies](docs/graph/depth-graph.png)
   *  - [Build Groups](docs/graph/depth-groups.png)
   */
  it(`should group a complex scenario`, () => {
    const builder = new DepthBuilder();
    builder.add('a', ['b', 'c', 'f']);
    builder.add('b', 'c');
    builder.add('c', 'e');
    builder.add('d');
    builder.add('e', 'g');
    builder.add('f', 'g');
    builder.add('h', 'i');
    builder.add('h', 'j');

    const groups = builder.build();
    expect(groups.length).toEqual(6);
    expect(groups[0]).toEqual(['d', 'g', 'i', 'j']);
    expect(groups[1]).toEqual(['h', 'f', 'e']);
    expect(groups[2]).toEqual(['c']);
    expect(groups[3]).toEqual(['b']);
    expect(groups[4]).toEqual(['a']);
  });

  /**
   * This scenario is visually documented:
   * https://mermaidjs.github.io/mermaid-live-editor/#/edit/eyJjb2RlIjoiZ3JhcGggVERcbmIgLS0-IGRcbmIgLS0-IGNcbmIgLS0-IGVcbmEgLS0-IGJcbmEgLS0-IGRcbmEgLS0-IGNcbmEgLS0-IGVcbmQgLS0-IGVcbmMgLS0-IGRcbmMgLS0-IGUiLCJtZXJtYWlkIjp7InRoZW1lIjoiZGVmYXVsdCJ9fQ
   */
  it(`should group an unordered complex scenario`, () => {
    const builder = new DepthBuilder();
    builder.add('b', ['d', 'c', 'e']);
    builder.add('a', ['b', 'd', 'c', 'e']);
    builder.add('d', 'e');
    builder.add('c', ['d', 'e']);
    builder.add('e');

    const groups = builder.build();
    expect(groups[0]).toEqual(['e']);
    expect(groups[1]).toEqual(['d']);
    expect(groups[2]).toEqual(['c']);
    expect(groups[3]).toEqual(['b']);
    expect(groups[4]).toEqual(['a']);
  });

  it(`should create a max depth that holds all buckets`, () => {
    const builder = new DepthBuilder();
    builder.add('parent');
    builder.add('a', ['shared']);
    builder.add('b', ['a']);
    builder.add('c', ['a', 'b']);
    builder.add('shared');
    builder.add('sub');

    const groups = builder.build();
    expect(groups[0]).toEqual(['parent', 'shared', 'sub']);
    expect(groups[1]).toEqual(['a']);
    expect(groups[2]).toEqual(['b']);
    expect(groups[3]).toEqual(['c']);
  });
});
