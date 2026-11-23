// Design Ref: §8 서버 오류, §9 "로그에 건강정보 금지" (CLAUDE.md: 건강정보는 서버 로그와 오류 기록에 남기지 않는다)
// 서버에서 로그를 남길 때는 console.error를 직접 쓰지 않고 이 파일의 함수를 쓴다.
//
// 지키는 규칙
//  1) 오류는 "종류(name)·코드(code)·상태(status)"만 남기고 메시지(message)는 남기지 않는다.
//     데이터베이스 오류 메시지에는 저장하려던 행의 내용(통증 부위, 위험 증상 등)이 들어갈 수 있다.
//  2) 함께 남기는 정보(context)에서 건강정보 칸의 값은 가린다.
//  3) 비밀번호·키 같은 비밀 값 칸도 가린다.

const REDACTED = "[가림]";

/** 값을 가려야 하는 칸 이름 (대소문자·밑줄 무시). 건강정보와 비밀 값이다. */
const SENSITIVE_FIELD_NAMES = new Set(
  [
    // 건강정보
    "condition",
    "pain",
    "pains",
    "part",
    "intensity",
    "dangerSymptoms",
    "danger_symptoms",
    "symptom",
    "symptoms",
    "checkin",
    "checkins",
    "healthConsent",
    "health_consent",
    // 비밀 값
    "password",
    "token",
    "accessToken",
    "refreshToken",
    "apiKey",
    "authorization",
    "secret",
    "email",
  ].map((name) => name.toLowerCase().replaceAll("_", "")),
);

function isSensitiveName(name: string): boolean {
  return SENSITIVE_FIELD_NAMES.has(name.toLowerCase().replaceAll("_", ""));
}

/** 객체·배열 안쪽까지 훑어서, 민감한 칸의 값을 "[가림]"으로 바꾼 복사본을 돌려준다. */
export function redactSensitive(value: unknown, depth = 0): unknown {
  if (depth > 6) return REDACTED; // 너무 깊으면 통째로 가린다
  if (Array.isArray(value)) return value.map((item) => redactSensitive(item, depth + 1));
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      result[key] = isSensitiveName(key) ? REDACTED : redactSensitive(inner, depth + 1);
    }
    return result;
  }
  return value;
}

/** 오류에서 안전한 정보(종류·코드·상태)만 뽑는다. 메시지는 뽑지 않는다. */
export function safeErrorInfo(error: unknown): { name: string; code?: string; status?: number } {
  if (error === null || typeof error !== "object") return { name: typeof error };
  const record = error as { name?: unknown; code?: unknown; status?: unknown };
  return {
    name: typeof record.name === "string" ? record.name : "Error",
    ...(typeof record.code === "string" ? { code: record.code } : {}),
    ...(typeof record.status === "number" ? { status: record.status } : {}),
  };
}

/**
 * 서버 오류를 안전하게 기록한다.
 * @param scope 어디서 난 오류인지 (예: "auth.signup")
 * @param context 함께 남기고 싶은 정보. 민감한 칸은 자동으로 가려진다.
 */
export function logServerError(scope: string, error: unknown, context?: Record<string, unknown>): void {
  console.error(`[${scope}]`, safeErrorInfo(error), context ? redactSensitive(context) : "");
}
