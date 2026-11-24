// Design Ref: §7.1 가입과 동의 — 동의: profiles에 동의 저장 / 거부: 동의 안 함으로 저장
// 동의 화면의 두 버튼("동의", "동의하지 않고 계속")이 보내는 값을 안전하게 해석한다.

export const CONSENT_CHOICES = { agree: "agree", decline: "decline" } as const;

export type ConsentChoice = (typeof CONSENT_CHOICES)[keyof typeof CONSENT_CHOICES];

/** 폼 값이 정해진 두 값 중 하나일 때만 돌려주고, 그 밖의 값(빈 값, 엉뚱한 값)은 null. */
export function parseConsentChoice(value: unknown): ConsentChoice | null {
  if (value === CONSENT_CHOICES.agree) return CONSENT_CHOICES.agree;
  if (value === CONSENT_CHOICES.decline) return CONSENT_CHOICES.decline;
  return null;
}

/** 프로필에 저장할 값. 동의하지 않으면 동의 시각도 비운다. */
export function consentColumns(choice: ConsentChoice, now: Date): { health_consent: boolean; health_consent_at: string | null } {
  return choice === CONSENT_CHOICES.agree
    ? { health_consent: true, health_consent_at: now.toISOString() }
    : { health_consent: false, health_consent_at: null };
}

/** 동의 화면에 표시하는 문구. 보관 기간·삭제 방법은 PLAN 8번 기준이다. (법적 검토는 공개 전 과제) */
export const CONSENT_TEXT = {
  items: ["러닝 중 느낀 통증 부위와 강도(3단계)", "훈련 전 컨디션(3단계)", "위험 증상 체크 항목(가슴 통증, 심한 호흡곤란, 실신·심한 어지러움)"],
  purpose: "훈련 강도를 낮추거나 쉬도록 안내하고, 주의 안내를 만들기 위해서만 사용합니다. 광고나 다른 목적에는 쓰지 않습니다.",
  retention: "서비스 이용 기간 동안 보관하며, 삭제 요청이나 탈퇴 시 즉시 삭제합니다.",
  deletion: "설정 화면에서 건강정보를 직접 지우거나 동의를 철회할 수 있습니다. 탈퇴하면 모든 기록이 함께 지워집니다. (설정 화면)",
  declineNote: "동의하지 않아도 러닝 거리·시간 기록과 훈련계획은 사용할 수 있습니다. 다만 컨디션·통증 입력은 쓸 수 없고, 위험 증상 체크는 저장 없이 안내만 합니다.",
} as const;
