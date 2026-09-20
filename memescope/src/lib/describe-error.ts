/**
 * Текст ошибки вместе с её кодом.
 *
 * `String(err)` у ошибок Prisma печатает сообщение, но НЕ код: он лежит в
 * свойстве `code` и в строку не попадает. 20 сентября это стоило целого
 * захода вхолостую — в журнале нашлись три ошибки Prisma подряд в разных
 * операциях, и отличить состязание за базу (P2024, P1008) от ошибки в самом
 * запросе (P2002 и подобные) было нечем: в записи кода просто не было.
 *
 * Код ставится в начало, чтобы его было видно и в обрезанной строке отчёта.
 */
export function describeError(err: unknown): string {
  const text = String(err);
  const code = typeof err === "object" && err !== null && "code" in err ? (err as { code?: unknown }).code : undefined;
  return typeof code === "string" && code ? `[${code}] ${text}` : text;
}
