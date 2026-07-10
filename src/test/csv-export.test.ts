import { describe, it, expect } from "vitest";
import { toCsv } from "@/lib/csv-export";

describe("toCsv", () => {
  it("separa por ; com BOM e escapa aspas/;/quebras", () => {
    const csv = toCsv(["a", "b"], [["x;y", 10], ['diz "oi"', null]]);
    const lines = csv.split("\n");
    expect(lines[0].endsWith("a;b")).toBe(true);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(lines[1]).toBe('"x;y";10');
    expect(lines[2]).toBe('"diz ""oi""";');
  });
});
