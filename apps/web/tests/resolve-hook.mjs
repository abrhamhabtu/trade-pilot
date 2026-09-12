// Lets `node --test` load app source that uses the project's "@/..." alias and
// extensionless imports, which Next resolves via webpack but Node does not.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const EXTS = ['.ts', '.tsx', '.mjs', '.js', '/index.ts', '/index.tsx'];

function withExtension(filePath) {
  if (existsSync(filePath) && path.extname(filePath)) return filePath;
  for (const ext of EXTS) {
    if (existsSync(filePath + ext)) return filePath + ext;
  }
  return null;
}

export async function resolve(specifier, context, next) {
  let target = null;

  if (specifier.startsWith('@/')) {
    target = path.join(SRC, specifier.slice(2));
  } else if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
    target = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
  }

  if (target) {
    const resolved = withExtension(target);
    if (resolved) return { url: pathToFileURL(resolved).href, shortCircuit: true };
  }

  return next(specifier, context);
}
