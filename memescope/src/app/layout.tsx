import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "MemeScope AI",
  description:
    "Исследовательский сканер мем-коинов: прозрачный скоринг и бумажная торговля. Не инвестиционная рекомендация.",
};

const NAV = [
  { href: "/", label: "Обзор", hint: "состояние системы" },
  { href: "/scanner", label: "Сканер", hint: "живой поток оценок" },
  { href: "/positions", label: "Позиции", hint: "сделки и P&L" },
  { href: "/signals", label: "История сигналов", hint: "переходы статусов" },
  { href: "/backtests", label: "Проверка гипотез", hint: "backtest" },
  { href: "/settings", label: "Настройки", hint: "пороги риска и отбора" },
  { href: "/health", label: "Здоровье системы", hint: "источники и процессы" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <div className="relative z-10 flex min-h-screen">
          <aside
            className="w-56 shrink-0 border-r p-4"
            style={{ borderColor: "var(--line)", background: "rgba(3,5,11,0.72)" }}
          >
            <div className="mb-6">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: "var(--n-live)", boxShadow: "0 0 12px var(--n-live)" }}
                />
                <span className="text-base font-bold tracking-tight" style={{ color: "var(--txt)" }}>
                  MemeScope AI
                </span>
              </div>
              <div className="mt-1 text-[11px]" style={{ color: "var(--txt-faint)" }}>
                исследовательский стенд · только бумага
              </div>
            </div>

            <nav className="space-y-0.5">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="nav-link">
                  <span>{n.label}</span>
                  <span className="block text-[10px]" style={{ color: "var(--txt-faint)" }}>
                    {n.hint}
                  </span>
                </Link>
              ))}
            </nav>

            <div
              className="mt-8 rounded-lg border p-2.5 text-[11px] leading-snug"
              style={{
                borderColor: "rgba(251,191,36,0.28)",
                background: "rgba(251,191,36,0.05)",
                color: "#e3bd6a",
              }}
            >
              Исследовательский инструмент. Прибыль не гарантирована. Реальные сделки
              подтверждаете и исполняете только вы.
            </div>
          </aside>

          <main className="flex-1 overflow-x-auto p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
