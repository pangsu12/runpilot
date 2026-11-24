import { describe, expect, it } from "vitest";
import { mondayOf, needsWeeklyRefresh } from "@/lib/plans/weekly";

// 2026-11-23은 월요일, 2026-11-29는 일요일. 한국 시간(UTC+9) 기준으로 시험한다.
describe("mondayOf", () => {
  it("그 주의 월요일을 돌려준다", () => {
    expect(mondayOf("2026-11-23")).toBe("2026-11-23");
    expect(mondayOf("2026-11-25")).toBe("2026-11-23");
    expect(mondayOf("2026-11-29")).toBe("2026-11-23");
    expect(mondayOf("2026-11-30")).toBe("2026-11-30");
  });
});

describe("needsWeeklyRefresh: 이번 주 첫 접속인지", () => {
  const wed = new Date("2026-11-25T03:00:00Z"); // 한국 수요일 낮

  it("이번 주에 이미 만들었으면 갱신하지 않는다", () => {
    expect(needsWeeklyRefresh("2026-11-23T05:00:00Z", wed)).toBe(false); // 월요일에 만듦
    expect(needsWeeklyRefresh("2026-11-25T01:00:00Z", wed)).toBe(false); // 오늘 만듦
  });

  it("지난 주에 만들었으면 갱신한다", () => {
    expect(needsWeeklyRefresh("2026-11-20T05:00:00Z", wed)).toBe(true);
    expect(needsWeeklyRefresh("2026-11-16T05:00:00Z", wed)).toBe(true);
  });

  it("월요일 0시(한국) 경계: 일요일 밤 11시(한국)에 만든 것은 지난 주다", () => {
    // 한국 일요일 23:00 = UTC 14:00 (11-22 일요일)
    expect(needsWeeklyRefresh("2026-11-22T14:00:00Z", new Date("2026-11-23T00:30:00Z"))).toBe(true);
    // 한국 월요일 00:10 = UTC 일요일 15:10 → 이미 월요일(한국)이므로 이번 주
    expect(needsWeeklyRefresh("2026-11-22T15:10:00Z", new Date("2026-11-23T00:30:00Z"))).toBe(false);
  });

  it("일요일에는 아직 같은 주이므로 월~일 안에 만든 것은 갱신하지 않는다", () => {
    expect(needsWeeklyRefresh("2026-11-23T05:00:00Z", new Date("2026-11-29T12:00:00Z"))).toBe(false);
  });

  it("잘못된 시각이면 갱신하지 않는다", () => {
    expect(needsWeeklyRefresh("not-a-date", wed)).toBe(false);
  });
});
