import { prisma } from "@/lib/db";
import { config } from "@/lib/config";
import { getRiskSettings } from "@/lib/settings";
import { Card, DataModeBadge, timeAgo } from "@/components/ui";
import { SettingsForm } from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getRiskSettings();
  const sources = await prisma.sourceHealth.findMany({ orderBy: { source: "asc" } });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--txt)" }}>Настройки</h1>
        <p className="text-[11px]" style={{ color: "var(--txt-dim)" }}>пороги риска и отбора</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Капитал и риск">
          <SettingsForm initial={settings} />
        </Card>

        <div className="space-y-4">
          <Card title="Режим данных" right={<DataModeBadge mode={config.dataMode} />}>
            <p className="text-sm text-zinc-400">
              Задаётся переменной окружения <code className="text-zinc-200">DATA_MODE</code> (live | mock)
              и требует перезапуска worker. Mock-данные всегда помечены в интерфейсе.
            </p>
          </Card>

          <Card title="Подключение источников (API connection status)">
            <table className="table-base">
              <thead><tr><th>Источник</th><th>Статус</th><th>Последний успех</th><th>Ошибок</th></tr></thead>
              <tbody>
                {sources.length === 0 && (
                  <tr><td colSpan={4} className="text-zinc-600">Нет данных — worker ещё не обращался к источникам.</td></tr>
                )}
                {sources.map((s) => (
                  <tr key={s.source}>
                    <td>{s.source}</td>
                    <td>
                      {s.lastOkAt && (!s.lastErrorAt || s.lastOkAt > s.lastErrorAt)
                        ? <span className="text-emerald-400">ok</span>
                        : <span className="text-red-400">error</span>}
                    </td>
                    <td className="text-xs text-zinc-500">{s.lastOkAt ? `${timeAgo(s.lastOkAt)} назад` : "—"}</td>
                    <td className="text-xs">{s.errorCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-zinc-500">
              Опциональные ключи (Birdeye, Helius, Telegram) добавляются в .env — см. .env.example и docs/DATA_SOURCES.md.
              Birdeye: {config.birdeyeApiKey ? "ключ задан" : "не подключен"} · Helius: {config.heliusApiKey ? "ключ задан" : "не подключен"} ·
              Telegram: {config.telegramBotToken ? "подключен" : "не подключен"}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
