import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
const code = ts.transpileModule(readFileSync(new URL('../src/lib/playbookLibrary.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
const { videoSource, moveItem, emptyLibrary } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
test('video embeds accept supported providers and discard tracking parameters', () => {
  assert.equal(videoSource('https://www.instagram.com/reel/ABC_123/?igsh=tracking').src, 'https://www.instagram.com/p/ABC_123/embed/');
  assert.equal(videoSource('https://youtu.be/abcdefghijk?t=3').src, 'https://www.youtube-nocookie.com/embed/abcdefghijk');
  assert.equal(videoSource('https://www.youtube.com/shorts/abcdefghijk').provider, 'YouTube');
  assert.equal(videoSource('https://vimeo.com/123456').src, 'https://player.vimeo.com/video/123456');
  assert.equal(videoSource('https://example.com/clip.mp4?token=x').native, true);
});
test('unsafe URLs and lookalike hosts cannot become embeds', () => {
  for (const url of ['javascript:alert(1)', 'http://instagram.com/p/x', 'https://instagram.com.evil.com/p/x', 'https://user:password@instagram.com/p/x', 'https://instagram.com/username', '<iframe></iframe>', 'https://youtube.com/watch?v=bad']) assert.equal(videoSource(url), null, url);
});
test('reordering works in both directions without mutating input', () => {
  const values = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(moveItem(values, 'a', 2).map(x => x.id), ['b', 'c', 'a']);
  assert.deepEqual(moveItem(values, 'c', 0).map(x => x.id), ['c', 'a', 'b']);
  assert.deepEqual(values.map(x => x.id), ['a', 'b', 'c']);
  assert.equal(moveItem(values, 'missing', 0), values);
  assert.equal(moveItem(values, 'a', -1), values);
});
test('empty libraries do not share mutable collections', () => {
  const a = emptyLibrary(); a.videos.push({ id: 'x' }); assert.equal(emptyLibrary().videos.length, 0);
});
test('TikTok full video links use the official player with controls enabled', () => {
  assert.deepEqual(videoSource('https://www.tiktok.com/@scout2015/video/6718335390845095173?is_from_webapp=1'), { provider: 'TikTok', src: 'https://www.tiktok.com/player/v1/6718335390845095173?controls=1' });
  assert.equal(videoSource('https://www.tiktok.com.evil.test/@user/video/123456'), null);
  assert.equal(videoSource('https://www.tiktok.com/@user/video/not-an-id'), null);
  assert.equal(videoSource('https://vm.tiktok.com/shortlink/'), null);
});
