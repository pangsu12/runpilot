import { painFieldName } from "@/lib/checkin/forms";
import { PAIN_INTENSITIES, PAIN_INTENSITY_LABELS, PAIN_PART_LABELS, PAIN_PARTS } from "@/lib/schemas/lists";

// Design Ref: §5.3 체크인·기록 — 통증은 고정 목록(부위 6개 × 강도 3단계)으로만 받는다. 글로 쓴 내용은 받지 않는다.
// 부위마다 작은 칸으로 나눠 2열로 보여준다. (입력칸 이름과 저장되는 값은 이전과 같다)

/**
 * @param idPrefix 같은 화면에 두 번 쓰일 때 id가 겹치지 않게 하는 접두사
 * @param resetKey 저장에 성공해 폼을 비울 때 선택 칸도 함께 초기화하기 위한 키
 */
export function PainFields({ idPrefix = "", resetKey = "" }: { idPrefix?: string; resetKey?: string }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {PAIN_PARTS.map((part) => {
        const name = painFieldName(part);
        return (
          <div
            key={`${part}-${resetKey}`}
            className="flex flex-col gap-1 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2"
          >
            <label htmlFor={`${idPrefix}${name}`} className="text-sm font-medium">
              {PAIN_PART_LABELS[part]}
            </label>
            <select
              id={`${idPrefix}${name}`}
              name={name}
              defaultValue=""
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
            >
              <option value="">없음</option>
              {PAIN_INTENSITIES.map((intensity) => (
                <option key={intensity} value={intensity}>
                  {PAIN_INTENSITY_LABELS[intensity]}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}
