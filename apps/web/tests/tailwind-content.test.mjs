// The app once loaded unstyled whenever a dev server started outside apps/web:
// Tailwind resolved its content globs and config from the working directory,
// found nothing, and webpack cached the empty stylesheet. This compiles the CSS
// from somewhere else entirely and checks real utilities come out.
import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import { createRequire } from 'node:module';
import postcssConfig from '../postcss.config.mjs';

const require = createRequire(import.meta.url);
const postcss = require('postcss');

test('Tailwind finds the app and its theme from any working directory', async () => {
  const cwd = process.cwd();
  process.chdir(os.tmpdir());
  try {
    const plugins = Object.entries(postcssConfig.plugins).map(([name, opts]) => require(name)(opts));
    const out = await postcss(plugins).process('@tailwind utilities;', { from: undefined });
    assert.match(out.css, /\.flex\s*\{/, 'no utilities generated: content globs found no source files');
    assert.match(out.css, /\.bg-tp-card\s*\{/, 'theme colors missing: tailwind.config.js was not loaded');
  } finally {
    process.chdir(cwd);
  }
});
