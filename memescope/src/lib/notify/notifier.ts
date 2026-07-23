import { prisma } from "../db";
import { config } from "../config";

// Notifications: always stored in-app; optionally mirrored to Telegram when a
// bot token is configured. Failures are recorded in SourceHealth, never thrown.

export async function notify(
  level: "info" | "warning" | "critical",
  title: string,
  body: string,
): Promise<void> {
  await prisma.notification.create({ data: { level, title, body } });

  if (config.telegramBotToken && config.telegramChatId) {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chat_id: config.telegramChatId,
            text: `[${level.toUpperCase()}] ${title}\n\n${body}`,
          }),
          signal: AbortSignal.timeout(10_000),
        },
      );
      await prisma.sourceHealth.upsert({
        where: { source: "telegram" },
        create: { source: "telegram", lastOkAt: res.ok ? new Date() : null, lastErrorAt: res.ok ? null : new Date(), lastError: res.ok ? null : `HTTP ${res.status}`, okCount: res.ok ? 1 : 0, errorCount: res.ok ? 0 : 1 },
        update: res.ok
          ? { lastOkAt: new Date(), okCount: { increment: 1 } }
          : { lastErrorAt: new Date(), lastError: `HTTP ${res.status}`, errorCount: { increment: 1 } },
      });
    } catch (err) {
      await prisma.sourceHealth.upsert({
        where: { source: "telegram" },
        create: { source: "telegram", lastErrorAt: new Date(), lastError: String(err), errorCount: 1 },
        update: { lastErrorAt: new Date(), lastError: String(err), errorCount: { increment: 1 } },
      }).catch(() => {});
    }
  }
}
