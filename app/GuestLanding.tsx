"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

// Design Ref: §5.2 첫 화면 — MotionSites 무료 디자인 "Zapline" 프롬프트의 구성(검은 별하늘, 보라 행성 테두리, 큰 제목, 아래에서 올라오는 대시보드)을
// 러닝 서비스에 맞게 Next.js·Tailwind로 직접 옮긴 것이다. 프롬프트 글은 저장하지 않았다. 화면 속 숫자는 "예시"이며 실제 사용자 데이터가 아니다.
// 하늘은 코드로 움직이지 않는다. 별은 한 번만 그리고, 움직임은 (큰 화면에서만) 영상이 맡는다. 움직임 줄이기 설정이면 영상과 입장 효과를 쓰지 않는다.

const GLOW_VIDEO = "https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/e859f229-8ebd-43fb-a5a0-58006ba75327.mp4";

/** 별: 흰 점을 한 번만 그린다. (크기가 바뀌면 다시 그린다) */
function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(ratio, ratio);
      ctx.clearRect(0, 0, width, height);
      // 결정된 순서의 가짜 난수라서 다시 그려도 같은 별자리다.
      let seed = 7;
      const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
      const count = Math.round((width * height) / 5200);
      for (let i = 0; i < count; i += 1) {
        const x = random() * width;
        const y = random() * height;
        const r = random() * 1.1 + 0.2;
        ctx.globalAlpha = random() * 0.7 + 0.15;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);
  return <canvas ref={ref} aria-hidden="true" className="absolute inset-0 h-full w-full" />;
}

const WIDE = "(min-width: 900px)";
const CALM = "(prefers-reduced-motion: reduce)";
function motionAllowed(): boolean {
  return window.matchMedia(WIDE).matches && !window.matchMedia(CALM).matches;
}
function subscribeMotion(onChange: () => void): () => void {
  const lists = [window.matchMedia(WIDE), window.matchMedia(CALM)];
  lists.forEach((list) => list.addEventListener("change", onChange));
  return () => lists.forEach((list) => list.removeEventListener("change", onChange));
}

/** 큰 화면에서만 재생되는 빛 영상. 끝과 처음을 어둡게 겹쳐 이음매가 보이지 않게 한다. */
function GlowVideo() {
  // 큰 화면이고 움직임 줄이기를 켜지 않았을 때만 영상을 쓴다. (서버에서 그릴 때는 쓰지 않는다)
  const enabled = useSyncExternalStore(subscribeMotion, motionAllowed, () => false);
  const [ready, setReady] = useState(false);
  const video = useRef<HTMLVideoElement>(null);

  if (!enabled) return null;
  return (
    <video
      ref={video}
      src={GLOW_VIDEO}
      muted
      loop
      autoPlay
      playsInline
      preload="auto"
      aria-hidden="true"
      onCanPlay={() => setReady(true)}
      onTimeUpdate={(event) => {
        const el = event.currentTarget;
        if (!el.duration) return;
        const fade = 0.6;
        const edge = Math.min(el.currentTime, el.duration - el.currentTime);
        el.style.opacity = String(ready ? Math.min(1, edge / fade) : 0);
      }}
      style={{ opacity: 0 }}
      className="pointer-events-none absolute left-1/2 top-0 hidden h-[44vw] max-h-[720px] w-[130%] -translate-x-1/2 object-cover mix-blend-screen md:block"
    />
  );
}

const MENU = ["대시보드", "계획", "대회", "기록", "설정"] as const;
const WEEK_KM = [8, 12, 10, 14, 11, 16, 18];

function areaPath(values: readonly number[], width: number, height: number): { line: string; area: string } {
  const max = Math.max(...values) * 1.15;
  const step = width / (values.length - 1);
  const points = values.map((value, index) => [index * step, height - (value / max) * height] as const);
  const line = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return { line, area: `${line} L${width} ${height} L0 ${height} Z` };
}

