import { describe, expect, it } from "vitest";
import { nearestUpcomingRace } from "@/lib/races/select";
import { createRaceSchema, raceToRow } from "@/lib/schemas/race";
import { toFieldErrors } from "@/lib/schemas/inputs";

const TODAY = "2026-11-23";
const schema = createRaceSchema(TODAY);
const valid = { name: "가을 마라톤", date: "2027-03-14", location: "서울", distance: "full" };

describe("createRaceSchema: 대회 직접 입력", () => {
  it("정상 입력은 통과하고 저장 칸으로 바뀐다", () => {
    const parsed = schema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(raceToRow(parsed.data)).toEqual({
        name: "가을 마라톤",
        race_date: "2027-03-14",
        location: "서울",
        distance_label: "풀 마라톤(42.195km)",
        source: "manual",
      });
    }
  });

  it("오늘 날짜는 허용하고 어제는 거부한다 (지난 날짜 차단)", () => {
    expect(schema.safeParse({ ...valid, date: TODAY }).success).toBe(true);
    const past = schema.safeParse({ ...valid, date: "2026-11-22" });
    expect(past.success).toBe(false);
    if (!past.success) expect(toFieldErrors(past.error).fieldErrors.date?.[0]).toContain("지난 날짜");
  });

  it("2년(730일)을 넘는 날짜는 거부한다 (730일째는 통과)", () => {
    expect(schema.safeParse({ ...valid, date: "2028-11-22" }).success).toBe(true);
    expect(schema.safeParse({ ...valid, date: "2028-11-23" }).success).toBe(false);
  });

  it("없는 날짜나 형식이 다른 날짜는 거부한다", () => {
    for (const date of ["2027-02-30", "2027/03/14", "", "내일"]) {
      expect(schema.safeParse({ ...valid, date }).success, date).toBe(false);
    }
  });

  it("대회명이 비었거나(공백 포함) 100자를 넘으면 거부한다", () => {
    expect(schema.safeParse({ ...valid, name: "   " }).success).toBe(false);
    expect(schema.safeParse({ ...valid, name: "가".repeat(100) }).success).toBe(true);
    expect(schema.safeParse({ ...valid, name: "가".repeat(101) }).success).toBe(false);
  });

  it("장소는 비워 둘 수 있고, 비우면 null로 저장한다", () => {
    const parsed = schema.safeParse({ ...valid, location: "" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(raceToRow(parsed.data).location).toBeNull();
    expect(schema.safeParse({ name: valid.name, date: valid.date, distance: "10k" }).success).toBe(true);
  });

  it("목록에 없는 종목과 정해진 칸 밖의 값(코스 설명 등)은 거부한다", () => {
    expect(schema.safeParse({ ...valid, distance: "ultra" }).success).toBe(false);
    expect(schema.safeParse({ ...valid, courseNote: "언덕 많음" }).success).toBe(false);
  });
});

describe("nearestUpcomingRace", () => {
  const races = [
    { id: "a", name: "지난 대회", race_date: "2026-11-01" },
    { id: "b", name: "먼 대회", race_date: "2027-05-01" },
    { id: "c", name: "가까운 대회", race_date: "2027-01-10" },
    { id: "d", name: "오늘 대회", race_date: "2026-11-23" },
  ];

  it("오늘 이후 중 가장 가까운 대회를 고른다 (오늘 포함)", () => {
    expect(nearestUpcomingRace(races, TODAY)?.id).toBe("d");
    expect(nearestUpcomingRace(races, "2026-11-24")?.id).toBe("c");
  });

  it("미래 대회가 없으면 null이다", () => {
    expect(nearestUpcomingRace(races, "2027-06-01")).toBeNull();
    expect(nearestUpcomingRace([], TODAY)).toBeNull();
  });
});
