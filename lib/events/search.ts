import { searchEvents, type RawEvent } from "korean-marathon-schedule";
import { RACE_INPUT_LIMITS } from "@/lib/rules/constants";
import { addDaysIso, isValidIsoDate } from "@/lib/schemas/date";

// Design Ref: §7.9 대회 검색 — 고러닝(gorunning.kr) 공개 목록을 korean-marathon-schedule로 조회한다.
// 서버에서만 호출하고, 외부로 나가는 것은 "조회" 요청뿐이다. 검색어는 이 서버에서 결과를 거를 때만 쓰고 고러닝에 보내지 않는다.
// 결과에 없는 정보(코스 특성 등)는 추측하지 않고, 신청 마감일을 모르면 비워 둔다. (화면에는 "신청 마감일 미확인")
// 조회가 실패하면 직접 입력으로 넘어가게 한다.

export const SEARCH_QUERY_MAX_LENGTH = 50;
export const SEARCH_RESULT_LIMIT = 8;
/** 고러닝 상세 페이지를 최대 몇 개까지 확인할지, 전체 제한 시간(밀리초) (임시값) */
const MAX_DETAILS = 60;
export const SEARCH_TIMEOUT_MS = 20_000;

/** 화면에 보여주고 저장할 수 있는 검색 결과 하나 */
export type RaceCandidate = {
  name: string;
  date: string;
  location: string | null;
  categories: string[];
  registrationStart: string | null;
  registrationEnd: string | null;
  officialUrl: string | null;
};

export type SearchOutcome = { ok: true; items: RaceCandidate[] } | { ok: false; reason: "failed" };

/** https 주소만 받는다. 그 밖(javascript:, http: 등)은 버린다. */
export function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 500) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * 종목 표시가 "10km", "하프", "하프 마라톤(21.0975km)"처럼 거리나 짧은 종목 이름 모양인지. 비어 있어도 된다.
 * 이 글은 AI 요청에도 들어가므로 문장(지시문)처럼 보이는 것은 거부한다. (보안 검토 SEC-007)
 */
const DISTANCE_LABEL = /^(?:\d{1,3}(?:\.\d{1,4})?\s?(?:km|K|k|㎞|마일|mile|miles)|[가-힣A-Za-z]{1,10}(?:\s[가-힣A-Za-z]{1,10})?(?:\(\d{1,3}(?:\.\d{1,4})?km\))?)$/;
export function isSafeDistanceLabel(value: string): boolean {
  return value === "" || DISTANCE_LABEL.test(value);
}

const validDate = (value: unknown): string | null => (typeof value === "string" && isValidIsoDate(value) ? value : null);

/**
 * 조회 결과를 우리 모양으로 바꾼다. 지난 날짜·너무 먼 날짜·이름이나 날짜가 없는 것은 빼고, 같은 대회(이름+날짜)는 한 번만 남긴다.
 */
export function normalizeEvents(raw: readonly RawEvent[], today: string): RaceCandidate[] {
  const lastDate = addDaysIso(today, RACE_INPUT_LIMITS.maxDaysAhead);
  const seen = new Set<string>();
  const items: RaceCandidate[] = [];
  for (const event of raw) {
    const name = typeof event.title === "string" ? event.title.trim().slice(0, RACE_INPUT_LIMITS.nameMaxLength) : "";
    const date = validDate(event.eventDate);
    if (!name || !date || date < today || date > lastDate) continue;
    const key = `${name}|${date}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const place = [event.region, event.venue].filter((part): part is string => typeof part === "string" && part.trim() !== "").join(" ");
    items.push({
      name,
      date,
      location: place ? place.slice(0, RACE_INPUT_LIMITS.locationMaxLength) : null,
      categories: (Array.isArray(event.categories) ? event.categories : [])
        .filter((value): value is string => typeof value === "string" && value.trim() !== "")
        .map((value) => value.trim().slice(0, 30))
        .filter(isSafeDistanceLabel)
        .slice(0, 10),
      registrationStart: validDate(event.registrationPeriod?.start),
      registrationEnd: validDate(event.registrationPeriod?.end) ?? validDate(event.registrationDeadline),
      officialUrl: safeHttpsUrl(event.officialUrl) ?? safeHttpsUrl(event.url),
    });
    if (items.length >= SEARCH_RESULT_LIMIT) break;
  }
  return items;
}

type Search = typeof searchEvents;

// 보안 검토 SEC-003: 검색 한 번이 고러닝에 최대 61번 요청을 보내므로, 같은 검색어의 결과는 잠시 저장해 두고(캐시)
// 서버 한 대에서 동시에 도는 검색 수도 제한한다. 외부 사이트 부하와 서버 실행 시간을 줄이려는 것이다.
const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_MAX_ENTRIES = 100;
const MAX_CONCURRENT_SEARCHES = 3;
const cache = new Map<string, { at: number; items: RaceCandidate[] }>();
let activeSearches = 0;

/** 시험용: 캐시와 실행 수를 초기화한다. */
export function resetSearchState(): void {
  cache.clear();
  activeSearches = 0;
}

/**
 * 고러닝에서 대회를 찾는다. 실패하거나 제한 시간을 넘기면 ok: false를 돌려주고, 화면은 직접 입력을 안내한다.
 * @param deps 시험에서 가짜 조회 함수로 바꿔 끼운다.
 */
export async function searchRaces(
  query: string,
  today: string,
  deps: { search?: Search; now?: () => number } = {},
): Promise<SearchOutcome> {
  const search = deps.search ?? searchEvents;
  const now = deps.now ?? Date.now;

  // 같은 날 같은 검색어는 저장된 결과를 쓴다. (날짜가 바뀌면 지난 대회를 거르는 기준이 달라지므로 다시 조회한다)
  const cacheKey = `${today}|${query.trim().toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached && now() - cached.at < CACHE_TTL_MS) return { ok: true, items: cached.items };
  if (activeSearches >= MAX_CONCURRENT_SEARCHES) return { ok: false, reason: "failed" };

  activeSearches += 1;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  try {
    const result = await search({
      query,
      from: today,
      to: addDaysIso(today, RACE_INPUT_LIMITS.maxDaysAhead),
      limit: SEARCH_RESULT_LIMIT + 2, // 중복을 거르고도 남도록 조금 넉넉히 받는다 (많이 받을수록 오래 걸린다)
      maxDetailsPerSource: MAX_DETAILS,
      fetcher: (url, init) => fetch(url, { ...init, signal: controller.signal }),
    });
    const items = normalizeEvents(result.items, today);
    // 결과가 없는데 조회 자체가 실패했다는 경고가 있으면 "없음"이 아니라 "실패"로 본다.
    if (items.length === 0 && result.warnings.some((warning) => /source failed/i.test(warning))) {
      return { ok: false, reason: "failed" };
    }
    // 성공한 조회만 저장한다. (실패는 저장하지 않아 바로 다시 시도할 수 있다)
    if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
    cache.set(cacheKey, { at: now(), items });
    return { ok: true, items };
  } catch {
    return { ok: false, reason: "failed" };
  } finally {
    activeSearches -= 1;
    clearTimeout(timer);
  }
}
