// Design Ref: §7.9 — 대회 폼(FormData)을 입력 검사에 넣을 수 있는 모양으로 바꾼다.

function text(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}

/** 화면에 되돌려줄 입력값 */
export type RaceFormValues = { name?: string; date?: string; location?: string; distance?: string };

/** 대회 직접 입력 폼 → 입력 검사용 값. 선택하지 않은 종목은 빈 문자열이 아니라 undefined로 넘긴다. */
export function readRaceForm(formData: FormData): RaceFormValues {
  return {
    name: text(formData, "name"),
    date: text(formData, "date"),
    location: text(formData, "location"),
    distance: text(formData, "distance") || undefined,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 삭제할 대회 ID. 올바른 UUID 모양이 아니면 null. */
export function readRaceId(formData: FormData): string | null {
  const value = text(formData, "id");
  return value && UUID.test(value) ? value : null;
}
