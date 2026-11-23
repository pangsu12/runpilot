// Design Ref: §6.1, §9 — 건강정보와 프로필은 "고정 목록"에서 고른 값만 받는다.
// 글로 쓴 원문은 어디에도 저장하지 않으므로, 입력 칸을 만들지 않고 여기 있는 값만 허용한다.
// 저장·전송에는 영어 코드값을 쓰고, 화면에는 한국어 이름표(LABELS)를 보여준다.

/** 통증 부위 (PRD 7번 목록) */
export const PAIN_PARTS = ["knee", "ankle", "calf", "thigh", "sole", "lower_back"] as const;
export type PainPart = (typeof PAIN_PARTS)[number];
export const PAIN_PART_LABELS: Record<PainPart, string> = {
  knee: "무릎",
  ankle: "발목",
  calf: "종아리",
  thigh: "허벅지",
  sole: "발바닥",
  lower_back: "허리",
};

/** 통증 강도 3단계 */
export const PAIN_INTENSITIES = ["mild", "moderate", "severe"] as const;
export type PainIntensity = (typeof PAIN_INTENSITIES)[number];
export const PAIN_INTENSITY_LABELS: Record<PainIntensity, string> = {
  mild: "약함",
  moderate: "보통",
  severe: "심함",
};

/** 그날의 컨디션 3단계 */
export const CONDITIONS = ["good", "normal", "bad"] as const;
export type Condition = (typeof CONDITIONS)[number];
export const CONDITION_LABELS: Record<Condition, string> = {
  good: "좋음",
  normal: "보통",
  bad: "나쁨",
};

/** 위험 증상 (PRD M2) — 판단은 AI가 아니라 코드 규칙이 한다 */
export const DANGER_SYMPTOMS = [
  "chest_pain",
  "severe_shortness_of_breath",
  "fainting_or_severe_dizziness",
] as const;
export type DangerSymptom = (typeof DANGER_SYMPTOMS)[number];
export const DANGER_SYMPTOM_LABELS: Record<DangerSymptom, string> = {
  chest_pain: "가슴 통증",
  severe_shortness_of_breath: "심한 호흡곤란",
  fainting_or_severe_dizziness: "실신 또는 심한 어지러움",
};

/** 훈련 종류 (DESIGN 6.1, 전문가 검토 필요) */
export const TRAINING_KINDS = ["rest", "easy", "pace", "long"] as const;
export type TrainingKind = (typeof TRAINING_KINDS)[number];
export const TRAINING_KIND_LABELS: Record<TrainingKind, string> = {
  rest: "휴식",
  easy: "가벼운 달리기",
  pace: "페이스 달리기",
  long: "장거리",
};

/** 러닝 경험 3단계 (세부 기준은 전문가 검토 후 확정, 지금은 본인이 고른다) */
export const EXPERIENCE_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];
export const EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevel, string> = {
  beginner: "입문",
  intermediate: "중급",
  advanced: "상급",
};

/** 목표 3가지 */
export const GOALS = ["fitness", "record", "pace"] as const;
export type Goal = (typeof GOALS)[number];
export const GOAL_LABELS: Record<Goal, string> = {
  fitness: "체력 증진",
  record: "기록 향상",
  pace: "페이스 조절",
};

/**
 * 나이대 — 정확한 생년월일은 받지 않는다. 만 19세 이상만 가입하므로 19세부터 시작한다.
 * (구간 나누기는 임시안이며, 바뀌면 이 목록만 고치면 된다)
 */
export const AGE_BANDS = ["19-29", "30-39", "40-49", "50-59", "60+"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];
export const AGE_BAND_LABELS: Record<AgeBand, string> = {
  "19-29": "19~29세",
  "30-39": "30대",
  "40-49": "40대",
  "50-59": "50대",
  "60+": "60세 이상",
};
