"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { ArrowUpRight, ChevronDown, NotebookPen, Play } from "lucide-react";
import { readNotes, videoCreator, videoSource, type VideoReference } from "@/lib/playbookLibrary";
import { EmbeddedVideo } from "./VideoLibrary";

/** Shorts, Reels and TikToks are tall; other YouTube and Vimeo videos are wide. */
const isTall = (url: string, provider?: string) => provider === "TikTok" || provider === "Instagram" || /youtube\.com\/shorts\//.test(url);

/** The playbook's videos at the top of its guide: watch while you read the rules. */
export function GuideVideos({ videos, onNotes }: { videos: VideoReference[]; onNotes: () => void }) {
  const [id, setId] = useState(videos[0]?.id);
  const [all, setAll] = useState(false);
  useEffect(() => {
    if (!videos.some((v) => v.id === id)) setId(videos[0]?.id);
  }, [videos, id]);
  const v = videos.find((x) => x.id === id) ?? videos[0];
  const source = v ? videoSource(v.url) : null;
  const tall = v ? isTall(v.url, source?.provider) : true;
  const notes = useMemo(() => readNotes(v?.notes ?? ""), [v?.notes]);
  if (!v) return null;
  const creator = videoCreator(v);
  const shown = all ? notes.points : notes.points.slice(0, 5);
  const title = v.title.replace(/\s*[—-]\s*[\w.]+\s*\((TikTok|Instagram|YouTube)\)\s*$/i, "").replace(/\s*\((TikTok|Instagram|YouTube)\)\s*$/i, "");

  return (
    <section aria-label="Watch it explained" className="mb-6 overflow-hidden rounded-3xl bg-tp-card shadow-lift ring-1 ring-inset ring-white/[0.07]">
      <div className={clsx("grid", tall ? "md:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]" : "")}>
        <div className={clsx("relative bg-black", tall ? "mx-auto h-[620px] w-full max-w-[380px] md:max-w-none" : "aspect-video w-full")}>
          {source ? (
            source.native ? (
              <video key={source.src} src={source.src} controls playsInline preload="metadata" className="h-full w-full" />
            ) : (
              <div className="h-full [&_iframe]:h-full [&_iframe]:w-full [&_iframe]:border-0">
                <EmbeddedVideo key={source.src} src={source.src} title={v.title} originalUrl={v.url} />
              </div>
            )
          ) : (
            <a href={v.url} target="_blank" rel="noreferrer" className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-zinc-300 hover:text-white">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-white/10"><Play className="h-6 w-6 fill-current" /></span>
              <span className="text-[14px] font-medium">This one plays on its own site</span>
            </a>
          )}
        </div>

        <div className="flex min-w-0 flex-col p-6 sm:p-8">
          <p className="text-[13px] font-medium text-tp-green">Watch it explained</p>
          <h2 className="mt-1.5 text-[24px] font-semibold leading-[1.15] tracking-[-0.025em] text-white sm:text-[28px]">{title}</h2>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-zinc-400">
            {creator && <span className="font-medium text-zinc-200">@{creator}</span>}
            {source?.provider && <span>on {source.provider}</span>}
            {notes.meta.map((m) => (
              <span key={m} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[12.5px] tabular-nums text-zinc-300">{m}</span>
            ))}
          </p>

          {shown.length > 0 && (
            <>
              <h3 className="mt-6 text-[14px] font-semibold text-zinc-100">What it teaches</h3>
              <ol className="mt-2.5 space-y-2.5">
                {shown.map((p, i) => (
                  <li key={i} className="grid grid-cols-[22px_minmax(0,1fr)] gap-2 text-[15px] leading-[1.5] text-zinc-300">
                    <span className="mt-[3px] grid h-[18px] w-[18px] place-items-center rounded-full bg-tp-green/15 text-[11px] font-semibold tabular-nums text-tp-green">{i + 1}</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ol>
              {notes.points.length > 5 && (
                <button onClick={() => setAll(!all)} aria-expanded={all} className="mt-2.5 flex items-center gap-1 self-start text-[13.5px] font-medium text-zinc-400 hover:text-white">
                  <ChevronDown className={clsx("h-4 w-4 transition-transform", all && "rotate-180")} /> {all ? "Show less" : `${notes.points.length - 5} more`}
                </button>
              )}
            </>
          )}
          {!shown.length && <p className="mt-6 text-[15px] leading-relaxed text-zinc-400">No takeaways written yet. Watch it, then write down what makes this setup work.</p>}

          <div className="mt-6 flex flex-wrap gap-2">
            <a href={v.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[14px] font-semibold text-black hover:brightness-95">
              Open on {source?.provider ?? "its site"} <ArrowUpRight className="h-4 w-4" />
            </a>
            <button onClick={onNotes} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-4 py-2 text-[14px] font-medium text-zinc-100 hover:bg-white/[0.13]">
              <NotebookPen className="h-4 w-4" /> {v.notes ? "Edit your takeaways" : "Add your takeaways"}
            </button>
          </div>

          {videos.length > 1 && (
            <div className="mt-auto pt-7">
              <h3 className="text-[13px] font-medium text-zinc-500">{videos.length} videos in this playbook</h3>
              <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {videos.map((x, i) => {
                  const on = x.id === v.id;
                  return (
                    <li key={x.id}>
                      <button onClick={() => (setId(x.id), setAll(false))} aria-current={on} className={clsx("flex w-full items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-left transition", on ? "bg-white/[0.1] ring-1 ring-white/20" : "bg-white/[0.03] hover:bg-white/[0.07]")}>
                        <span className={clsx("grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-semibold tabular-nums", on ? "bg-tp-green text-tp-ink" : "bg-white/[0.08] text-zinc-300")}>{on ? <Play className="h-3 w-3 fill-current" /> : i + 1}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13.5px] font-medium text-zinc-100">{x.title.replace(/\s*\((TikTok|Instagram|YouTube)\)\s*$/i, "")}</span>
                          <span className="block truncate text-[12px] text-zinc-500">{videoSource(x.url)?.provider ?? "Link"}{videoCreator(x) ? `, @${videoCreator(x)}` : ""}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
