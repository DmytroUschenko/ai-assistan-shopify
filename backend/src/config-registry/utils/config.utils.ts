type PlainObject = Record<string, unknown>;

function isPlainObject(val: unknown): val is PlainObject {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

/**
 * Recursively merges `source` into `target`.
 * Source values win for scalar conflicts; nested objects are merged deeply.
 */
export function deepMerge<T extends PlainObject>(target: T, source: Partial<T>): T {
  const result: PlainObject = { ...target };
  for (const key of Object.keys(source)) {
    const srcVal = source[key as keyof T];
    const tgtVal = target[key as keyof T];
    if (isPlainObject(srcVal) && isPlainObject(tgtVal)) {
      result[key] = deepMerge(tgtVal, srcVal as Partial<typeof tgtVal>);
    } else if (srcVal !== undefined) {
      result[key] = srcVal;
    }
  }
  return result as T;
}

/**
 * Reads a nested value from `obj` by walking `pathArray`.
 * Returns `undefined` if any segment is missing.
 */
export function getByPath(obj: unknown, pathArray: string[]): unknown {
  let current = obj;
  for (const key of pathArray) {
    if (!isPlainObject(current)) return undefined;
    current = current[key];
  }
  return current;
}

/**
 * Writes `value` into `obj` at the location described by `pathArray`,
 * creating intermediate objects as needed.
 */
export function setByPath(obj: PlainObject, pathArray: string[], value: unknown): void {
  let current = obj;
  for (let i = 0; i < pathArray.length - 1; i++) {
    const key = pathArray[i];
    if (!isPlainObject(current[key])) {
      current[key] = {};
    }
    current = current[key] as PlainObject;
  }
  current[pathArray[pathArray.length - 1]] = value;
}

/**
 * Converts a flat dot-path map into a nested object.
 *
 * @example
 * convertFlatPathsToObject({ 'order.export.enabled': false })
 * // => { order: { export: { enabled: false } } }
 */
export function convertFlatPathsToObject(flat: Record<string, unknown>): PlainObject {
  const result: PlainObject = {};
  for (const [path, value] of Object.entries(flat)) {
    setByPath(result, path.split('.'), value);
  }
  return result;
}
