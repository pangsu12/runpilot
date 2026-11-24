import type { ReactNode } from "react";

// Design Ref: §5.2 공통 — 긴 폼을 "번호 + 제목 + 짧은 설명" 단위로 나눠, 글을 다 읽지 않아도 지금 무엇을 입력하는지 알게 한다. (시각적 계층)

type FormSectionProps = {
  /** 단계 번호. 없으면 번호 표시 없이 제목만 보인다. */
  step?: number;
  title: string;
  /** 제목 아래의 짧은 설명 */
  hint?: string;
  /** true면 안의 입력칸을 모두 막고 흐리게 보인다 (동의하지 않아 쓸 수 없는 입력). */
  disabled?: boolean;
  children: ReactNode;
};

/** 입력 묶음 하나. fieldset이라서 스크린리더가 묶음의 제목을 함께 읽는다. */
export function FormSection({ step, title, hint, disabled, children }: FormSectionProps) {
  return (
    <fieldset
      disabled={disabled}
      className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-4 disabled:opacity-50"
    >
      <legend className="sr-only">{title}</legend>
      <div aria-hidden="true" className="flex items-start gap-3">
        {step !== undefined ? (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">{step}</span>
        ) : null}
        <div className="flex flex-col">
          <span className="font-semibold">{title}</span>
          {hint ? <span className="text-sm text-zinc-400">{hint}</span> : null}
        </div>
      </div>
      {children}
    </fieldset>
  );
}
