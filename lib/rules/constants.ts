import type { ExperienceLevel, Goal } from "@/lib/schemas/lists";

// Design Ref: §1 원칙 6, §6.2 — 전문가 검토 전인 임시 숫자는 이 파일 하나에 모아 둔다.
// 아직 쓰는 숫자만 넣었고, 나머지(10% 기준, 3일 연속, 3주 감량 등)는 해당 규칙 코드를 만드는 작업(4~5번)에서 추가한다.
// 여기 숫자는 모두 임시값이다. 확정된 것처럼 다른 곳에 단정해서 쓰지 않는다.

/**
 * 비정상 기록 기준 — 입력 실수를 걸러내는 범위 (설계 결정, 임시값)
 * 이 범위를 벗어나면 저장하지 않고 다시 입력하게 한다. (PRD 예외 2번)
 */
export const ABNORMAL_RECORD_LIMITS = {
  /** 거리(km): 0 초과 ~ 100 이하 */
  distanceKm: { exclusiveMin: 0, max: 100 },
  /** 시간(분): 1분 이상 ~ 24시간(1440분) 이하 */
  durationMinutes: { min: 1, max: 24 * 60 },
  /** 평균 페이스(분/km): 2 이상 ~ 20 이하 */
  paceMinutesPerKm: { min: 2, max: 20 },
} as const;

/**
 * 시작 설정의 "최근 가장 길게 달린 거리" 입력 범위 (설계 결정, 임시값)
 * 0은 "달려본 적 없음"을 뜻한다. (PRD M2)
 */
export const PROFILE_LONGEST_RUN_KM = { min: 0, max: 100 } as const;

/**
 * "최근 N일" 기준 기간 (일). 기준일을 포함해 이 일수만큼을 본다. (PRD M2, 임시 해석)
 * 예: 기준일이 11월 23일이면 10월 25일부터 11월 23일까지 30일이다.
 */
export const RECENT_RUNS_WINDOW_DAYS = 30;

/**
 * 거리 주의 비율 (%) — 한 번의 달리기가 최근 최장 거리보다 이만큼 이상 길면 주의 안내.
 * 관찰 연구에서 연관성이 보고된 참고 기준이며 개인차가 있다. (PRD 각주 2, 전문가 검토 필요)
 */
export const DISTANCE_SPIKE_PERCENT = 10;

/**
 * 시작 기준 거리 (km) — 기록이 없고 시작 설정 거리도 0km("달려본 적 없음")일 때 쓰는 값.
 * 임시값이다. (PRD M2, 전문가 검토 필요)
 */
export const START_BASELINE_KM = 2;

/**
 * 같은 부위 통증 연속 일수 — 이 일수만큼 달력상 연속으로 입력되면 휴식을 권고한다.
 * 강도는 따지지 않는다. 임시값이다. (PRD M2, 전문가 검토 필요)
 */
export const PAIN_STREAK_DAYS = 3;

// ───────────────────────── 기본 4주 계획 구성 규칙 (DESIGN 6.3) ─────────────────────────
// 아래 숫자는 모두 임시값이며 전문가 검토 후 확정한다. (PRD M1, 공개 전 과제)

/** 계획 기간 (주). 4주 단위로 만들고 매주 갱신한다. */
export const PLAN_WEEKS = 4;

/** 주당 훈련 횟수 (경험 단계별) */
export const WEEKLY_TRAINING_COUNT: Record<ExperienceLevel, number> = {
  beginner: 3,
  intermediate: 4,
  advanced: 5,
};

/**
 * 7일 주기 안에서 훈련하는 날의 순번 (0 = 계획 시작일, 6 = 시작일 + 6일).
 * 나머지 날은 모두 휴식이다. 이 모양이 매주 똑같이 반복되므로, 어느 7일을 잡아도 휴식이 하루 이상 있다.
 * 각 배열의 길이는 WEEKLY_TRAINING_COUNT와 같아야 한다. (시험으로 확인)
 */
export const TRAINING_DAY_SLOTS: Record<ExperienceLevel, readonly number[]> = {
  beginner: [1, 3, 5],
  intermediate: [0, 2, 4, 6],
  advanced: [0, 1, 3, 4, 6],
};

/** 주당 페이스 달리기 횟수 (목표별). 장거리는 항상 주 1회이고, 나머지 훈련은 가벼운 달리기다. */
export const WEEKLY_PACE_RUNS: Record<Goal, number> = {
  fitness: 0,
  record: 1,
  pace: 2,
};

/**
 * 주마다 장거리를 늘리는 비율(%) (목표별). 반드시 DISTANCE_SPIKE_PERCENT(10)보다 작아야 한다.
 * 그래야 계획 검증기의 "10% 이상 길지 않음" 검사를 통과한다. (시험으로 확인)
 */
export const WEEKLY_LONG_GROWTH_PERCENT: Record<Goal, number> = {
  fitness: 3,
  record: 6,
  pace: 3,
};

/** 훈련 종류별 거리 = 그 주 장거리 × 이 비율 */
export const DISTANCE_RATIO_OF_LONG = { long: 1, pace: 0.7, easy: 0.6 } as const;

/**
 * 계획 거리는 0.01km(10m) 단위로 내림한다. 내림은 거리를 줄이는 방향이다.
 * 단위가 거칠면 작은 거리에서 한 칸이 10%에 가까워져 규칙을 어기게 되므로 곱게 잡았다.
 */
export const DISTANCE_UNITS_PER_KM = 100;

/** 주 최소 휴식일 (PRD M1, 전문가 검토 필요) */
export const MIN_REST_DAYS_PER_WEEK = 1;

/**
 * 감량 시작: 대회 며칠 전부터 훈련량을 줄이는지. 권장 준비 기간(3주)과 같은 값이다.
 * 21일 이하 점진 감량 연구를 참고한 값이다. (PRD 각주 3, 적용 조건은 전문가 검토 필요)
 */
export const TAPER_START_DAYS = 21;

/**
 * 감량 3단계 배율: 대회 21~15일 전 / 14~8일 전 / 7~1일 전(직전 주).
 * 직전 주는 평소의 50%, 즉 50% 감소다.
 */
export const TAPER_STEP_MULTIPLIERS = [0.8, 0.65, 0.5] as const;

/** 대회 직전 주 훈련량이 평소 대비 줄어야 하는 범위(%) (PRD 각주 3: 41~60% 감소) */
export const TAPER_FINAL_REDUCTION_PERCENT = { min: 41, max: 60 } as const;

// ───────────────────────── 가입·로그인 입력 제한 ─────────────────────────

/**
 * 비밀번호 길이 제한 (설계 결정, 임시값). Supabase 자체 최소 길이(6자)보다 엄격하게 8자로 잡았다.
 * 72자는 비밀번호를 저장할 때 쓰는 방식(bcrypt)이 처리할 수 있는 최대 길이다.
 */
export const PASSWORD_LENGTH = { min: 8, max: 72 } as const;

/** 이메일 최대 길이 (표준 한도 254자) */
export const EMAIL_MAX_LENGTH = 254;

/**
 * 대회 입력 한도 (임시값, 확정 아님). 지난 날짜는 입력할 수 없고, 너무 먼 미래 날짜는 입력 실수로 본다.
 * 이름·장소 길이는 데이터베이스 한도(200자)보다 작게 둔다.
 */
export const RACE_INPUT_LIMITS = { maxDaysAhead: 730, nameMaxLength: 100, locationMaxLength: 100 } as const;
