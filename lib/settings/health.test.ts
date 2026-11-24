import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { deleteHealthData, withdrawConsent } from "@/lib/settings/health";

// 가짜 Supabase: 어떤 표에서 지웠는지·고쳤는지 기록하고, 지정한 표에서 오류를 낸다. (시험에는 가짜 값만 쓴다)
function fake(options: { failDelete?: string; profileRows?: number } = {}) {
  const log: string[] = [];
  const client = {
    from(table: string) {
      return {
        delete: () => ({
          eq: async (column: string, value: string) => {
            log.push(`delete ${table} ${column}=${value}`);
            return { error: options.failDelete === table ? new Error("fail") : null };
          },
        }),
        update: (values: Record<string, unknown>) => ({
          eq: (column: string, value: string) => ({
            select: async () => {
              log.push(`update ${table} ${JSON.stringify(values)} ${column}=${value}`);
              return { data: Array.from({ length: options.profileRows ?? 1 }, () => ({ user_id: value })), error: null };
            },
          }),
        }),
      };
    },
  } as unknown as SupabaseClient;
  return { client, log };
}

describe("deleteHealthData", () => {
  it("checkins와 pains만 지우고 다른 표는 건드리지 않는다", async () => {
    const { client, log } = fake();
    await deleteHealthData(client, "u1");
    expect(log).toEqual(["delete checkins user_id=u1", "delete pains user_id=u1"]);
  });

  it("지우기에 실패하면 오류를 던진다", async () => {
    await expect(deleteHealthData(fake({ failDelete: "pains" }).client, "u1")).rejects.toThrow();
  });
});

describe("withdrawConsent", () => {
  it("건강정보를 먼저 지운 뒤 동의를 철회로 바꾼다", async () => {
    const { client, log } = fake();
    await withdrawConsent(client, "u1");
    expect(log[0]).toContain("delete checkins");
    expect(log[1]).toContain("delete pains");
    expect(log[2]).toContain('"health_consent":false');
    expect(log[2]).toContain('"health_consent_at":null');
  });

  it("건강정보를 지우지 못하면 동의를 철회하지 않는다", async () => {
    const { client, log } = fake({ failDelete: "checkins" });
    await expect(withdrawConsent(client, "u1")).rejects.toThrow();
    expect(log.some((line) => line.startsWith("update"))).toBe(false);
  });

  it("프로필 행을 못 찾으면 오류를 던진다", async () => {
    await expect(withdrawConsent(fake({ profileRows: 0 }).client, "u1")).rejects.toThrow();
  });
});
