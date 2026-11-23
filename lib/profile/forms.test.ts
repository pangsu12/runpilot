import { describe, expect, it } from "vitest";
import { profileToFormValues, readProfileForm } from "@/lib/profile/forms";
import { profileToColumns } from "@/lib/profile/rows";
import { profileSchema, toFieldErrors } from "@/lib/schemas/inputs";

function form(values: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

const valid = { ageBand: "30-39", experience: "beginner", longestRunKm: "5", goal: "fitness" };

describe("readProfileForm + profileSchema", () => {
  it("정상 입력은 통과하고 저장 칸으로 바뀐다", () => {
    const parsed = profileSchema.safeParse(readProfileForm(form(valid)));
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(profileToColumns(parsed.data)).toEqual({
        age_band: "30-39",
        experience: "beginner",
        longest_run_km: 5,
        goal: "fitness",
      });
    }
  });

  it("거리 0은 허용한다 (달려본 적 없음)", () => {
    expect(profileSchema.safeParse(readProfileForm(form({ ...valid, longestRunKm: "0" }))).success).toBe(true);
  });

  it("거리 칸이 비어 있으면 0으로 바뀌지 않고 오류가 난다", () => {
    const result = profileSchema.safeParse(readProfileForm(form({ ...valid, longestRunKm: "  " })));
    expect(result.success).toBe(false);
    if (!result.success) expect(toFieldErrors(result.error).fieldErrors.longestRunKm?.length).toBeGreaterThan(0);
  });

  it("거리가 100km를 넘거나 음수이거나 숫자가 아니면 거부한다", () => {
    for (const longestRunKm of ["100.01", "-1", "abc"]) {
      expect(profileSchema.safeParse(readProfileForm(form({ ...valid, longestRunKm }))).success, longestRunKm).toBe(false);
    }
    expect(profileSchema.safeParse(readProfileForm(form({ ...valid, longestRunKm: "100" }))).success).toBe(true);
  });

  it("목록에 없는 나이대·경험·목표는 거부하고, 빈 선택도 거부한다", () => {
    expect(profileSchema.safeParse(readProfileForm(form({ ...valid, ageBand: "10-18" }))).success).toBe(false);
    expect(profileSchema.safeParse(readProfileForm(form({ ...valid, experience: "pro" }))).success).toBe(false);
    expect(profileSchema.safeParse(readProfileForm(form({ ...valid, goal: "" }))).success).toBe(false);
  });
});

describe("profileToFormValues: 저장된 값을 화면 칸으로", () => {
  it("저장 전(null)이면 빈 값이다", () => {
    expect(profileToFormValues(null)).toEqual({});
  });

  it("저장된 값은 문자열 칸 값으로 바뀌고, 0km도 보존한다", () => {
    expect(
      profileToFormValues({ age_band: "40-49", experience: "advanced", longest_run_km: "0.00", goal: "record" }).longestRunKm,
    ).toBe("0.00");
    expect(profileToFormValues({ age_band: null, experience: null, longest_run_km: null, goal: null })).toEqual({
      ageBand: undefined,
      experience: undefined,
      longestRunKm: undefined,
      goal: undefined,
    });
  });
});
