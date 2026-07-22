import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "MemeScope AI",
  description:
    "Research MVP: Solana meme-coin scanner with transparent scoring and paper trading. Not financial advice.",
};

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/scanner", label: "Live Scanner" },
  { href: "/positions", label: "Positions" },
  { href: "/signals", label: "Signal History" },
  { href: "/backtests", label: "Backtests" },
  { href: "/settings", label: "Settings" },
  { href: "/health", label: "System Health" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <div className="flex min-h-screen">
          <aside className="w-52 shrink-0 border-r border-zinc-800 bg-zinc-950 p-4">
            <div className="mb-6">
              <div className="text-lg font-bold text-zinc-100">MemeScope AI</div>
              <div className="text-xs text-zinc-500">research MVP · paper only</div>
            </div>
            <nav className="space-y-1">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="block rounded px-2 py-1.5 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="mt-8 rounded border border-amber-900/50 bg-amber-950/30 p-2 text-[11px] leading-snug text-amber-500">
              Исследовательский инструмент. Не гарантирует прибыль. Реальные сделки
              подтверждаете и исполняете только вы.
            </div>
          </aside>
          <main className="flex-1 overflow-x-auto p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
