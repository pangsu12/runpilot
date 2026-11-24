import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Design Ref: §10.1 — 규칙 코드는 Vitest로 자동 시험한다.
// tsconfig의 "@/*" 별칭(프로젝트 루트)을 시험에서도 똑같이 쓰도록 맞춘다.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      "server-only": fileURLToPath(new URL("./vitest.server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
