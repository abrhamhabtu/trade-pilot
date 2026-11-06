import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isShortVideoLink, readNotes, videoCreator, videoSource, withPlayableVideos } from "../src/lib/playbookLibrary.ts";

test("short TikTok links are recognised, and full ones play", () => {
  for (const u of ["https://www.tiktok.com/t/ZPLxp6NFr/", "https://vm.tiktok.com/ZMabc123/", "https://vt.tiktok.com/ZSxyz/"]) assert.ok(isShortVideoLink(u), u);
  for (const u of ["https://www.tiktok.com/@a/video/1", "http://www.tiktok.com/t/ZPL/", "https://evil.example/t/ZPL/", "not a link"]) assert.ok(!isShortVideoLink(u), u);
  const s = videoSource("https://www.tiktok.com/@diegotradez/video/7699193253261790478");
  assert.equal(s.provider, "TikTok");
  assert.match(s.src, /player\/v1\/7699193253261790478/);
});

test("every video in the built-in playbooks has a link the player can use", () => {
  const src = readFileSync(new URL("../src/components/Playbooks.tsx", import.meta.url), "utf8");
  const seeds = [...src.matchAll(/videos:\s*\[([\s\S]*?)\]\s*,?\s*\}/g)].flatMap((m) => [...m[1].matchAll(/url:\s*'([^']+)'/g)].map((x) => x[1]));
  assert.ok(seeds.length >= 10, `${seeds.length} seeded videos`);
  for (const u of seeds) assert.ok(videoSource(u), `can't play ${u}`);
});

test("a stored library swaps short links for full ones, and leaves good ones alone", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ url: "https://www.tiktok.com/@x/video/123" }), { status: 200 });
  try {
    const lib = { revisions: [], screenshots: [], preferred: null, videos: [{ id: "a", title: "A", notes: "", url: "https://www.tiktok.com/t/ZAB/" }, { id: "b", title: "B", notes: "", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }] };
    const out = await withPlayableVideos(lib);
    assert.equal(out.videos[0].url, "https://www.tiktok.com/@x/video/123");
    assert.equal(out.videos[1], lib.videos[1]);
    const clean = { ...lib, videos: [lib.videos[1]] };
    assert.equal(await withPlayableVideos(clean), clean);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("creator names come from the link or the title", () => {
  assert.equal(videoCreator({ url: "https://www.tiktok.com/@diegotradez/video/1", title: "x" }), "diegotradez");
  assert.equal(videoCreator({ url: "https://www.instagram.com/reel/abc/", title: "The setup — evandyer (Instagram)" }), "evandyer");
  assert.equal(videoCreator({ url: "https://www.instagram.com/reel/abc/", title: "Untitled" }), "");
});

test("a video's notes split into its facts and its takeaways", () => {
  const n = readNotes("TikTok by diegotradez (70s, 7,111 likes, 78.6K views). 50K prop account: 3k profit target. Fix: 2,000 / 7 = 285.71, about $285 risk. Run it before your next eval.");
  assert.deepEqual(n.meta, ["70s", "7,111 likes", "78.6K views"]);
  assert.equal(n.points.length, 3);
  assert.match(n.points[1], /^Fix: 2,000 \/ 7 = 285\.71/);
  assert.deepEqual(readNotes("Just one takeaway here.").meta, []);
  assert.deepEqual(readNotes("").points, []);
});
