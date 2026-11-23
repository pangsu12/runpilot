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
