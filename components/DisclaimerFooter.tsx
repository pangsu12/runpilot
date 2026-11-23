// Design Ref: §5.2 공통 — 모든 화면 맨 아래에 "의학적 진단이 아닙니다" 문구를 고정 표시한다.
// Plan SC: 안내 문구 — 모든 계획·안내 화면에 "의학적 진단이 아님" 문구 100% 표시 (루트 레이아웃에 한 번만 넣는다)

/** 모든 화면 하단에 들어가는 기본 문구 (PRD M1) */
export const DISCLAIMER_TEXT = "의학적 진단이 아닙니다.";

/** 계획·대회 화면에 함께 보여주는 의사 상담 안내 (PRD M1) */
export const DOCTOR_ADVICE_TEXT =
  "지병이나 심장 질환이 걱정되면 대회 참가 전에 의사와 상담하세요.";

/** 건강정보 동의를 거부한 사용자에게 모든 화면에서 추가로 보여주는 문구 (PRD 예외 4번) */
export const NO_CONSENT_NOTICE_TEXT =
  "통증이나 이상이 있으면 즉시 중단하고 의사와 상담하세요.";

type DisclaimerFooterProps = {
  /**
   * 건강정보 동의를 거부한 사용자인지 여부.
   * 동의 상태는 작업 8(동의 화면)에서 저장하므로, 그때 이 값을 연결한다. 지금은 기본값(false)이다.
   */
  noHealthConsent?: boolean;
};

/** 모든 화면 맨 아래에 고정으로 들어가는 안내 문구 (일반 안내 색: 회색) */
export function DisclaimerFooter({ noHealthConsent = false }: DisclaimerFooterProps) {
  return (
    <footer className="border-t border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
      <div className="mx-auto flex max-w-3xl flex-col gap-1">
        <p>
          <strong className="font-semibold">{DISCLAIMER_TEXT}</strong> {DOCTOR_ADVICE_TEXT}
        </p>
        {noHealthConsent ? <p>{NO_CONSENT_NOTICE_TEXT}</p> : null}
      </div>
    </footer>
  );
}
