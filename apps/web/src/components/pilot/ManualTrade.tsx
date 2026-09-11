"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useAccountStore } from "@/store/accountStore";
import { localSessionDate } from "@/lib/sessionRisk";

export function ManualTrade({
  accountId,
  close,
}: {
  accountId: string;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog ref={dialog} className="pilot-dialog" onCancel={close}>
      <div className="pilot-dialog-header">
        <div>
          <span className="pilot-eyebrow">MANUAL ENTRY</span>
          <h2>Log a closed trade.</h2>
        </div>
        <button
          aria-label="Close trade entry"
          className="pilot-icon-button"
          onClick={close}
        >
          <X size={20} />
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          const str = (key: string) => String(data.get(key) || "");
          const num = (key: string) => Number(str(key));
          if (
            !useAccountStore.getState().accounts.some((a) => a.id === accountId)
          ) {
            setError("Account no longer exists.");
            return;
          }
          const result = useAccountStore
            .getState()
            .addTradesToAccount(accountId, [
              {
                id: crypto.randomUUID(),
                date: str("date"),
                time: str("time"),
                symbol: str("symbol").trim().toUpperCase(),
                side: str("side") as "Long" | "Short",
                quantity: num("quantity"),
                entryPrice: num("entry"),
                exitPrice: num("exit"),
                netPL: num("pnl"),
                duration: num("duration"),
                outcome: num("pnl") >= 0 ? "win" : "loss",
                strategy: str("setup").trim(),
                notes: str("notes"),
              },
            ]);
          if (!result.added) {
            setError("An identical trade is already in this account.");
            return;
          }
          close();
        }}
      >
        <div className="pilot-rule-fields">
          <label>
            Symbol
            <input name="symbol" required maxLength={30} placeholder="MNQ" />
          </label>
          <label>
            Direction
            <select name="side">
              <option>Long</option>
              <option>Short</option>
            </select>
          </label>
          <label>
            Date
            <input
              name="date"
              type="date"
              required
              defaultValue={localSessionDate()}
            />
          </label>
          <label>
            Entry time
            <input name="time" type="time" required />
          </label>
          <label>
            Contracts
            <input
              name="quantity"
              type="number"
              required
              min="1"
              step="1"
              defaultValue="1"
            />
          </label>
          <label>
            Duration (minutes)
            <input name="duration" type="number" required min="0" step="any" />
          </label>
          <label>
            Entry price
            <input name="entry" type="number" required min="0" step="any" />
          </label>
          <label>
            Exit price
            <input name="exit" type="number" required min="0" step="any" />
          </label>
          <label>
            Net P&L after fees ($)
            <input name="pnl" type="number" required step="0.01" />
          </label>
          <label>
            Setup
            <input name="setup" maxLength={150} placeholder="Optional" />
          </label>
        </div>
        <label>
          Your observations
          <textarea
            name="notes"
            rows={3}
            maxLength={4000}
            placeholder="What did you see? What would you repeat?"
          />
        </label>
        <p className="pilot-muted pilot-small">
          Use the same timezone as your imported trades. Your account’s enabled
          automations will prepare a draft after saving.
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
          <button type="submit" className="pilot-button primary">
            Save trade
          </button>
        </div>
      </form>
    </dialog>
  );
}
