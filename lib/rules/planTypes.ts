import type { TrainingKind } from "@/lib/schemas/lists";

// Design Ref: §6.1 plan_days — 계획은 "날짜별 훈련 종류와 거리"의 목록이다.
// 코드가 만든 기본 계획과 AI가 만든 계획이 같은 모양을 쓰므로, 같은 검증기로 검사할 수 있다.

/** 하루치 계획: 날짜("YYYY-MM-DD"), 훈련 종류, 거리(km). 휴식이면 거리는 0이다. */
export type PlanDay = {
  date: string;
  kind: TrainingKind;
  distanceKm: number;
};
