import { describe, expect, it } from "vitest";
import { addDaysIso, daysBetween, isValidIsoDate, todayInKorea } from "@/lib/schemas/date";

describe("daysBetween", () => {
  it("뒤 날짜가 늦으면 양수, 앞서면 음수, 같으면 0이다", () => {
    expect(daysBetween("2026-11-23", "2026-11-30")).toBe(7);
    expect(daysBetween("2026-11-30", "2026-11-23")).toBe(-7);
    expect(daysBetween("2026-11-23", "2026-11-23")).toBe(0);
  });

  it("달·해·윤년 경계를 넘어도 달력 기준으로 센다", () => {
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2); // 윤년
    expect(daysBetween("2026-10-25", "2026-11-23")).toBe(29);
  });
});

describe("addDaysIso", () => {
  it("일수를 더하고 뺀다 (달·해가 바뀌는 경우 포함)", () => {
    expect(addDaysIso("2026-11-23", 1)).toBe("2026-11-24");
    expect(addDaysIso("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysIso("2026-11-23", -29)).toBe("2026-10-25");
    expect(addDaysIso("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDaysIso("2028-03-01", -1)).toBe("2028-02-29"); // 윤년
  });

  it("0일을 더하면 같은 날짜다", () => {
    expect(addDaysIso("2026-11-23", 0)).toBe("2026-11-23");
  });
});

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
