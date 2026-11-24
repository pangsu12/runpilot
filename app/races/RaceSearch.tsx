"use client";

import { useActionState, useState } from "react";
import { addSearchedRace, searchRaceAction, type RaceSearchState } from "@/app/races/actions";
import type { RaceCandidate } from "@/lib/events/search";

// Design Ref: §5.3 대회 — 고러닝 검색. 결과에서 골라 저장하고, 조회가 실패하면 직접 입력으로 넘어가게 안내한다.
// 보내는 것은 검색어뿐이고, 신청 마감일을 모르면 "신청 마감일 미확인"으로 표시한다.

function ResultItem({ item }: { item: RaceCandidate }) {
  const [state, action, pending] = useActionState<RaceSearchState, FormData>(addSearchedRace, undefined);
  const [distance, setDistance] = useState(item.categories[0] ?? "");
  const saved = Boolean(state?.savedName);

  return (
    <li className="flex flex-col gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
      <span className="font-medium">{item.name}</span>
      <span className="text-zinc-600 dark:text-zinc-400">
        {item.date}
        {item.location ? ` · ${item.location}` : ""}
      </span>
      <span className="text-xs text-zinc-500 dark:text-zinc-400">
        {item.registrationEnd ? `신청 마감 ${item.registrationEnd}` : "신청 마감일 미확인"}
        {item.officialUrl ? (
          <>
            {" · "}
            <a href={item.officialUrl} target="_blank" rel="noopener noreferrer" className="underline">
              공식 페이지
            </a>
          </>
        ) : null}
      </span>
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="name" value={item.name} />
        <input type="hidden" name="date" value={item.date} />
        <input type="hidden" name="location" value={item.location ?? ""} />
        <input type="hidden" name="registrationStart" value={item.registrationStart ?? ""} />
        <input type="hidden" name="registrationEnd" value={item.registrationEnd ?? ""} />
        <input type="hidden" name="officialUrl" value={item.officialUrl ?? ""} />
        {item.categories.length > 0 ? (
          <label className="flex items-center gap-1 text-xs">
            종목
            <select
              name="distance"
              value={distance}
              onChange={(event) => setDistance(event.target.value)}
              className="rounded-md border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
            >
              {item.categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <input type="hidden" name="distance" value="" />
        )}
        <button
          type="submit"
          disabled={pending || saved}
          className="rounded-md bg-zinc-900 px-3 py-1 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {saved ? "저장함" : pending ? "저장하는 중..." : "이 대회 저장"}
        </button>
      </form>
      {state?.message ? (
        <p role="alert" className="text-xs text-red-700 dark:text-red-300">
          {state.message}
        </p>
      ) : null}
    </li>
  );
}

export function RaceSearch() {
  const [state, action, pending] = useActionState<RaceSearchState, FormData>(searchRaceAction, undefined);

  return (
    <div className="flex flex-col gap-3">
      <form action={action} className="flex gap-2">
        <input
          name="query"
          type="search"
          defaultValue={state?.query ?? ""}
          placeholder="예: 서울, 하프, 한강"
          maxLength={50}
          aria-label="대회 검색어"
          className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "찾는 중..." : "검색"}
        </button>
      </form>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        고러닝(gorunning.kr)의 공개 대회 목록에서 찾습니다. 입력한 검색어 외에는 보내지 않습니다.
      </p>

      {state?.message ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {state.message}
        </p>
      ) : null}
      {state?.failed ? (
        <p role="alert" className="rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm text-yellow-900 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-200">
          대회 목록을 불러오지 못했습니다. 아래 &quot;대회 직접 입력&quot;으로 추가해 주세요.
        </p>
      ) : null}
      {state?.items && state.items.length === 0 ? (
        <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
          검색 결과가 없습니다. 다른 검색어를 쓰거나 아래에서 직접 입력해 주세요.
        </p>
      ) : null}
      {state?.items && state.items.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {state.items.map((item) => (
            <ResultItem key={`${item.name}|${item.date}`} item={item} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
