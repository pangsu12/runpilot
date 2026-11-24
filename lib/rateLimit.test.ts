import { describe, expect, it } from "vitest";
import { createRateLimiter } from "@/lib/rateLimit";

describe("createRateLimiter", () => {
  it("한도까지는 허용하고 넘으면 막는다", () => {
    const limiter = createRateLimiter({ max: 3, windowMs: 1000 });
    expect([1, 2, 3, 4].map((i) => limiter.allow("a", i))).toEqual([true, true, true, false]);
  });

  it("시간이 지나면 다시 허용한다", () => {
    const limiter = createRateLimiter({ max: 2, windowMs: 1000 });
    limiter.allow("a", 0);
    limiter.allow("a", 10);
    expect(limiter.allow("a", 500)).toBe(false);
    expect(limiter.allow("a", 1005)).toBe(true); // 처음 호출이 창 밖으로 나감
  });

  it("사용자마다 따로 센다", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 1000 });
    expect(limiter.allow("a", 0)).toBe(true);
    expect(limiter.allow("b", 0)).toBe(true);
    expect(limiter.allow("a", 1)).toBe(false);
  });

  it("막힌 호출은 횟수에 더하지 않는다", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 1000 });
    limiter.allow("a", 0);
    for (let i = 1; i < 50; i += 1) limiter.allow("a", i);
    expect(limiter.allow("a", 1001)).toBe(true);
  });
});
