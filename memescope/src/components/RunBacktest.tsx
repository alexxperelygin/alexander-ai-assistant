"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RunBacktest() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [horizon, setHorizon] = useState("24h");
  const [mode, setMode] = useState<"live" | "mock">("live");
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/backtests/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ horizon, dataMode: mode }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-end gap-2">
      <label className="text-xs text-zinc-500">
        Горизонт
        <select className="input" value={horizon} onChange={(e) => setHorizon(e.target.value)}>
          {["1h", "6h", "24h", "3d", "7d"].map((h) => <option key={h}>{h}</option>)}
        </select>
      </label>
      <label className="text-xs text-zinc-500">
        Данные
        <select className="input" value={mode} onChange={(e) => setMode(e.target.value as "live" | "mock")}>
          <option value="live">live</option>
          <option value="mock">mock</option>
        </select>
      </label>
      <button className="btn btn-primary" disabled={busy} onClick={run}>
        {busy ? "Считаю..." : "Запустить backtest"}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
