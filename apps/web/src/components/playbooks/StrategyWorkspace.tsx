"use client";

/* Uploaded images are browser-local data URLs, so no remote image optimizer is used. */
/* eslint-disable @next/next/no-img-element */

import React, { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Check,
  Code2,
  Copy,
  Film,
  GitBranch,
  ImagePlus,
  Images,
  Maximize2,
  Pencil,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import {
  emptyLibrary,
  Evidence,
  Library,
  readLibrary,
  Revision,
  VideoReference,
  videoSource,
  writeLibrary,
} from "@/lib/playbookLibrary";
import "./workspace.css";
import { VideoLibrary } from "./VideoLibrary";

type Props = {
  strategyId: string;
  strategyName: string;
  guide: React.ReactNode;
};
type Editor = {
  kind: "code" | "image" | "video";
  id?: string;
  file?: File;
} | null;
const makeId = () => crypto.randomUUID();
function download(content: string, name: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function StrategyWorkspace({ strategyId, strategyName, guide }: Props) {
  const [library, setLibrary] = useState<Library>(emptyLibrary);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState("workspace");
  const [editor, setEditor] = useState<Editor>(null);
  const [selected, setSelected] = useState("");
  const [lightbox, setLightbox] = useState<Evidence | null>(null);
  const [undo, setUndo] = useState<Library | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    function pasteImage(event: ClipboardEvent) {
      if (
        !ready ||
        busy ||
        editor ||
        tab !== "workspace" ||
        document.querySelector("dialog[open]")
      )
        return;
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, [contenteditable=true]")) return;
      const file = Array.from(event.clipboardData?.items || [])
        .find((item) => item.type.startsWith("image/"))
        ?.getAsFile();
      if (file) {
        event.preventDefault();
        setEditor({ kind: "image", file });
      }
    }
    document.addEventListener("paste", pasteImage);
    return () => document.removeEventListener("paste", pasteImage);
  }, [ready, busy, editor, tab]);

  useEffect(() => {
    let active = true;
    readLibrary(strategyId)
      .then((data) => {
        if (active) {
          setLibrary(data);
          setReady(true);
        }
      })
      .catch(() => {
        if (active)
          setError(
            "Your library could not be opened. Reload to try again; your saved data has not been changed.",
          );
      });
    return () => {
      active = false;
    };
  }, [strategyId]);
  async function save(
    next: Library,
    message = "Saved to this browser",
    reversible = false,
  ) {
    if (lock.current || !ready) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await writeLibrary(strategyId, next);
      setUndo(reversible ? library : null);
      setLibrary(next);
      setNotice(message);
      return true;
    } catch {
      setError(
        "Could not save. Your previous library is intact. Free up browser storage and try again.",
      );
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const revision =
    library.revisions.find((v) => v.id === selected) ||
    library.revisions.find((v) => v.id === library.preferred) ||
    library.revisions[0];
  const total =
    library.revisions.length +
    library.screenshots.length +
    library.videos.length;
  return (
    <div className="pw">
      <div className="pw-navigation">
        <div className="pw-tabs" aria-label="Playbook views">
          <button
            aria-pressed={tab === "workspace"}
            onClick={() => setTab("workspace")}
          >
            My workspace <span>{total}</span>
          </button>
          <button
            aria-pressed={tab === "guide"}
            onClick={() => setTab("guide")}
          >
            Strategy guide
          </button>
        </div>
        <div className="pw-save">
          <span className="pw-dot" />
          {busy
            ? "Saving…"
            : ready
              ? "Stored on this device"
              : "Opening library…"}
        </div>
      </div>
      {error && (
        <p className="pw-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <div className="pw-notice" role="status">
          <Check size={14} />
          {notice}
          {undo && (
            <button
              onClick={async () => {
                if (await save(undo, "Restored")) setUndo(null);
              }}
            >
              Undo removal
            </button>
          )}
          <button
            aria-label="Dismiss notification"
            onClick={() => {
              setNotice("");
              setUndo(null);
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {tab === "guide" ? (
        guide
      ) : (
        <>
          <div className="pw-intro">
            <div>
              <div className="pw-eyebrow">YOUR STRATEGY, IN PROGRESS</div>
              <h2>Build it. Study it. Refine it.</h2>
              <p>
                Keep the code, the proof, and the lessons behind your setup
                together.
              </p>
            </div>
            <button
              className="pw-button"
              disabled={!ready || !total}
              onClick={() =>
                download(
                  JSON.stringify(
                    {
                      strategyId,
                      strategyName,
                      exportedAt: new Date().toISOString(),
                      ...library,
                    },
                    null,
                    2,
                  ),
                  `${strategyId}-library.json`,
                  "application/json",
                )
              }
            >
              <ArrowDownToLine size={15} />
              Export backup
            </button>
          </div>
          <div className="pw-index">
            {[
              [
                Images,
                "01",
                "Chart gallery",
                library.screenshots.length,
                "charts",
              ],
              [Film, "02", "Video library", library.videos.length, "videos"],
              [Code2, "03", "Pine versions", library.revisions.length, "pine"],
            ].map(([Icon, number, label, count, anchor]) => {
              const I = Icon as typeof Code2;
              return (
                <a key={String(anchor)} href={`#${anchor}`}>
                  <I size={20} />
                  <div>
                    <small>{String(number)} / COLLECTION</small>
                    <strong>{String(label)}</strong>
                  </div>
                  <b>{String(count).padStart(2, "0")}</b>
                </a>
              );
            })}
          </div>
          <section className="pw-section" id="charts">
            <SectionHeader
              number="01"
              title="Chart gallery"
              description="Paste a chart with ⌘V / Ctrl+V. Capture the setup and the lesson."
              action="Paste / add chart"
              icon={<ImagePlus size={16} />}
              disabled={!ready || busy}
              onClick={() => setEditor({ kind: "image" })}
            />
            {library.screenshots.length ? (
              <div className="pw-gallery">
                {library.screenshots.map((s) => (
                  <article key={s.id} className="pw-image-card">
                    <button
                      className="pw-image-preview"
                      onClick={() => setLightbox(s)}
                      aria-label={`Enlarge ${s.title}`}
                    >
                      <img src={s.image} alt={s.title} />
                      <Maximize2 size={17} />
                    </button>
                    <div className="pw-card-body">
                      <small>
                        {s.source || "My trade"}
                        {s.versionId &&
                          ` · ${library.revisions.find((v) => v.id === s.versionId)?.title || "Unlinked version"}`}
                      </small>
                      <h3>{s.title}</h3>
                      <p>{s.notes}</p>
                      <div className="pw-card-actions">
                        <button
                          aria-label={`Edit ${s.title}`}
                          onClick={() => setEditor({ kind: "image", id: s.id })}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          disabled={busy}
                          aria-label={`Remove ${s.title}`}
                          onClick={() =>
                            save(
                              {
                                ...library,
                                screenshots: library.screenshots.filter(
                                  (item) => item.id !== s.id,
                                ),
                              },
                              "Screenshot removed",
                              true,
                            )
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <Empty
                icon={<Images size={30} />}
                title="Collect the moments that make it click."
                text="Copy an image, then press ⌘V / Ctrl+V here. Add your observations, credit the trader, and connect it to a Pine version."
                action="Add a chart screenshot"
                onClick={() => setEditor({ kind: "image" })}
                disabled={!ready}
              />
            )}
          </section>
          <section className="pw-section" id="videos">
            <SectionHeader
              number="02"
              title="Video library"
              description="Watch closely. Capture the lesson. Make it part of your process."
              action="Add video"
              icon={<Plus size={16} />}
              disabled={!ready || busy}
              onClick={() => setEditor({ kind: "video" })}
            />
            {library.videos.length ? (
              <VideoLibrary
                videos={library.videos}
                busy={busy}
                onReorder={(videos) => {
                  void save({ ...library, videos }, "Video order saved");
                }}
                onAdd={() => setEditor({ kind: "video" })}
                onEdit={(id) => setEditor({ kind: "video", id })}
                onRemove={(id) => {
                  void save(
                    {
                      ...library,
                      videos: library.videos.filter((v) => v.id !== id),
                    },
                    "Video removed",
                    true,
                  );
                }}
              />
            ) : (
              <Empty
                icon={<Film size={30} />}
                title="Good lessons deserve a place to live."
                text="Add Instagram Reels, TikTok, YouTube, Vimeo, or direct MP4 / WebM links. Watch here and arrange them in the order you want to study."
                action="Add your first video"
                onClick={() => setEditor({ kind: "video" })}
                disabled={!ready}
              />
            )}
            <p className="pw-footnote">
              Embedded playback depends on the creator’s privacy and embed
              settings. The original link is always available.
            </p>
          </section>
          <section className="pw-section" id="pine">
            <SectionHeader
              number="03"
              title="Pine versions"
              description="A clear history of how your strategy evolves."
              action="New version"
              icon={<Plus size={16} />}
              disabled={!ready || busy}
              onClick={() => setEditor({ kind: "code" })}
            />
            {library.revisions.length ? (
              <div className="pw-code-layout">
                <aside className="pw-version-list" aria-label="Saved versions">
                  {library.revisions.map((v) => (
                    <button
                      key={v.id}
                      aria-pressed={v.id === revision?.id}
                      onClick={() => setSelected(v.id)}
                    >
                      <div>
                        <GitBranch size={15} />
                        <strong>{v.title}</strong>
                        {library.preferred === v.id && (
                          <Star size={13} className="pw-star" />
                        )}
                      </div>
                      <span
                        className={`pw-status pw-status-${v.status.toLowerCase()}`}
                      >
                        {v.status}
                      </span>
                      <small>
                        {new Date(v.createdAt).toLocaleDateString()}
                      </small>
                    </button>
                  ))}
                </aside>
                {revision && (
                  <div className="pw-code-panel">
                    <div className="pw-code-toolbar">
                      <span>
                        <Code2 size={15} />
                        {revision.title}.pine
                      </span>
                      <div>
                        <button
                          title="Copy code"
                          aria-label="Copy code"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(
                                revision.code,
                              );
                              setNotice("Code copied");
                            } catch {
                              setError(
                                "Clipboard is unavailable. Download the Pine file instead.",
                              );
                            }
                          }}
                        >
                          <Copy size={15} />
                        </button>
                        <button
                          aria-label="Download Pine file"
                          onClick={() =>
                            download(
                              revision.code,
                              `${revision.title.replace(/[^a-z0-9_-]/gi, "-")}.pine`,
                            )
                          }
                        >
                          <ArrowDownToLine size={15} />
                        </button>
                        <button
                          disabled={busy}
                          aria-label="Edit version"
                          onClick={() =>
                            setEditor({ kind: "code", id: revision.id })
                          }
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          disabled={busy}
                          aria-label="Remove version"
                          onClick={() =>
                            save(
                              {
                                ...library,
                                revisions: library.revisions.filter(
                                  (v) => v.id !== revision.id,
                                ),
                                preferred:
                                  library.preferred === revision.id
                                    ? null
                                    : library.preferred,
                                screenshots: library.screenshots.map((s) =>
                                  s.versionId === revision.id
                                    ? { ...s, versionId: "" }
                                    : s,
                                ),
                              },
                              "Version removed",
                              true,
                            )
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                    <pre className="pw-code">
                      <code>
                        {revision.code.split("\n").map((line, i) => (
                          <span
                            key={i}
                            className={
                              line.trim().startsWith("//") ? "pw-comment" : ""
                            }
                          >
                            <i aria-hidden="true">{i + 1}</i>
                            {line || " "}
                          </span>
                        ))}
                      </code>
                    </pre>
                    <div className="pw-code-footer">
                      <p>{revision.notes || "No revision notes yet."}</p>
                      <button
                        className="pw-button"
                        disabled={busy || library.preferred === revision.id}
                        onClick={() =>
                          save({ ...library, preferred: revision.id })
                        }
                      >
                        <Star size={14} />
                        {library.preferred === revision.id
                          ? "Preferred version"
                          : "Set as preferred"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Empty
                icon={<Code2 size={30} />}
                title="Your next iteration starts here."
                text="Paste Pine Script or import a .pine file. Name each revision, track what changed, and keep your preferred version within reach."
                action="Add your first version"
                onClick={() => setEditor({ kind: "code" })}
                disabled={!ready}
                extra={
                  <div className="pw-code-ghost">
                    <span>{"// Your setup. Your rules."}</span>
                    <br />
                    strategy(<em>"Your next iteration"</em>)<br />
                    <span>{"// Add your Pine Script to begin"}</span>
                  </div>
                }
              />
            )}
          </section>
          <footer className="pw-bottom">
            <span>Made for your process. Built one observation at a time.</span>
            <span>Local library · Export a backup to keep a copy</span>
          </footer>
        </>
      )}
      {editor && (
        <LibraryEditor
          editor={editor}
          library={library}
          busy={busy}
          onClose={() => setEditor(null)}
          onSave={async (next) => {
            if (await save(next)) setEditor(null);
            else
              throw new Error(
                "Could not save. Free up browser storage and try again.",
              );
          }}
        />
      )}
      {lightbox && (
        <Modal title={lightbox.title} onClose={() => setLightbox(null)} wide>
          <img
            className="pw-lightbox"
            src={lightbox.image}
            alt={lightbox.title}
          />
          <p>
            {lightbox.source} · {lightbox.notes}
          </p>
        </Modal>
      )}
    </div>
  );
}
function SectionHeader({
  number,
  title,
  description,
  action,
  icon,
  disabled,
  onClick,
}: {
  number: string;
  title: string;
  description: string;
  action: string;
  icon: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <header className="pw-section-header">
      <div className="pw-section-heading">
        <span className="pw-number">{number}</span>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      <button className="pw-button" disabled={disabled} onClick={onClick}>
        {icon}
        {action}
      </button>
    </header>
  );
}
function Empty({
  icon,
  title,
  text,
  action,
  onClick,
  disabled,
  extra,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  action: string;
  onClick: () => void;
  disabled: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <div className="pw-empty">
      <div className="pw-empty-icon">{icon}</div>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
        <button
          className="pw-text-button"
          disabled={disabled}
          onClick={onClick}
        >
          {action}
          <ArrowRight size={14} />
        </button>
      </div>
      {extra}
    </div>
  );
}
function Modal({
  title,
  children,
  onClose,
  wide,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => {
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`pw-modal ${wide ? "pw-modal-wide" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="pw-modal-inner">
        <header>
          <div>
            <span className="pw-eyebrow">PLAYBOOK LIBRARY</span>
            <h2>{title}</h2>
          </div>
          <button type="button" aria-label="Close dialog" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
function LibraryEditor({
  editor,
  library,
  busy,
  onClose,
  onSave,
}: {
  editor: NonNullable<Editor>;
  library: Library;
  busy: boolean;
  onClose: () => void;
  onSave: (next: Library) => Promise<void>;
}) {
  const existing =
    editor.kind === "code"
      ? library.revisions.find((x) => x.id === editor.id)
      : editor.kind === "image"
        ? library.screenshots.find((x) => x.id === editor.id)
        : library.videos.find((x) => x.id === editor.id);
  const [title, setTitle] = useState(existing?.title || "");
  const [notes, setNotes] = useState(existing?.notes || "");
  const [code, setCode] = useState((existing as Revision)?.code || "");
  const [status, setStatus] = useState<Revision["status"]>(
    (existing as Revision)?.status || "Draft",
  );
  const [source, setSource] = useState(
    (existing as Evidence)?.source || "My trade",
  );
  const [versionId, setVersionId] = useState(
    (existing as Evidence)?.versionId || "",
  );
  const [image, setImage] = useState((existing as Evidence)?.image || "");
  const [url, setUrl] = useState((existing as VideoReference)?.url || "");
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  async function readFile(file?: File) {
    if (!file) return;
    setError("");
    setReading(true);
    try {
      if (editor.kind === "code") {
        if (!/\.(pine|txt)$/i.test(file.name) || file.size > 2 * 1024 * 1024)
          throw new Error("Choose a .pine or .txt file under 2 MB.");
        setCode(await file.text());
      } else {
        if (
          !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(
            file.type,
          ) ||
          file.size > 10 * 1024 * 1024
        )
          throw new Error("Choose a PNG, JPG, WebP, or GIF under 10 MB.");
        const data = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.onerror = reject;
          r.readAsDataURL(file);
        });
        await new Promise<void>((resolve, reject) => {
          const img = new window.Image();
          img.onload = () => resolve();
          img.onerror = () =>
            reject(
              new Error("The image could not be read. Choose another file."),
            );
          img.src = data;
        });
        setImage(data);
      }
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
    } catch (e) {
      setError(e instanceof Error ? e.message : "This file could not be read.");
    } finally {
      setReading(false);
    }
  }
  useEffect(() => {
    if (editor.file) void readFile(editor.file);
    // The editor is mounted once for the selected clipboard image.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor.file]);
  async function pasteClipboard() {
    try {
      if (!navigator.clipboard?.read)
        throw new Error("Use ⌘V / Ctrl+V in this dialog to paste an image.");
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((type) => type.startsWith("image/"));
        if (type) {
          await readFile(
            new File([await item.getType(type)], "Pasted chart.png", { type }),
          );
          return;
        }
      }
      setError(
        "No image found. Copy the image itself, then press ⌘V / Ctrl+V here.",
      );
    } catch {
      setError(
        "Clipboard access unavailable. Press ⌘V / Ctrl+V in this dialog to paste your image.",
      );
    }
  }
  return (
    <Modal
      title={`${editor.id ? "Edit" : "Add"} ${editor.kind === "code" ? "Pine version" : editor.kind === "image" ? "chart screenshot" : "video reference"}`}
      onClose={() => {
        if (!busy) onClose();
      }}
      wide={editor.kind === "code"}
    >
      <form
        onPaste={(event) => {
          if (editor.kind !== "image" || busy || reading) return;
          const file = Array.from(event.clipboardData.items)
            .find((item) => item.type.startsWith("image/"))
            ?.getAsFile();
          if (file) {
            event.preventDefault();
            void readFile(file);
          }
        }}
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            if (!title.trim()) return setError("Add a title.");
            const id = editor.id || makeId();
            if (editor.kind === "code") {
              if (!code.trim())
                return setError(
                  "Paste your Pine Script or import a file first.",
                );
              const item: Revision = {
                id,
                title: title.trim(),
                notes,
                code,
                status,
                createdAt:
                  (existing as Revision)?.createdAt || new Date().toISOString(),
              };
              await onSave({
                ...library,
                revisions: editor.id
                  ? library.revisions.map((v) => (v.id === id ? item : v))
                  : [item, ...library.revisions],
              });
            } else if (editor.kind === "image") {
              if (!image) return setError("Choose a screenshot first.");
              const item: Evidence = {
                id,
                title: title.trim(),
                notes,
                image,
                source,
                versionId,
              };
              await onSave({
                ...library,
                screenshots: editor.id
                  ? library.screenshots.map((v) => (v.id === id ? item : v))
                  : [...library.screenshots, item],
              });
            } else {
              if (!videoSource(url.trim()))
                return setError(
                  "Use an HTTPS Instagram post/Reel, TikTok full video link, YouTube, Vimeo, or direct MP4 / WebM URL.",
                );
              const item: VideoReference = {
                id,
                title: title.trim(),
                notes,
                url: url.trim(),
              };
              await onSave({
                ...library,
                videos: editor.id
                  ? library.videos.map((v) => (v.id === id ? item : v))
                  : [...library.videos, item],
              });
            }
          } catch (e) {
            setError(
              e instanceof Error
                ? e.message
                : "Could not save. Please try again.",
            );
          }
        }}
      >
        <fieldset disabled={busy || reading}>
          <label>
            Title
            <input
              autoFocus
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                editor.kind === "code"
                  ? "e.g. v1.3 — Volume confirmation"
                  : editor.kind === "image"
                    ? "e.g. NQ · clean morning pullback"
                    : "e.g. The VWAP entry that finally clicked"
              }
            />
          </label>
          {editor.kind === "code" && (
            <>
              <div className="pw-form-row">
                <label>
                  Stage
                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(e.target.value as Revision["status"])
                    }
                  >
                    <option>Draft</option>
                    <option>Testing</option>
                    <option>Ready</option>
                  </select>
                </label>
                <label>
                  Import Pine file
                  <input
                    type="file"
                    accept=".pine,.txt"
                    onChange={(e) => void readFile(e.target.files?.[0])}
                  />
                </label>
              </div>
              <label>
                Pine Script
                <textarea
                  className="pw-editor"
                  spellCheck={false}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Paste your TradingView Pine Script here…"
                />
              </label>
              <p className="pw-footnote">
                Code is stored as a reference. Compile and backtest it in
                TradingView.
              </p>
            </>
          )}
          {editor.kind === "image" && (
            <>
              <button
                type="button"
                className="pw-paste-button"
                onClick={() => void pasteClipboard()}
              >
                <ImagePlus size={22} />
                <span>
                  Paste image from clipboard
                  <small>Or press ⌘V / Ctrl+V anywhere in this dialog</small>
                </span>
              </button>
              <label
                className="pw-upload"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void readFile(e.dataTransfer.files[0]);
                }}
              >
                <ImagePlus size={24} />
                Or choose / drop a screenshot
                <span>PNG, JPG, WebP, GIF · up to 10 MB</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(e) => void readFile(e.target.files?.[0])}
                />
              </label>
              {image && (
                <img
                  className="pw-upload-preview"
                  src={image}
                  alt="Screenshot preview"
                />
              )}
              <div className="pw-form-row">
                <label>
                  Attribution
                  <input
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder="My trade, @creator, or source"
                  />
                </label>
                <label>
                  Related Pine version
                  <select
                    value={versionId}
                    onChange={(e) => setVersionId(e.target.value)}
                  >
                    <option value="">No linked version</option>
                    {library.revisions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </>
          )}
          {editor.kind === "video" && (
            <>
              <label>
                Video URL
                <input
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.instagram.com/reel/…"
                />
              </label>
              <p className="pw-footnote">
                Instagram · TikTok · YouTube · Vimeo · MP4 / WebM. Use a public
                video link, not embed code. For TikTok, use the full @creator/video link.
              </p>
              {videoSource(url) && (
                <p className="pw-detected">
                  <Check size={14} />
                  {videoSource(url)?.provider} link recognized
                </p>
              )}
            </>
          )}
          <label>
            {editor.kind === "code" ? "What changed?" : "Notes & takeaways"}
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                editor.kind === "code"
                  ? "What are you testing in this revision?"
                  : "What should you notice or remember?"
              }
            />
          </label>
        </fieldset>
        {error && (
          <p className="pw-error" role="alert">
            {error}
          </p>
        )}
        <div className="pw-form-footer">
          <span>
            {reading ? "Reading file…" : "Saved privately in this browser"}
          </span>
          <button
            type="button"
            className="pw-button"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="pw-primary"
            type="submit"
            disabled={busy || reading}
          >
            {busy ? "Saving…" : "Save to playbook"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
