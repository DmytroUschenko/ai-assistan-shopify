import { pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('~/')) {
    const modulePath = specifier.replace('~/', './app/');
    const resolvedPath = resolve(__dirname, modulePath);
    return nextResolve(resolvedPath, context);
  }
  return nextResolve(specifier, context);
}
