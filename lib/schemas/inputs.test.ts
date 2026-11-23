import { describe, expect, it } from "vitest";
import {
  checkinSchema,
  createRunRecordSchema,
  painEntrySchema,
  profileSchema,
  toFieldErrors,
} from "@/lib/schemas/inputs";

// 시험에는 가짜 데이터만 쓴다.
const TODAY = "2026-11-23";
const runSchema = createRunRecordSchema(TODAY);

describe("painEntrySchema: 통증 입력", () => {
  it("목록에 있는 부위와 강도는 통과한다", () => {
    expect(painEntrySchema.safeParse({ part: "knee", intensity: "mild" }).success).toBe(true);
  });

  it("목록에 없는 통증 부위는 거부한다", () => {
    const result = painEntrySchema.safeParse({ part: "chest", intensity: "mild" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(toFieldErrors(result.error).fieldErrors.part?.[0]).toBe(
        "목록에 있는 통증 부위를 골라 주세요.",
      );
    }
  });

  it("글로 쓴 부위 이름(자유 입력)은 거부한다", () => {
    expect(painEntrySchema.safeParse({ part: "오른쪽 무릎 안쪽", intensity: "mild" }).success).toBe(
      false,
    );
  });

  it("정해진 칸 밖의 값(글로 쓴 메모)은 받지 않는다", () => {
    const result = painEntrySchema.safeParse({ part: "knee", intensity: "mild", note: "어제부터 아파요" });
    expect(result.success).toBe(false);
  });

  it("강도가 목록에 없으면 거부한다", () => {
    expect(painEntrySchema.safeParse({ part: "knee", intensity: "unbearable" }).success).toBe(false);
  });
});

describe("checkinSchema: 훈련 전 체크인", () => {
  it("컨디션만 있어도 통과하고, 통증·위험 증상은 빈 목록이 된다", () => {
    const result = checkinSchema.safeParse({ condition: "good" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pains).toEqual([]);
      expect(result.data.dangerSymptoms).toEqual([]);
    }
  });

  it("통증과 위험 증상을 함께 입력할 수 있다", () => {
    const result = checkinSchema.safeParse({
      condition: "bad",
      pains: [
        { part: "knee", intensity: "moderate" },
        { part: "ankle", intensity: "mild" },
      ],
      dangerSymptoms: ["chest_pain"],
    });
    expect(result.success).toBe(true);
  });

  it("컨디션이 목록에 없으면 한국어 오류를 돌려준다", () => {
    const result = checkinSchema.safeParse({ condition: "great" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(toFieldErrors(result.error).fieldErrors.condition?.[0]).toBe(
        "오늘 컨디션(좋음·보통·나쁨)을 골라 주세요.",
      );
    }
  });

  it("같은 부위를 두 번 입력하면 거부한다", () => {
    const result = checkinSchema.safeParse({
      condition: "normal",
      pains: [
        { part: "knee", intensity: "mild" },
        { part: "knee", intensity: "severe" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("목록에 없는 위험 증상과 중복 증상은 거부한다", () => {
    expect(checkinSchema.safeParse({ condition: "normal", dangerSymptoms: ["headache"] }).success).toBe(false);
    expect(
      checkinSchema.safeParse({ condition: "normal", dangerSymptoms: ["chest_pain", "chest_pain"] }).success,
    ).toBe(false);
  });

  it("글로 쓴 증상 메모 칸은 받지 않는다", () => {
    expect(checkinSchema.safeParse({ condition: "normal", memo: "가슴이 답답했다" }).success).toBe(false);
  });
});

describe("createRunRecordSchema: 훈련 후 러닝 기록", () => {
  const valid = { date: "2026-11-22", distanceKm: 5, durationMinutes: 30 };

  it("정상 기록은 통과한다 (6분/km 페이스)", () => {
    expect(runSchema.safeParse(valid).success).toBe(true);
  });

  it("화면에서 넘어온 문자열 숫자도 숫자로 바꿔 검사한다", () => {
    const result = runSchema.safeParse({ date: "2026-11-22", distanceKm: "5", durationMinutes: "30" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.distanceKm).toBe(5);
      expect(result.data.durationMinutes).toBe(30);
    }
  });

  it("오늘 날짜는 입력할 수 있고, 미래 날짜는 거부한다", () => {
    expect(runSchema.safeParse({ ...valid, date: TODAY }).success).toBe(true);
    expect(runSchema.safeParse({ ...valid, date: "2026-11-24" }).success).toBe(false);
  });

  it("없는 날짜나 잘못된 모양은 거부한다", () => {
    expect(runSchema.safeParse({ ...valid, date: "2026-02-30" }).success).toBe(false);
    expect(runSchema.safeParse({ ...valid, date: "어제" }).success).toBe(false);
  });

  it("거리가 0 이하이거나 100km를 넘으면 거부한다", () => {
    expect(runSchema.safeParse({ ...valid, distanceKm: 0 }).success).toBe(false);
    expect(runSchema.safeParse({ ...valid, distanceKm: -3 }).success).toBe(false);
    expect(runSchema.safeParse({ ...valid, distanceKm: 100, durationMinutes: 600 }).success).toBe(true);
    expect(runSchema.safeParse({ ...valid, distanceKm: 100.1, durationMinutes: 600 }).success).toBe(false);
  });

  it("시간이 1분 미만이거나 24시간을 넘으면 거부한다", () => {
    expect(runSchema.safeParse({ ...valid, distanceKm: 0.5, durationMinutes: 0 }).success).toBe(false);
    expect(runSchema.safeParse({ ...valid, distanceKm: 70, durationMinutes: 1441 }).success).toBe(false);
  });

  it("숫자가 아닌 입력은 한국어 오류를 돌려준다", () => {
    const result = runSchema.safeParse({ ...valid, distanceKm: "다섯" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(toFieldErrors(result.error).fieldErrors.distanceKm?.[0]).toBe(
        "거리를 숫자(km)로 입력해 주세요.",
      );
    }
  });

  it("페이스가 너무 빠르거나 느리면 시간 칸에 오류를 붙인다", () => {
    // 10km를 10분 = 1분/km (너무 빠름)
    const fast = runSchema.safeParse({ ...valid, distanceKm: 10, durationMinutes: 10 });
    expect(fast.success).toBe(false);
    if (!fast.success) {
      expect(toFieldErrors(fast.error).fieldErrors.durationMinutes).toBeDefined();
    }
    // 1km를 30분 = 30분/km (너무 느림)
    expect(runSchema.safeParse({ ...valid, distanceKm: 1, durationMinutes: 30 }).success).toBe(false);
  });

  it("페이스 경계값(2분/km, 20분/km)은 통과한다", () => {
    expect(runSchema.safeParse({ ...valid, distanceKm: 10, durationMinutes: 20 }).success).toBe(true);
    expect(runSchema.safeParse({ ...valid, distanceKm: 10, durationMinutes: 200 }).success).toBe(true);
  });

  it("정해진 칸 밖의 값은 받지 않는다", () => {
    expect(runSchema.safeParse({ ...valid, memo: "오늘 힘들었다" }).success).toBe(false);
  });
});

describe("profileSchema: 시작 설정", () => {
  const valid = { ageBand: "30-39", experience: "beginner", longestRunKm: 5, goal: "fitness" };

  it("정상 입력은 통과한다", () => {
    expect(profileSchema.safeParse(valid).success).toBe(true);
  });

  it('최근 최장 거리 0은 "달려본 적 없음"으로 허용한다', () => {
    expect(profileSchema.safeParse({ ...valid, longestRunKm: 0 }).success).toBe(true);
    expect(profileSchema.safeParse({ ...valid, longestRunKm: "0" }).success).toBe(true);
  });

  it("최근 최장 거리가 음수이거나 100km를 넘으면 거부한다", () => {
    expect(profileSchema.safeParse({ ...valid, longestRunKm: -1 }).success).toBe(false);
    expect(profileSchema.safeParse({ ...valid, longestRunKm: 100 }).success).toBe(true);
    expect(profileSchema.safeParse({ ...valid, longestRunKm: 100.5 }).success).toBe(false);
  });

  it("목록에 없는 나이대·경험·목표는 거부한다", () => {
    expect(profileSchema.safeParse({ ...valid, ageBand: "10-18" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...valid, experience: "expert" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...valid, goal: "weight" }).success).toBe(false);
  });

  it("정확한 생년월일 같은 정해진 칸 밖의 값은 받지 않는다", () => {
    expect(profileSchema.safeParse({ ...valid, birthDate: "1990-01-01" }).success).toBe(false);
  });
});
