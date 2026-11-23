import { describe, expect, it } from "vitest";
import { readLogForm } from "@/lib/log/forms";
import { createRunRecordSchema, painListSchema } from "@/lib/schemas/inputs";

const TODAY = "2026-11-23";
const schema = createRunRecordSchema(TODAY);

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}
const ok = { date: "2026-11-22", distanceKm: "5", durationMinutes: "32" };

function parseRun(values: Record<string, string>) {
  return schema.safeParse(readLogForm(form(values), true).run);
}

describe("훈련 후 기록 입력 검사", () => {
  it("정상 기록은 통과하고 문자열 숫자가 숫자로 바뀐다", () => {
    const parsed = parseRun(ok);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toEqual({ date: "2026-11-22", distanceKm: 5, durationMinutes: 32 });
  });

  it("오늘 날짜는 허용하고 내일은 거부한다", () => {
    expect(parseRun({ ...ok, date: TODAY }).success).toBe(true);
    expect(parseRun({ ...ok, date: "2026-11-24" }).success).toBe(false);
  });

  it("빈 칸은 0이 아니라 오류가 된다", () => {
    for (const key of ["date", "distanceKm", "durationMinutes"]) {
      expect(parseRun({ ...ok, [key]: "  " }).success, key).toBe(false);
    }
  });

  it("비정상 값은 거부한다: 0·음수·100km 초과·숫자 아님·너무 빠르거나 느린 페이스", () => {
    for (const distanceKm of ["0", "-3", "100.5", "abc"]) {
      expect(parseRun({ ...ok, distanceKm }).success, `거리 ${distanceKm}`).toBe(false);
    }
    for (const durationMinutes of ["0", "-5", "1441", "x"]) {
      expect(parseRun({ ...ok, durationMinutes }).success, `시간 ${durationMinutes}`).toBe(false);
    }
    expect(parseRun({ ...ok, distanceKm: "42", durationMinutes: "20" }).success).toBe(false); // 너무 빠름
    expect(parseRun({ ...ok, distanceKm: "1", durationMinutes: "600" }).success).toBe(false); // 너무 느림
  });
});

describe("readLogForm: 통증 입력", () => {
  it("동의한 사용자는 통증을 읽고 목록 검사를 통과한다", () => {
    const { pains } = readLogForm(form({ ...ok, pain_knee: "mild", pain_calf: "severe", pain_ankle: "" }), true);
    expect(pains).toEqual([
      { part: "knee", intensity: "mild" },
      { part: "calf", intensity: "severe" },
    ]);
    expect(painListSchema.safeParse(pains).success).toBe(true);
  });

  it("통증이 없으면(모두 없음) 빈 목록이다", () => {
    expect(readLogForm(form(ok), true).pains).toEqual([]);
  });

  it("동의하지 않은 사용자의 통증 값은 무시한다", () => {
    expect(readLogForm(form({ ...ok, pain_knee: "severe" }), false).pains).toEqual([]);
  });

  it("목록에 없는 강도는 거부한다", () => {
    const { pains } = readLogForm(form({ ...ok, pain_knee: "huge" }), true);
    expect(painListSchema.safeParse(pains).success).toBe(false);
  });
});
