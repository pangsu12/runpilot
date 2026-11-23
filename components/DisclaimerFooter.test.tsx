import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  DISCLAIMER_TEXT,
  DisclaimerFooter,
  DOCTOR_ADVICE_TEXT,
  NO_CONSENT_NOTICE_TEXT,
} from "@/components/DisclaimerFooter";

describe("DisclaimerFooter: 모든 화면 하단 안내 문구", () => {
  it('기본으로 "의학적 진단이 아닙니다"와 의사 상담 안내를 보여준다', () => {
    const html = renderToStaticMarkup(<DisclaimerFooter />);
    expect(html).toContain(DISCLAIMER_TEXT);
    expect(html).toContain(DOCTOR_ADVICE_TEXT);
  });

  it("동의 거부가 아니면 동의 거부용 추가 문구는 보이지 않는다", () => {
    const html = renderToStaticMarkup(<DisclaimerFooter />);
    expect(html).not.toContain(NO_CONSENT_NOTICE_TEXT);
  });

  it("건강정보 동의를 거부한 사용자에게는 추가 문구도 함께 보여준다", () => {
    const html = renderToStaticMarkup(<DisclaimerFooter noHealthConsent />);
    expect(html).toContain(DISCLAIMER_TEXT);
    expect(html).toContain(NO_CONSENT_NOTICE_TEXT);
  });

  it("문구가 PRD 원문과 같다 (임의로 바뀌지 않게 지킨다)", () => {
    expect(DISCLAIMER_TEXT).toBe("의학적 진단이 아닙니다.");
    expect(DOCTOR_ADVICE_TEXT).toBe(
      "지병이나 심장 질환이 걱정되면 대회 참가 전에 의사와 상담하세요.",
    );
    expect(NO_CONSENT_NOTICE_TEXT).toBe("통증이나 이상이 있으면 즉시 중단하고 의사와 상담하세요.");
  });
});

describe("루트 레이아웃", () => {
  // 모든 화면이 이 레이아웃을 거치므로, 여기에 안내 문구가 있으면 모든 화면에 표시된다.
  const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

  it("안내 문구 부품을 포함한다", () => {
    expect(layout).toContain("<DisclaimerFooter");
  });

  it("한국어 화면(lang=ko)으로 설정되어 있다", () => {
    expect(layout).toContain('lang="ko"');
  });
});
