"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Client actions on an opportunity card: open a simulated paper position, or
// register a real manual purchase ("I bought") the user executed themselves.

export function BuyActions({
  opportunityId,
  suggestedSizeUsd,
  canOpen,
}: {
  opportunityId: string;
  suggestedSizeUsd: number;
  canOpen: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLive, setShowLive] = useState(false);
  const [live, setLive] = useState({ priceUsd: "", quantity: "", feesUsd: "" });

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/positions/open", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`);
      return;
    }
    router.push("/positions");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          className="btn btn-primary"
          disabled={busy || !canOpen}
          onClick={() => post({ opportunityId, mode: "paper", sizeUsd: suggestedSizeUsd })}
        >
          Открыть paper-позицию (${suggestedSizeUsd.toFixed(0)})
        </button>
        <button className="btn" disabled={busy || !canOpen} onClick={() => setShowLive((v) => !v)}>
          I bought (ручная покупка)
        </button>
      </div>
      {!canOpen && (
        <p className="text-xs text-zinc-500">
          Открытие доступно только для статусов READY/CANDIDATE без hard-rejection.
        </p>
      )}
      {showLive && (
        <div className="card space-y-2">
          <p className="text-xs text-zinc-400">
            Введи фактические параметры своей сделки — система начнёт сопровождение.
          </p>
          <div className="grid grid-cols-3 gap-2">
            <label className="text-xs text-zinc-500">
              Цена входа, $
              <input className="input" value={live.priceUsd}
                onChange={(e) => setLive({ ...live, priceUsd: e.target.value })} />
            </label>
            <label className="text-xs text-zinc-500">
              Количество токенов
              <input className="input" value={live.quantity}
                onChange={(e) => setLive({ ...live, quantity: e.target.value })} />
            </label>
            <label className="text-xs text-zinc-500">
              Комиссии, $
              <input className="input" value={live.feesUsd}
                onChange={(e) => setLive({ ...live, feesUsd: e.target.value })} />
            </label>
          </div>
          <button
            className="btn btn-primary"
            disabled={busy || !live.priceUsd || !live.quantity}
            onClick={() =>
              post({
                opportunityId,
                mode: "live",
                actualPriceUsd: parseFloat(live.priceUsd),
                actualQuantity: parseFloat(live.quantity),
                actualFeesUsd: parseFloat(live.feesUsd || "0"),
              })
            }
          >
            Подтвердить покупку
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
