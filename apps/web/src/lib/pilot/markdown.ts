/**
 * A deliberately small Markdown subset for coaching replies: headings, bullet
 * and numbered lists, tables, paragraphs, and inline bold/italic/code.
 *
 * Parsing to a structure (rather than to HTML) keeps model output as data —
 * the renderer builds React elements from these blocks, so nothing a model
 * writes can become markup.
 */

export type Inline =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "code"; value: string };

export type Block =
  | { type: "heading"; level: 2 | 3; spans: Inline[] }
  | { type: "paragraph"; spans: Inline[] }
  | { type: "list"; ordered: boolean; items: Inline[][] }
  | { type: "table"; head: Inline[][]; rows: Inline[][][] };

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|(?:^|[\s(])\*[^*\n]+\*(?=$|[\s).,;:!?]))/;

/** Splits one line into bold / italic / code / plain spans. */
export function parseInline(text: string): Inline[] {
  const spans: Inline[] = [];
  for (const piece of text.split(INLINE)) {
    if (!piece) continue;
    const trimmed = piece.trim();
    if (trimmed.startsWith("**") && trimmed.endsWith("**") && trimmed.length > 4)
      spans.push({ type: "bold", value: trimmed.slice(2, -2) });
    else if (trimmed.startsWith("`") && trimmed.endsWith("`") && trimmed.length > 2)
      spans.push({ type: "code", value: trimmed.slice(1, -1) });
    else if (
      trimmed.startsWith("*") &&
      trimmed.endsWith("*") &&
      trimmed.length > 2
    ) {
      // Keep whatever spacing separated this emphasis from the previous word.
      const lead = piece.slice(0, piece.indexOf("*"));
      if (lead) spans.push({ type: "text", value: lead });
      spans.push({ type: "italic", value: trimmed.slice(1, -1) });
    } else spans.push({ type: "text", value: piece });
  }
  return spans.length ? spans : [{ type: "text", value: text }];
}

const cells = (line: string) =>
  line
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => parseInline(c.trim()));

const isDivider = (line: string) => /^\|?[\s:-]*-[\s:|-]*\|?$/.test(line.trim());

/** Parses a coaching reply into renderable blocks. */
export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flush = () => {
    if (!paragraph.length) return;
    blocks.push({ type: "paragraph", spans: parseInline(paragraph.join(" ")) });
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flush();
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flush();
      blocks.push({
        type: "heading",
        level: heading[1].length <= 2 ? 2 : 3,
        spans: parseInline(heading[2]),
      });
      continue;
    }

    // A table needs a header row followed by a |---|---| divider.
    if (trimmed.startsWith("|") && isDivider(lines[i + 1] ?? "")) {
      flush();
      const head = cells(trimmed);
      const rows: Inline[][][] = [];
      i += 1;
      while (
        i + 1 < lines.length &&
        lines[i + 1].trim().startsWith("|") &&
        !isDivider(lines[i + 1])
      ) {
        i += 1;
        rows.push(cells(lines[i].trim()));
      }
      blocks.push({ type: "table", head, rows });
      continue;
    }

    const bullet = /^[-*•]\s+(.*)$/.exec(trimmed);
    const numbered = /^(\d+)[.)]\s+(.*)$/.exec(trimmed);
    if (bullet || numbered) {
      flush();
      const ordered = !!numbered;
      const last = blocks[blocks.length - 1];
      const item = parseInline((bullet ? bullet[1] : numbered![2]).trim());
      if (last?.type === "list" && last.ordered === ordered) last.items.push(item);
      else blocks.push({ type: "list", ordered, items: [item] });
      continue;
    }

    paragraph.push(trimmed);
  }
  flush();
  return blocks;
}
