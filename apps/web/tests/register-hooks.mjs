// Teaches `node --test` the two module conventions this app's source uses but
// Node does not: the "@/..." path alias and extensionless imports.
import Module from 'node:module';
import { register } from 'node:module';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

register('./resolve-hook.mjs', import.meta.url);

// The ESM hook above cannot see require(), which some route tests still use.
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const EXTS = ['', '.ts', '.tsx', '.mjs', '.js', '/index.ts', '/index.tsx'];
const resolveFilename = Module._resolveFilename;

Module._resolveFilename = function (request, ...rest) {
  if (request.startsWith('@/')) {
    const base = path.join(SRC, request.slice(2));
    for (const ext of EXTS) {
      if (ext && existsSync(base + ext)) return resolveFilename.call(this, base + ext, ...rest);
    }
    return resolveFilename.call(this, base, ...rest);
  }
  return resolveFilename.call(this, request, ...rest);
};
