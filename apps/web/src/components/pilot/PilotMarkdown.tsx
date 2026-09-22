"use client";
import { Fragment } from "react";
import { parseMarkdown, type Inline } from "@/lib/pilot/markdown";

function Spans({ spans }: { spans: Inline[] }) {
  return (
    <>
      {spans.map((s, i) => (
        <Fragment key={i}>
          {s.type === "bold" ? (
            <strong className="font-semibold text-zinc-50">{s.value}</strong>
          ) : s.type === "italic" ? (
            <em className="italic text-zinc-300">{s.value}</em>
          ) : s.type === "code" ? (
            <code className="rounded bg-white/[0.08] px-1 py-0.5 font-mono text-[0.85em] text-zinc-200">
              {s.value}
            </code>
          ) : (
            s.value
          )}
        </Fragment>
      ))}
    </>
  );
}

/**
 * Renders a coaching reply's Markdown subset as elements. Model output is
 * parsed to a structure first, so a reply can never inject markup.
 */
export function PilotMarkdown({ text }: { text: string }) {
  const blocks = parseMarkdown(text);
  return (
    <div className="space-y-3 text-sm leading-relaxed text-zinc-200">
      {blocks.map((block, i) => {
        if (block.type === "heading")
          return block.level === 2 ? (
            <h3
              key={i}
              className="pt-1 text-[13px] font-semibold uppercase tracking-[0.08em] text-tp-green"
            >
              <Spans spans={block.spans} />
            </h3>
          ) : (
            <h4 key={i} className="pt-0.5 text-sm font-semibold text-zinc-100">
              <Spans spans={block.spans} />
            </h4>
          );

        if (block.type === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List
              key={i}
              className={
                block.ordered
                  ? "list-decimal space-y-1.5 pl-5 marker:text-zinc-500"
                  : "list-disc space-y-1.5 pl-5 marker:text-tp-green/60"
              }
            >
              {block.items.map((item, j) => (
                <li key={j} className="pl-0.5">
                  <Spans spans={item} />
                </li>
              ))}
            </List>
          );
        }

        if (block.type === "table")
          return (
            <div
              key={i}
              className="-mx-1 overflow-x-auto rounded-xl border border-white/[0.08]"
            >
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="bg-white/[0.04]">
                    {block.head.map((cell, j) => (
                      <th
                        key={j}
                        scope="col"
                        className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-400"
                      >
                        <Spans spans={cell} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, j) => (
                    <tr key={j} className="border-t border-white/[0.06]">
                      {row.map((cell, k) => (
                        <td
                          key={k}
                          className="px-3 py-2 align-top text-zinc-200"
                        >
                          <Spans spans={cell} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );

        return (
          <p key={i}>
            <Spans spans={block.spans} />
          </p>
        );
      })}
    </div>
  );
}
