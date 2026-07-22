"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PositionActions({ positionId }: { positionId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function close(fraction: number) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/positions/${positionId}/close`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fraction }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1">
      <button className="btn text-xs" disabled={busy} onClick={() => close(0.5)}>−50%</button>
      <button className="btn btn-danger text-xs" disabled={busy} onClick={() => close(1)}>Закрыть</button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
