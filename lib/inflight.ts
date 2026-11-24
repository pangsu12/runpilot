// Design Ref: §9 보안(SEC-002) — 같은 사용자가 같은 일을 동시에 여러 개 시작하지 못하게 한다.
// 계획 만들기는 AI를 최대 3번 부르는 비싼 일이라, 한 사용자당 한 번에 하나만 실행한다. (서버 한 대 기준의 방어. 시간당 횟수 제한은 DB 기록으로 따로 막는다)

const running = new Set<string>();

/**
 * key가 이미 실행 중이면 fn을 부르지 않고 "busy"를 돌려준다. 끝나면(오류가 나도) 자리를 반드시 비운다.
 */
export async function runExclusive<T>(key: string, fn: () => Promise<T>): Promise<{ busy: true } | { busy: false; value: T }> {
  if (running.has(key)) return { busy: true };
  running.add(key);
  try {
    return { busy: false, value: await fn() };
  } finally {
    running.delete(key);
  }
}
