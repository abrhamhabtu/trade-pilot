"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ExternalLink,
  Film,
  GripHorizontal,
  Maximize2,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  RotateCw,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { moveItem, VideoReference, videoSource } from "@/lib/playbookLibrary";

type Props = {
  videos: VideoReference[];
  busy: boolean;
  onReorder: (videos: VideoReference[]) => void;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
};
export function VideoLibrary(props: Props) {
  const [active, setActive] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("All");
  const [dragging, setDragging] = useState("");
  const visible = props.videos.filter(
    (v) =>
      (provider === "All" || videoSource(v.url)?.provider === provider) &&
      `${v.title} ${v.notes}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="pw-video-filters">
        <input
          aria-label="Search video library"
          placeholder="Search videos & takeaways…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div>
          {[
            "All",
            ...Array.from(
              new Set(
                props.videos.map(
                  (v) => videoSource(v.url)?.provider || "Video",
                ),
              ),
            ),
          ].map((name) => (
            <button
              key={name}
              aria-pressed={provider === name}
              onClick={() => setProvider(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <span>{visible.length} references</span>
      </div>
      <div className="pw-video-grid">
        {visible.map((v) => {
          const source = videoSource(v.url);
          const index = props.videos.findIndex((item) => item.id === v.id);
          return (
            <article
              className={`pw-reel-card ${dragging === v.id ? "is-dragging" : ""}`}
              key={v.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragging && !props.busy)
                  props.onReorder(moveItem(props.videos, dragging, index));
                setDragging("");
              }}
            >
              <div className="pw-reel-header">
                <button
                  draggable={!props.busy}
                  aria-label={`Drag ${v.title} to reorder`}
                  onDragStart={(e) => {
                    setDragging(v.id);
                    e.dataTransfer.setData("text/plain", v.id);
                  }}
                  onDragEnd={() => setDragging("")}
                >
                  <GripHorizontal size={16} />
                </button>
                <span>{source?.provider}</span>
                <div>
                  <button
                    aria-label={`Move ${v.title} left`}
                    disabled={props.busy || index === 0}
                    onClick={() =>
                      props.onReorder(moveItem(props.videos, v.id, index - 1))
                    }
                  >
                    <ArrowLeft size={14} />
                  </button>
                  <button
                    aria-label={`Move ${v.title} right`}
                    disabled={props.busy || index === props.videos.length - 1}
                    onClick={() =>
                      props.onReorder(moveItem(props.videos, v.id, index + 1))
                    }
                  >
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
              <div className="pw-reel-preview">
                {!active && source ? (
                  source.native ? (
                    <video
                      src={source.src}
                      controls
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <iframe
                      loading="lazy"
                      src={source.src}
                      title={`${v.title} preview`}
                      allow="encrypted-media; fullscreen; picture-in-picture"
                      allowFullScreen
                    />
                  )
                ) : (
                  <Film size={32} />
                )}
              </div>
              <div className="pw-reel-caption">
                <h3>{v.title}</h3>
                <p>
                  {v.notes || "Capture what makes this setup worth studying."}
                </p>
                <button
                  onClick={() => setActive(v.id)}
                  aria-label={`Open ${v.title} and notes`}
                >
                  <Maximize2 size={14} />
                  Watch & notes
                  <span>{v.notes ? "Notes saved" : "+ Add takeaway"}</span>
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {!visible.length && (
        <p className="pw-empty">
          No matching videos. Try another platform or search term.
        </p>
      )}
      {active && props.videos.some((v) => v.id === active) && (
        <VideoDialog onClose={() => setActive(null)}>
          <VideoStudy
            {...props}
            initialId={active}
            onEdit={(id) => {
              setActive(null);
              props.onEdit(id);
            }}
            onRemove={(id) => {
              setActive(null);
              props.onRemove(id);
            }}
            onAdd={() => {
              setActive(null);
              props.onAdd();
            }}
          />
        </VideoDialog>
      )}
    </>
  );
}
function VideoDialog({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => previous?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      className="pw-video-dialog"
      aria-label="Video and takeaways"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="pw-video-dialog-top">
        <span>VIDEO & TAKEAWAYS</span>
        <button onClick={onClose} aria-label="Close video and notes">
          <X size={18} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

function VideoStudy({
  videos,
  busy,
  onReorder,
  onAdd,
  onEdit,
  onRemove,
  initialId,
}: Props & { initialId: string }) {
  const [selected, setSelected] = useState(initialId);
  const [dragging, setDragging] = useState("");
  const [loaded, setLoaded] = useState(initialId);
  const [expanded, setExpanded] = useState(false);
  const item = videos.find((v) => v.id === selected) || videos[0];
  const source = videoSource(item.url);
  const index = videos.findIndex((v) => v.id === item.id);
  return (
    <div className={`pw-studio ${expanded ? "pw-studio-expanded" : ""}`}>
      <div className="pw-studio-header">
        <div>
          <span className="pw-studio-dot" />
          <span>STUDY ROOM</span>
          <span className="pw-studio-divider" />
          <span>
            {String(index + 1).padStart(2, "0")}{" "}
            <span className="pw-subtle">
              / {String(videos.length).padStart(2, "0")}
            </span>
          </span>
        </div>
        <button
          className="pw-button"
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? "Exit focus view" : "Open focus view"}
        >
          {expanded ? <X size={14} /> : <Maximize2 size={14} />}
          {expanded ? "Exit focus" : "Focus view"}
        </button>
      </div>
      <div className="pw-studio-body">
        <div
          className={`pw-screen ${["Instagram", "TikTok"].includes(source?.provider || "") ? "pw-screen-portrait" : ""}`}
        >
          {loaded === item.id && source ? (
            <div className="pw-screen-frame">
              {source.native ? (
                <LocalVideo key={item.id} src={source.src} title={item.title} />
              ) : (
                <iframe
                  key={item.id}
                  title={item.title}
                  src={source.src}
                  allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>
          ) : (
            <button
              className="pw-screen-cover"
              onClick={() => setLoaded(item.id)}
              aria-label={`Play ${item.title}`}
            >
              <span className="pw-provider-tag">
                <Film size={14} />
                {source?.provider || "Video"} reference
              </span>
              <span className="pw-studio-play">
                <Play size={28} fill="currentColor" />
              </span>
              <strong>{item.title}</strong>
              <span>
                Open player <ArrowRight size={14} />
              </span>
            </button>
          )}
          <div className="pw-screen-caption">
            <span>{source?.provider} player</span>
            {loaded === item.id ? (
              <button onClick={() => setLoaded("")}>
                <X size={12} />
                Close player
              </button>
            ) : (
              <span>Ready when you are</span>
            )}
          </div>
        </div>
        <aside className="pw-study-notes">
          <div className="pw-study-meta">
            <span>{source?.provider}</span>
            <span>REFERENCE {String(index + 1).padStart(2, "0")}</span>
          </div>
          <h3>{item.title}</h3>
          <div className="pw-takeaway-heading">
            <BookOpen size={15} />
            <span>Your takeaways</span>
            <button
              aria-label={`Edit notes for ${item.title}`}
              onClick={() => onEdit(item.id)}
            >
              <Pencil size={14} />
            </button>
          </div>
          {item.notes ? (
            <p className="pw-takeaway-text">{item.notes}</p>
          ) : (
            <button className="pw-add-takeaway" onClick={() => onEdit(item.id)}>
              <Plus size={17} />
              <span>
                What makes this worth saving?
                <small>
                  Capture the entry trigger, the context, or the lesson you want
                  to repeat.
                </small>
              </span>
            </button>
          )}
          <div className="pw-study-bottom">
            <p>
              {source?.native
                ? "Play, pause, mute, seek, or replay a moment using the controls below the video."
                : `Use the ${source?.provider || "embedded"} player’s playback and sound controls. Available controls depend on the original video.`}
            </p>
            <a
              className="pw-button"
              href={item.url}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={14} />
              Open original
            </a>
            <div className="pw-study-tools">
              <button onClick={() => onEdit(item.id)}>
                <Pencil size={13} />
                Edit reference
              </button>
              <button
                disabled={busy}
                aria-label={`Remove ${item.title}`}
                onClick={() => onRemove(item.id)}
              >
                <Trash2 size={13} />
                Remove
              </button>
            </div>
          </div>
        </aside>
      </div>
      <div className="pw-queue-heading">
        <div>
          <strong>Your study queue</strong>
          <span>
            {videos.length} {videos.length === 1 ? "reference" : "references"} ·
            Drag to reorder
          </span>
        </div>
        <button className="pw-text-button" disabled={busy} onClick={onAdd}>
          <Plus size={14} />
          Add video
        </button>
      </div>
      <div className="pw-study-queue">
        {videos.map((v, i) => (
          <article
            key={v.id}
            className={`pw-queue-item ${v.id === item.id ? "is-selected" : ""} ${dragging === v.id ? "is-dragging" : ""}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (dragging && !busy) onReorder(moveItem(videos, dragging, i));
              setDragging("");
            }}
          >
            <button
              className="pw-queue-handle"
              draggable={!busy}
              aria-label={`Drag ${v.title} to reorder`}
              onDragStart={(e) => {
                setDragging(v.id);
                e.dataTransfer.setData("text/plain", v.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => setDragging("")}
            >
              <GripHorizontal size={15} />
            </button>
            <button
              className="pw-queue-select"
              aria-pressed={v.id === item.id}
              onClick={() => {
                setSelected(v.id);
                setLoaded("");
              }}
            >
              <span className="pw-queue-thumb">
                {v.id === item.id ? (
                  <Play size={17} />
                ) : (
                  String(i + 1).padStart(2, "0")
                )}
              </span>
              <span>
                <small>{videoSource(v.url)?.provider}</small>
                <strong>{v.title}</strong>
              </span>
            </button>
            <div className="pw-queue-arrows">
              <button
                disabled={busy || i === 0}
                aria-label={`Move ${v.title} left`}
                onClick={() => onReorder(moveItem(videos, v.id, i - 1))}
              >
                <ArrowLeft size={12} />
              </button>
              <button
                disabled={busy || i === videos.length - 1}
                aria-label={`Move ${v.title} right`}
                onClick={() => onReorder(moveItem(videos, v.id, i + 1))}
              >
                <ArrowRight size={12} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function LocalVideo({ src, title }: { src: string; title: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(true);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  function seek(delta: number) {
    const v = ref.current;
    if (v && Number.isFinite(v.duration))
      v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + delta));
  }
  return (
    <div className="pw-local-video">
      <video
        ref={ref}
        src={src}
        controls
        playsInline
        aria-label={title}
        onLoadedMetadata={() => setReady(true)}
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onVolumeChange={() => setMuted(ref.current?.muted || false)}
        onError={() =>
          setError("Unable to load this video. Try the original link.")
        }
      />
      <div className="pw-playback-tools">
        <button
          disabled={!ready}
          aria-label={paused ? "Play video" : "Pause video"}
          onClick={async () => {
            const v = ref.current;
            if (!v) return;
            if (!v.paused) v.pause();
            else
              try {
                await v.play();
                setError("");
              } catch {
                setError(
                  "Playback could not start. Try the video’s built-in play button.",
                );
              }
          }}
        >
          {paused ? <Play size={17} /> : <Pause size={17} />}
        </button>
        <button
          disabled={!ready}
          aria-label="Rewind 10 seconds"
          onClick={() => seek(-10)}
        >
          <RotateCcw size={17} />
          <span>10</span>
        </button>
        <button
          disabled={!ready}
          aria-label="Forward 10 seconds"
          onClick={() => seek(10)}
        >
          <RotateCw size={17} />
          <span>10</span>
        </button>
        <button
          disabled={!ready}
          aria-label={muted ? "Unmute video" : "Mute video"}
          onClick={() => {
            if (ref.current) ref.current.muted = !ref.current.muted;
          }}
        >
          {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
        </button>
      </div>
      {error && (
        <p role="alert" className="pw-error">
          {error}
        </p>
      )}
    </div>
  );
}
