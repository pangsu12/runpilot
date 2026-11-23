import { describe, expect, it } from "vitest";
import { findPainStreaks, type PainLog } from "@/lib/rules/pain";

// 시험에는 가짜 기록만 쓴다. 기준일: 2026-11-23
const TODAY = "2026-11-23";

const knee = (date: string): PainLog => ({ date, part: "knee" });
const ankle = (date: string): PainLog => ({ date, part: "ankle" });

describe("findPainStreaks: 같은 부위 통증 3일 연속", () => {
  it("기록이 없으면 빈 목록이다", () => {
    expect(findPainStreaks([], TODAY)).toEqual([]);
  });

  it("같은 부위가 3일 연속이면 휴식 권고 대상이다", () => {
    const logs = [knee("2026-11-21"), knee("2026-11-22"), knee("2026-11-23")];
    expect(findPainStreaks(logs, TODAY)).toEqual([{ part: "knee", days: 3 }]);
  });

  it("2일 연속이면 아직 아니다", () => {
    expect(findPainStreaks([knee("2026-11-22"), knee("2026-11-23")], TODAY)).toEqual([]);
  });

  it("하루라도 건너뛰면 연속이 끊긴다", () => {
    const logs = [knee("2026-11-20"), knee("2026-11-21"), knee("2026-11-23")]; // 22일 입력 없음
    expect(findPainStreaks(logs, TODAY)).toEqual([]);
  });

  it("4일 연속이면 연속 일수를 4로 돌려준다", () => {
    const logs = [
      knee("2026-11-20"),
      knee("2026-11-21"),
      knee("2026-11-22"),
      knee("2026-11-23"),
    ];
    expect(findPainStreaks(logs, TODAY)).toEqual([{ part: "knee", days: 4 }]);
  });

  it("기준일에 입력이 없으면 연속으로 보지 않는다", () => {
    const logs = [knee("2026-11-20"), knee("2026-11-21"), knee("2026-11-22")]; // 23일 입력 없음
    expect(findPainStreaks(logs, TODAY)).toEqual([]);
  });

  it("부위가 다르면 따로 센다 (무릎 2일 + 발목 1일은 연속이 아니다)", () => {
    const logs = [knee("2026-11-21"), knee("2026-11-22"), ankle("2026-11-23")];
    expect(findPainStreaks(logs, TODAY)).toEqual([]);
  });

  it("여러 부위가 동시에 3일 연속이면 모두 돌려주고, 목록 순서(무릎 → 발목)를 지킨다", () => {
    const dates = ["2026-11-21", "2026-11-22", "2026-11-23"];
    const logs = [...dates.map(ankle), ...dates.map(knee)]; // 일부러 발목을 먼저 넣는다
    expect(findPainStreaks(logs, TODAY)).toEqual([
      { part: "knee", days: 3 },
      { part: "ankle", days: 3 },
    ]);
  });

  it("같은 날 같은 부위를 두 번 입력해도 하루로 센다", () => {
    const logs = [knee("2026-11-22"), knee("2026-11-23"), knee("2026-11-23")];
    expect(findPainStreaks(logs, TODAY)).toEqual([]);
  });

  it("기준일 이후(미래) 기록은 연속에 포함하지 않는다", () => {
    const logs = [knee("2026-11-22"), knee("2026-11-23"), knee("2026-11-24")];
    expect(findPainStreaks(logs, TODAY)).toEqual([]);
  });

  it("달·해가 바뀌어도 달력 기준으로 이어서 센다", () => {
    const logs = [knee("2026-12-30"), knee("2026-12-31"), knee("2027-01-01")];
    expect(findPainStreaks(logs, "2027-01-01")).toEqual([{ part: "knee", days: 3 }]);
  });

  it("minDays를 바꾸면 그 일수 기준으로 판정한다", () => {
    const logs = [knee("2026-11-22"), knee("2026-11-23")];
    expect(findPainStreaks(logs, TODAY, 2)).toEqual([{ part: "knee", days: 2 }]);
  });
});