function DashboardPreview() {
  const chart = areaPath(WEEK_KM, 420, 120);
  return (
    <div
      aria-label="RunPilot 화면 예시"
      role="img"
      className="lp-in relative mx-auto w-full max-w-[1204px] overflow-hidden rounded-t-[14px] border border-b-0 border-violet-500/40 bg-[#0b0712]/90 text-left shadow-[0_-30px_120px_-30px_rgba(147,18,255,0.55)] backdrop-blur"
      style={{ "--d": "1.1s" } as React.CSSProperties}
    >
      {/* 위쪽 가장자리를 따라 흐르는 보라 빛 */}
      <div aria-hidden="true" className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-violet-400 to-transparent" />
      <div aria-hidden="true" className="absolute inset-x-0 -top-10 h-16 bg-gradient-to-b from-violet-600/30 to-transparent blur-xl" />

      <div className="grid gap-0 md:grid-cols-[210px_1fr]">
        <aside className="flex gap-2 overflow-x-auto border-b border-white/10 p-3 md:flex-col md:gap-1 md:border-b-0 md:border-r md:p-4">
          <p className="hidden items-center gap-2 pb-3 text-sm font-semibold md:flex">
            <span aria-hidden="true" className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-violet-600 text-xs">R</span>
            RunPilot
          </p>
          {MENU.map((item, index) => (
            <span
              key={item}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs md:text-sm ${index === 0 ? "bg-violet-600/30 text-white ring-1 ring-violet-400/40" : "text-zinc-400"}`}
            >
              {item}
            </span>
          ))}
          <div className="mt-auto hidden rounded-xl border border-violet-500/30 bg-violet-600/10 p-3 text-xs md:block">
            <p className="font-semibold text-white">AI 4주 계획</p>
            <p className="mt-1 text-zinc-400">규칙 검증을 통과한 계획만 보여줘요.</p>
            <span className="mt-2 inline-block rounded-full bg-violet-600 px-3 py-1 font-medium text-white">만들기</span>
          </div>
        </aside>

        <div className="flex flex-col gap-4 p-4 md:p-6">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>예시 화면 · 실제 기록이 아니에요</span>
            <span className="rounded-full bg-white/5 px-3 py-1 text-zinc-300">러너 A · D-45</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "이번 주 거리", value: "18.4 km", delta: "+9%", good: true },
              { label: "휴식일", value: "3일", delta: "주 1일 이상", good: true },
            ].map((stat) => (
              <div key={stat.label} className="lp-stat rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs text-zinc-400">{stat.label}</p>
                <p className="mt-1 text-2xl font-semibold">
                  {stat.value} <span className={`text-xs font-medium ${stat.good ? "text-[#45b558]" : "text-[#f03b2a]"}`}>{stat.delta}</span>
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
            <div className="lp-stat rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm font-medium">주간 거리 변화</p>
              <svg viewBox="0 0 420 120" className="mt-3 h-32 w-full" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <linearGradient id="lp-area" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#9312ff" stopOpacity="0.55" />
                    <stop offset="100%" stopColor="#9312ff" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={chart.area} fill="url(#lp-area)" />
                <path d={chart.line} fill="none" stroke="#a020ff" strokeWidth="2" />
              </svg>
            </div>
            <div className="lp-stat flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
              <p className="font-medium">이번 주 계획</p>
              {[
                ["훈련", "4회"],
                ["거리 증가 한도", "10% 미만"],
                ["주의 안내", "없음"],
              ].map(([name, value]) => (
                <p key={name} className="flex justify-between border-b border-white/5 pb-1 text-zinc-300">
                  <span>{name}</span>
                  <span className="font-medium text-white">{value}</span>
                </p>
              ))}
              <p className="text-xs text-zinc-400">연결: 고러닝 · AI 계획(규칙 검증)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function GuestLanding() {
  return (
    <section className="relative isolate overflow-hidden bg-black text-[#f7f7f8]">
      <Starfield />
      {/* 행성 테두리: 영상이 없을 때(작은 화면·움직임 줄이기)에도 보이는 정지 이미지 */}
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-[190px] -z-0 aspect-square w-[210%] -translate-x-1/2 rounded-full bg-black shadow-[0_-6px_70px_8px_rgba(147,18,255,0.75),inset_0_30px_90px_rgba(122,28,248,0.45)] md:w-[150%]"
      />
      <GlowVideo />

      <div className="relative z-10 mx-auto flex min-h-[calc(100svh-57px)] max-w-5xl flex-col items-center gap-6 px-5 pt-16 text-center md:pt-24">
        <h1 className="flex flex-col gap-1 text-[clamp(2.5rem,7vw,5.25rem)] font-bold leading-[1.05] tracking-tight">
          <span className="lp-in" style={{ "--d": "0.2s" } as React.CSSProperties}>
            <span className="bg-gradient-to-b from-violet-300 to-violet-600 bg-clip-text text-transparent">RunPilot</span> 무리 없이,
          </span>
          <span className="lp-in" style={{ "--d": "0.35s" } as React.CSSProperties}>
            더 멀리, 더 안전하게.
          </span>
        </h1>
        <p className="lp-in max-w-2xl text-[clamp(0.95rem,1.6vw,1.2rem)] text-zinc-300" style={{ "--d": "0.55s" } as React.CSSProperties}>
          나이대와 러닝 경험에 맞춘 4주 계획을 만들고, 기록과 통증을 보며 쉬어야 할 때를 알려 드려요. 판단은 코드 규칙이 하고, AI 계획은 규칙을 통과해야만 보여줍니다.
        </p>
        <div className="lp-in flex flex-wrap justify-center gap-3" style={{ "--d": "0.75s" } as React.CSSProperties}>
          <Link href="/signup" className="rounded-full bg-gradient-to-b from-[#a020ff] to-[#7a1cf8] px-7 py-3 font-semibold text-white shadow-[0_0_0_1px_rgba(255,255,255,0.15)_inset] transition hover:brightness-125 hover:shadow-[0_0_30px_rgba(147,18,255,0.7)]">
            무료로 시작하기
          </Link>
          <Link href="/login" className="rounded-full border border-white/15 bg-white/5 px-7 py-3 font-semibold text-white transition hover:bg-white/10 hover:shadow-[0_0_24px_rgba(147,18,255,0.4)]">
            로그인
          </Link>
        </div>

        <div className="mt-auto w-full pt-10">
          <DashboardPreview />
        </div>
      </div>
    </section>
  );
}
