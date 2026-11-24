import { describe, expect, it } from "vitest";
import { runExclusive } from "@/lib/inflight";

describe("runExclusive", () => {
  it("같은 키가 실행 중이면 두 번째는 실행하지 않고 busy를 돌려준다", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let calls = 0;
    const first = runExclusive("u1", async () => {
      calls += 1;
      await gate;
      return "done";
    });
    const second = await runExclusive("u1", async () => {
      calls += 1;
      return "never";
    });
    expect(second).toEqual({ busy: true });
    release();
    expect(await first).toEqual({ busy: false, value: "done" });
    expect(calls).toBe(1);
  });

  it("다른 키는 동시에 실행할 수 있다", async () => {
    const [a, b] = await Promise.all([runExclusive("a", async () => 1), runExclusive("b", async () => 2)]);
    expect(a).toEqual({ busy: false, value: 1 });
    expect(b).toEqual({ busy: false, value: 2 });
  });

  it("오류가 나도 자리를 비워 다시 실행할 수 있다", async () => {
    await expect(runExclusive("e", async () => { throw new Error("x"); })).rejects.toThrow();
    expect(await runExclusive("e", async () => "ok")).toEqual({ busy: false, value: "ok" });
  });
});
