import type { NextConfig } from "next";

// Design Ref: §9 보안 — 모든 응답에 보안 헤더를 붙인다.
// - CSP(콘텐츠 보안 정책): 우리 서버와 정해 둔 곳에서 온 것만 불러온다. 브라우저는 Supabase나 OpenAI에 직접 접속하지 않는다. (서버 기능만 접속)
// - 첫 화면의 빛 영상(public/glow.mp4)은 같은 서버에서 제공하므로 media-src는 'self'만 허용한다.
// - Next.js가 화면을 그릴 때 넣는 인라인 스크립트 때문에 script-src에 'unsafe-inline'이 필요하다. (nonce 방식은 공개 전 보안 검토 때 다시 판단한다)
// 개발 중(npm run dev)에는 핫 리로드가 필요해서 CSP를 붙이지 않는다.

const isDev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isDev
    ? []
    : [
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        { key: "Content-Security-Policy", value: csp },
      ]),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false, // "X-Powered-By: Next.js" 헤더를 숨긴다
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
