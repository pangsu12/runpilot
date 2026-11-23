// Design Ref: §5.3 시작 설정 — 고정 목록에서 고르는 입력 부품. 이름표 + 선택칸 + 오류 메시지.

type SelectFieldProps = {
  id: string;
  name: string;
  label: string;
  /** 저장에 쓰는 값(value)과 화면에 보이는 이름표(label) */
  options: ReadonlyArray<{ value: string; label: string }>;
  defaultValue?: string;
  errors?: string[];
};

export function SelectField({ id, name, label, options, defaultValue, errors }: SelectFieldProps) {
  const hasError = Boolean(errors && errors.length > 0);

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue ?? ""}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${id}-error` : undefined}
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20 aria-invalid:border-red-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100"
      >
        <option value="">선택해 주세요</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hasError ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-red-600 dark:text-red-400">
          {errors?.[0]}
        </p>
      ) : null}
    </div>
  );
}
