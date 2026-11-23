import { describe, expect, it } from "vitest";
import { isValidIsoDate, todayInKorea } from "@/lib/schemas/date";

describe("isValidIsoDate", () => {
  it("실제 있는 날짜는 통과한다", () => {
    expect(isValidIsoDate("2026-11-23")).toBe(true);
    expect(isValidIsoDate("2028-02-29")).toBe(true); // 윤년
  });

  it("없는 날짜와 잘못된 모양은 거부한다", () => {
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(isValidIsoDate("2027-02-29")).toBe(false); // 윤년 아님
    expect(isValidIsoDate("2026-13-01")).toBe(false);
    expect(isValidIsoDate("2026/11/23")).toBe(false);
    expect(isValidIsoDate("26-11-23")).toBe(false);
    expect(isValidIsoDate("")).toBe(false);
  });
});

describe("todayInKorea: 한국 시간 기준 오늘", () => {
  it("UTC로는 아직 전날이어도 한국 시간으로 날짜가 넘어갔으면 다음 날을 돌려준다", () => {
    // UTC 2026-11-23 15:30 = 한국 시간 2026-11-24 00:30
    expect(todayInKorea(new Date("2026-11-23T15:30:00Z"))).toBe("2026-11-24");
  });

  it("한국 시간 자정 직전에는 같은 날을 돌려준다", () => {
    // UTC 2026-11-23 14:59 = 한국 시간 2026-11-23 23:59
    expect(todayInKorea(new Date("2026-11-23T14:59:00Z"))).toBe("2026-11-23");
  });

  it("인자 없이 부르면 YYYY-MM-DD 모양의 실제 날짜를 돌려준다", () => {
    expect(isValidIsoDate(todayInKorea())).toBe(true);
  });
});
