import { describe, expect, it } from "vitest";
import { findDiagnosisAssertions } from "@/lib/rules/diagnosis";

describe("findDiagnosisAssertions: 진단·병명 단정 표현", () => {
  it("진단을 내리는 서술을 찾아낸다", () => {
    expect(findDiagnosisAssertions("무릎 염좌로 진단합니다.").length).toBeGreaterThan(0);
    expect(findDiagnosisAssertions("이 증상은 심장병으로 진단됩니다.").length).toBeGreaterThan(0);
  });

  it("병명 뒤에 단정하는 끝맺음이 오면 찾아낸다", () => {
    expect(findDiagnosisAssertions("가슴이 답답한 것은 부정맥입니다.")).toContain("부정맥입니다");
    expect(findDiagnosisAssertions("발바닥 통증은 근막염으로 보입니다.")).toContain("근막염으로 보입니다");
  });

  it('"~로 진단"처럼 진단을 단정하는 말도 찾아낸다', () => {
    expect(findDiagnosisAssertions("협심증으로 진단").length).toBeGreaterThan(0);
  });

  it('PRD의 안내 문구("의학적 진단이 아닙니다", 의사 상담 안내)는 걸리지 않는다', () => {
    expect(findDiagnosisAssertions("의학적 진단이 아닙니다.")).toEqual([]);
    expect(
      findDiagnosisAssertions("지병이나 심장 질환이 걱정되면 대회 참가 전에 의사와 상담하세요."),
    ).toEqual([]);
    expect(
      findDiagnosisAssertions("통증이나 이상이 있으면 즉시 중단하고 의사와 상담하세요."),
    ).toEqual([]);
  });

  it("평범한 훈련 설명은 걸리지 않는다", () => {
    expect(findDiagnosisAssertions("이번 주는 가볍게 달리며 무릎이 불편하면 쉬어 가세요.")).toEqual([]);
    expect(findDiagnosisAssertions("")).toEqual([]);
  });
});
