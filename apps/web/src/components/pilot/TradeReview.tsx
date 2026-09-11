"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useAccountStore, type Account } from "@/store/accountStore";
import type { Trade } from "@/store/tradingStore";
import {
  DEFAULT_SETTINGS,
  inspectTrade,
  money,
  prepareReviews,
} from "@/lib/pilot/workspace";
import { requestCoaching, type ModelConfig } from "@/lib/pilot/models";
import { accountContext } from "./PilotCoach";

export function TradeReview({
  trade,
  account,
  model,
  close,
}: {
  trade: Trade;
  account: Account;
  model: ModelConfig;
  close: () => void;
}) {
  const result = inspectTrade(
    trade,
    account.trades,
    account.pilotSettings?.rules || DEFAULT_SETTINGS.rules,
  );
  const [note, setNote] = useState(
    trade.notes || trade.pilotReview?.note || result.note,
  );
  const [tags, setTags] = useState(
    (trade.tags || trade.pilotReview?.tags || result.tags).join(", "),
  );
  const [setup, setSetup] = useState(trade.strategy || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    dialog.current?.showModal();
    return () => controller.current?.abort();
  }, []);
  return (
    <dialog ref={dialog} className="pilot-dialog" onCancel={close}>
      <div className="pilot-dialog-header">
        <div>
          <span className="pilot-eyebrow">
            TRADE REVIEW · {trade.date.slice(0, 10)}
          </span>
          <h2>
            {trade.symbol} <span className="pilot-muted">{trade.side}</span>{" "}
            <span
              className={trade.netPL < 0 ? "pilot-negative" : "pilot-positive"}
            >
              {money(trade.netPL)}
            </span>
          </h2>
        </div>
        <button
          className="pilot-icon-button"
          onClick={close}
          aria-label="Close review"
        >
          <X size={20} />
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const current = useAccountStore
            .getState()
            .accounts.find((a) => a.id === account.id);
          if (!current) {
            setError("Account no longer exists.");
            return;
          }
          const trades = current.trades.map((t) => {
            if (t.id !== trade.id) return t;
            const updated = {
              ...t,
              strategy: setup.trim(),
              notes: note,
              tags: tags
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
            };
            const reviewed = prepareReviews(
              current.trades.map((x) => (x.id === updated.id ? updated : x)),
              current.pilotSettings || DEFAULT_SETTINGS,
              true,
            ).find((x) => x.id === updated.id)!;
            return {
              ...updated,
              pilotReview: {
                ...reviewed.pilotReview!,
                note,
                tags: updated.tags,
                reviewed: true,
              },
            };
          });
          useAccountStore.getState().updateAccount(account.id, { trades });
          close();
        }}
      >
        <div className="pilot-review-facts">
          <span>{trade.quantity} contracts</span>
          <span>{trade.time || "No entry time"}</span>
          <span>{trade.duration} min duration</span>
        </div>
        <div className="pilot-review-checks">
          {result.flags.length ? (
            result.flags.map((f) => (
              <p key={f} className="pilot-warning">
                {f}
              </p>
            ))
          ) : (
            <p>
              <Check size={15} />
              No configured breaches found in available data.
            </p>
          )}
        </div>
        <label>
          Recorded setup
          <input
            value={setup}
            onChange={(e) => setSetup(e.target.value)}
            placeholder="e.g. VWAP reclaim"
            maxLength={150}
          />
        </label>
        <label>
          Tags <span className="pilot-muted">· comma separated</span>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            maxLength={1000}
          />
        </label>
        <div className="pilot-section-title">
          <strong>Journal note</strong>
          <button
            type="button"
            className="pilot-text-link"
            disabled={busy}
            onClick={async () => {
              if (model.provider === "local") {
                setNote(result.note);
                return;
              }
              setBusy(true);
              setError("");
              controller.current = new AbortController();
              try {
                setNote(
                  await requestCoaching(
                    model,
                    [
                      {
                        role: "user",
                        content: `Draft a concise factual journal note for trade ${trade.id}. The target trade is ${JSON.stringify({ ...trade, notes: note, strategy: setup })}. Include rule observations and missing information. Do not invent chart observations or feelings.`,
                      },
                    ],
                    accountContext(account),
                    controller.current.signal,
                  ),
                );
              } catch (e) {
                if (e instanceof Error && e.name !== "AbortError")
                  setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            {model.provider === "local"
              ? "Reset factual draft"
              : "Draft with model"}
          </button>
        </div>
        <textarea
          aria-label="Journal note"
          disabled={busy}
          rows={8}
          maxLength={20000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <p className="pilot-muted pilot-small">
          {model.provider === "local"
            ? "Factual draft from recorded trades. Add your own execution and emotional context."
            : "Draft with model sends this trade and up to 100 recent account trades to your selected provider."}{" "}
          Saving updates this trade’s journal note and tags.
        </p>
        {error && (
          <p role="alert" className="pilot-error">
            {error}
          </p>
        )}
        <div className="pilot-dialog-actions">
          <button type="button" className="pilot-button" onClick={close}>
            Cancel
          </button>
          <button
            className="pilot-button primary"
            type="submit"
            disabled={busy}
          >
            <Check size={15} />
            Save reviewed trade
          </button>
        </div>
      </form>
    </dialog>
  );
}
