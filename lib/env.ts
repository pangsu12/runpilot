import { z } from "zod";

// Design Ref: §3, §9 — 키는 서버 코드에서만 읽고, 브라우저에 내보내지 않는다.
// 모든 이름은 NEXT_PUBLIC_ 없이 쓴다(Next.js는 이 접두사가 없는 값을 서버에서만 쓰게 한다).
// 값은 .env에서 읽기만 하고, 오류 메시지·로그에는 "이름"만 남기며 값은 절대 넣지 않는다.

/** 환경변수가 없거나 비어 있을 때 던지는 오류. 메시지에는 변수 "이름"만 들어간다. */
export class EnvError extends Error {
  readonly missing: string[];

  constructor(missing: string[]) {
    super(`필요한 환경변수가 없거나 비어 있습니다: ${missing.join(", ")}`);
    this.name = "EnvError";
    this.missing = missing;
  }
}

// 값이 비어 있으면 "없음"으로 본다.
const nonEmpty = z.string().trim().min(1);

/** 기능별로 필요한 서버 전용 환경변수 묶음 (PLAN 6번 환경변수 표와 같다). */
export const ENV_GROUPS = {
  // AI 계획 생성 (작업 15에서 사용). 모델 이름은 그때 정한다.
  openai: z.object({
    OPENAI_API_KEY: nonEmpty,
    OPENAI_MODEL: nonEmpty,
  }),
  // 서버에서 Supabase 접속 (작업 6에서 추가)
  supabase: z.object({
    SUPABASE_URL: nonEmpty,
    SUPABASE_ANON_KEY: nonEmpty,
  }),
  // 탈퇴 시 로그인 계정 삭제에만 쓰는 관리자 키 (일반 기록 조회·저장에는 쓰지 않는다)
  supabaseAdmin: z.object({
    SUPABASE_SERVICE_ROLE_KEY: nonEmpty,
  }),
} as const;

export type EnvGroupName = keyof typeof ENV_GROUPS;

type EnvSource = Record<string, string | undefined>;

/**
 * 필요한 환경변수 묶음을 읽어 검사한 값을 돌려준다.
 * 묶음마다 필요할 때만 검사하므로, 아직 준비되지 않은 묶음이 있어도 앱 빌드는 막지 않는다.
 * 시험에서는 두 번째 인자로 가짜 값을 넘길 수 있다.
 */
export function readEnv<G extends EnvGroupName>(
  group: G,
  source: EnvSource = process.env,
): z.infer<(typeof ENV_GROUPS)[G]> {
  const schema = ENV_GROUPS[group];
  const result = schema.safeParse(source);

  if (!result.success) {
    // 값이 아니라 변수 이름만 모은다.
    const missing = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
    throw new EnvError(missing);
  }

  return result.data as z.infer<(typeof ENV_GROUPS)[G]>;
}
