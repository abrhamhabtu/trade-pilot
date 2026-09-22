import test from "node:test";
import assert from "node:assert/strict";
import { parseMarkdown, parseInline } from "../src/lib/pilot/markdown.ts";

const text = (spans) => spans.map((s) => s.value).join("");

test("reads headings, paragraphs and both kinds of list", () => {
  const blocks = parseMarkdown(
    "## Biggest leak\n\nYou traded past your finish time.\n\n- First point\n- Second point\n\n1. Do this\n2. Then this",
  );
  assert.deepEqual(
    blocks.map((b) => b.type),
    ["heading", "paragraph", "list", "list"],
  );
  assert.equal(blocks[0].level, 2);
  assert.equal(text(blocks[1].spans), "You traded past your finish time.");
  assert.equal(blocks[2].ordered, false);
  assert.equal(blocks[2].items.length, 2);
  assert.equal(blocks[3].ordered, true);
  assert.equal(text(blocks[3].items[1]), "Then this");
});

test("reads a table with its header row", () => {
  const blocks = parseMarkdown(
    "| Rule | Breaches |\n|---|---:|\n| Max contracts | 19 trades |\n| Finish time | 24 trades |",
  );
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "table");
  assert.deepEqual(blocks[0].head.map(text), ["Rule", "Breaches"]);
  assert.equal(blocks[0].rows.length, 2);
  assert.deepEqual(blocks[0].rows[0].map(text), ["Max contracts", "19 trades"]);
});

test("a pipe line without a divider stays prose, not a broken table", () => {
  const blocks = parseMarkdown("| this is not | really a table");
  assert.equal(blocks[0].type, "paragraph");
});

test("marks bold, italic and code inline", () => {
  const spans = parseInline("**19 trades** over the limit, see `netPL` and *note*");
  const kinds = spans.map((s) => s.type);
  assert.ok(kinds.includes("bold"));
  assert.ok(kinds.includes("code"));
  assert.ok(kinds.includes("italic"));
  assert.equal(
    spans.find((s) => s.type === "bold").value,
    "19 trades",
  );
  assert.equal(spans.find((s) => s.type === "code").value, "netPL");
  assert.equal(spans.find((s) => s.type === "italic").value, "note");
});

test("plain text survives untouched", () => {
  const blocks = parseMarkdown("Just one ordinary sentence.");
  assert.equal(blocks.length, 1);
  assert.equal(text(blocks[0].spans), "Just one ordinary sentence.");
});

test("a bare asterisk is not treated as emphasis", () => {
  const spans = parseInline("2 * 3 contracts");
  assert.deepEqual(spans.map((s) => s.type), ["text"]);
});
