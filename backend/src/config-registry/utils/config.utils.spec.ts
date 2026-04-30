import {
  deepMerge,
  getByPath,
  setByPath,
  convertFlatPathsToObject,
} from './config.utils';

describe('deepMerge', () => {
  it('merges flat objects with source winning on conflict', () => {
    expect(deepMerge({ a: 1, b: 2 }, { b: 99, c: 3 })).toEqual({ a: 1, b: 99, c: 3 });
  });

  it('deep-merges nested objects without replacing whole subtrees', () => {
    const target = { order: { export: { enabled: true, format: 'csv' }, sync: { enabled: false } } };
    const source = { order: { export: { enabled: false } } };
    expect(deepMerge(target, source)).toEqual({
      order: { export: { enabled: false, format: 'csv' }, sync: { enabled: false } },
    });
  });

  it('does not mutate target', () => {
    const target = { a: { b: 1 } };
    deepMerge(target, { a: { b: 2 } });
    expect(target.a.b).toBe(1);
  });

  it('handles empty source', () => {
    expect(deepMerge({ a: 1 }, {})).toEqual({ a: 1 });
  });

  it('handles empty target', () => {
    expect(deepMerge({}, { a: 1 })).toEqual({ a: 1 });
  });
});

describe('getByPath', () => {
  const obj = { order: { export: { enabled: true, format: 'csv' } } };

  it('returns a nested value', () => {
    expect(getByPath(obj, ['order', 'export', 'enabled'])).toBe(true);
  });

  it('returns undefined for missing path', () => {
    expect(getByPath(obj, ['order', 'missing', 'key'])).toBeUndefined();
  });

  it('returns the root object for empty path', () => {
    expect(getByPath(obj, [])).toBe(obj);
  });

  it('returns undefined when traversing into a non-object', () => {
    expect(getByPath(obj, ['order', 'export', 'enabled', 'nested'])).toBeUndefined();
  });
});

describe('setByPath', () => {
  it('sets a deeply nested value', () => {
    const obj: Record<string, unknown> = {};
    setByPath(obj, ['a', 'b', 'c'], 42);
    expect(obj).toEqual({ a: { b: { c: 42 } } });
  });

  it('overwrites an existing value', () => {
    const obj: Record<string, unknown> = { a: { b: 1 } };
    setByPath(obj, ['a', 'b'], 99);
    expect((obj['a'] as Record<string, unknown>)['b']).toBe(99);
  });

  it('creates intermediate objects when segment is not an object', () => {
    const obj: Record<string, unknown> = { a: 'scalar' };
    setByPath(obj, ['a', 'b'], 1);
    expect(obj).toEqual({ a: { b: 1 } });
  });
});

describe('convertFlatPathsToObject', () => {
  it('converts flat paths to nested object', () => {
    expect(
      convertFlatPathsToObject({
        'order.export.enabled': false,
        'order.export.format': 'json',
        'order.sync.enabled': true,
      }),
    ).toEqual({
      order: {
        export: { enabled: false, format: 'json' },
        sync: { enabled: true },
      },
    });
  });

  it('handles a single-segment path', () => {
    expect(convertFlatPathsToObject({ foo: 'bar' })).toEqual({ foo: 'bar' });
  });

  it('returns empty object for empty input', () => {
    expect(convertFlatPathsToObject({})).toEqual({});
  });
});
