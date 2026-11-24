// Design Ref: §9 보안 — 비용이 드는 서버 기능(대회 검색 등)을 한 사람이 짧은 시간에 반복 호출하지 못하게 막는다.
// 서버 메모리에 사용자별 호출 시각을 세는 간단한 방식이다. 서버가 여러 대로 나뉘거나 다시 시작하면 횟수가 초기화되므로
// "최선의 방어"이며, 계획 만들기처럼 돈이 드는 기능은 데이터베이스 기록으로도 따로 막는다. (lib/plans/store.ts)

export type RateLimiter = {
  /** 허용되면 true. 허용하면 이번 호출을 센다. */
  allow(key: string, now?: number): boolean;
  /** 시험용: 모든 기록을 지운다. */
  reset(): void;
};

/**
 * @param max 시간 창 안에서 허용하는 최대 호출 수
 * @param windowMs 시간 창(밀리초)
 */
export function createRateLimiter(options: { max: number; windowMs: number }): RateLimiter {
  const hits = new Map<string, number[]>();
  return {
    allow(key, now = Date.now()) {
      const since = now - options.windowMs;
      const recent = (hits.get(key) ?? []).filter((time) => time > since);
      if (recent.length >= options.max) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      // 오래 안 쓰는 키가 쌓이지 않게 가끔 정리한다.
      if (hits.size > 5000) {
        for (const [k, times] of hits) if (times.every((time) => time <= since)) hits.delete(k);
      }
      return true;
    },
    reset() {
      hits.clear();
    },
  };
}
