import { PAIN_PARTS } from "@/lib/schemas/lists";

// Design Ref: §5.3 훈련 전 체크인 — 화면의 폼(FormData)을 checkinSchema에 넣을 수 있는 모양으로 바꾼다.
// 통증은 부위마다 강도 선택칸이 하나씩이고, 글로 쓴 원문 칸은 없다.

/** 통증 강도 선택칸 이름 (부위마다 하나) */
export const painFieldName = (part: string) => `pain_${part}`;

/** 폼에서 통증 입력(부위마다 강도 선택칸)을 읽는다. "없음"(빈 값)인 부위는 건너뛴다. 훈련 후 기록 화면도 같이 쓴다. */
export function readPainFields(formData: FormData) {
  return PAIN_PARTS.flatMap((part) => {
    const intensity = formData.get(painFieldName(part));
    return typeof intensity === "string" && intensity !== "" ? [{ part, intensity }] : [];
  });
}

/**
 * 체크인 폼 → 입력 검사용 값.
 * @param consent 건강정보 동의 여부. 동의하지 않았으면 컨디션·통증 칸은 읽지 않는다. (화면에서도 비활성이다)
 *   이때 컨디션은 계산에 영향이 없는 "보통"으로 두고, 위험 증상 체크만 읽는다.
 */
export function readCheckinForm(formData: FormData, consent: boolean) {
  const dangerSymptoms = formData.getAll("danger").filter((value): value is string => typeof value === "string");
  if (!consent) return { condition: "normal", pains: [], dangerSymptoms };

  const condition = formData.get("condition");
  return { condition: typeof condition === "string" ? condition : undefined, pains: readPainFields(formData), dangerSymptoms };
}
