import { describe, expect, it } from "vitest";
import { consentColumns, parseConsentChoice } from "@/lib/consent/choice";

describe("parseConsentChoice: 동의 버튼 값 해석", () => {
  it("agree/decline만 받는다", () => {
    expect(parseConsentChoice("agree")).toBe("agree");
    expect(parseConsentChoice("decline")).toBe("decline");
  });

  it("빈 값·엉뚱한 값·다른 형식은 거부한다 (동의로 간주하지 않는다)", () => {
    for (const value of [null, undefined, "", "AGREE", "true", "yes", 1, true, {}]) {
      expect(parseConsentChoice(value), String(value)).toBeNull();
    }
  });
});

describe("consentColumns: 프로필에 저장할 값", () => {
  const now = new Date("2026-11-23T01:00:00.000Z");

  it("동의하면 동의 여부와 시각을 저장한다", () => {
    expect(consentColumns("agree", now)).toEqual({ health_consent: true, health_consent_at: "2026-11-23T01:00:00.000Z" });
  });

  it("동의하지 않으면 동의 안 함으로 저장하고 시각은 비운다", () => {
    expect(consentColumns("decline", now)).toEqual({ health_consent: false, health_consent_at: null });
  });
});
