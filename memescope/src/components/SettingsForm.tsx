"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RiskSettings } from "@/lib/types";

const FIELDS: { key: keyof RiskSettings; label: string; kind: "number" | "boolean" }[] = [
  { key: "capitalUsd", label: "Капитал, $", kind: "number" },
  { key: "maxRiskPerTradePct", label: "Риск на сделку, % капитала", kind: "number" },
  { key: "maxPositionUsd", label: "Макс. позиция, $", kind: "number" },
  { key: "maxTotalExposureUsd", label: "Макс. суммарная экспозиция, $", kind: "number" },
  { key: "dailyLossLimitUsd", label: "Дневной лимит потерь, $", kind: "number" },
  { key: "cooldownAfterLosses", label: "Cooldown после N убытков подряд", kind: "number" },
  { key: "cooldownMinutes", label: "Длительность cooldown, мин", kind: "number" },
  { key: "maxSlippagePct", label: "Макс. slippage, %", kind: "number" },
  { key: "maxPositionPctOfLiquidity", label: "Макс. позиция, % от ликвидности пула", kind: "number" },
  { key: "minLiquidityUsd", label: "Мин. ликвидность токена, $", kind: "number" },
  { key: "minTokenAgeMin", label: "Мин. возраст токена, мин", kind: "number" },
  { key: "maxTokenAgeMin", label: "Макс. возраст токена, мин", kind: "number" },
  { key: "paperTradingEnabled", label: "Paper trading включён", kind: "boolean" },
  { key: "signalsPaused", label: "ПАУЗА: остановить новые сигналы (kill switch)", kind: "boolean" },
];

export function SettingsForm({ initial }: { initial: RiskSettings }) {
  const router = useRouter();
  const [s, setS] = useState<RiskSettings>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(s),
    });
    setBusy(false);
    setMsg(res.ok ? "Сохранено." : "Ошибка сохранения.");
    router.refresh();
  }

  return (
    <div className="max-w-xl space-y-3">
      {FIELDS.map((f) => (
        <label key={f.key} className="flex items-center justify-between gap-4 text-sm">
          <span className="text-zinc-400">{f.label}</span>
          {f.kind === "number" ? (
            <input
              type="number"
              step="any"
              className="input w-32"
              value={String(s[f.key])}
              onChange={(e) => setS({ ...s, [f.key]: parseFloat(e.target.value) || 0 })}
            />
          ) : (
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={Boolean(s[f.key])}
              onChange={(e) => setS({ ...s, [f.key]: e.target.checked })}
            />
          )}
        </label>
      ))}
      <div className="flex items-center justify-between rounded border border-red-900/50 bg-red-950/30 p-2 text-sm">
        <span className="text-red-400">Live trading (автоисполнение реальных сделок)</span>
        <span className="text-xs font-bold text-red-400">ОТКЛЮЧЕНО НА ЭТАПЕ 1</span>
      </div>
      <button className="btn btn-primary" disabled={busy} onClick={save}>Сохранить</button>
      {msg && <span className="ml-2 text-xs text-zinc-400">{msg}</span>}
      <p className="text-xs text-zinc-600">
        Лимиты снижают, но не устраняют риск потерь. Мем-коины могут обесцениться полностью и мгновенно.
      </p>
    </div>
  );
}
