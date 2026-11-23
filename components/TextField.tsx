// Design Ref: §5.3 로그인/가입 — 입력칸 아래에 한국어 오류 메시지를 보여준다. (오류 메시지 영역)

type TextFieldProps = {
  id: string;
  name: string;
  label: string;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  defaultValue?: string;
  /** 이 칸의 오류 메시지 (없으면 표시하지 않는다) */
  errors?: string[];
  /** 입력칸 아래의 짧은 안내 */
  hint?: string;
  /** 숫자 칸에서 모바일 숫자 자판을 띄우기 위한 힌트 */
  inputMode?: "text" | "decimal" | "numeric";
};

/** 이름표 + 입력칸 + 오류 메시지가 묶인 입력 부품 */
export function TextField({
  id,
  name,
  label,
  type = "text",
  autoComplete,
  defaultValue,
  errors,
  hint,
  inputMode,
}: TextFieldProps) {
  const hasError = Boolean(errors && errors.length > 0);
  const describedBy = [hasError ? `${id}-error` : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        defaultValue={defaultValue}
        aria-invalid={hasError}
        aria-describedby={describedBy || undefined}
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20 aria-invalid:border-red-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100"
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-zinc-500 dark:text-zinc-400">
          {hint}
        </p>
      ) : null}
      {hasError ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-red-600 dark:text-red-400">
          {errors?.[0]}
        </p>
      ) : null}
    </div>
  );
}
