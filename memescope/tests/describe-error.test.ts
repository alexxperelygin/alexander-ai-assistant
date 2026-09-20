import { describe, expect, it } from "vitest";
import { describeError } from "../src/lib/describe-error";

describe("describeError", () => {
  it("добавляет код ошибки Prisma, которого нет в String(err)", () => {
    // Настоящая причина прошлой неудачи: у ошибок Prisma код лежит в свойстве,
    // а toString его не печатает — в журнале оставалось сообщение без кода.
    const err = Object.assign(new Error("Invalid `prisma.position.findMany()` invocation"), { code: "P2024" });
    expect(String(err)).not.toContain("P2024");
    expect(describeError(err)).toContain("[P2024]");
  });

  it("обычную ошибку не портит", () => {
    expect(describeError(new Error("что-то пошло не так"))).toBe("Error: что-то пошло не так");
  });

  it("переживает не-ошибки и пустой код", () => {
    expect(describeError("строка")).toBe("строка");
    expect(describeError(null)).toBe("null");
    expect(describeError(Object.assign(new Error("x"), { code: "" }))).toBe("Error: x");
    expect(describeError(Object.assign(new Error("x"), { code: 42 }))).toBe("Error: x");
  });
});
