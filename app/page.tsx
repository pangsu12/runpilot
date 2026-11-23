// 임시 첫 화면: 공통 화면 틀(머리글·안내 문구)이 보이는지 확인하기 위한 자리다.
// 실제 화면(로그인, 대시보드 등)은 이후 작업에서 만든다.
export default function Home() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">RunPilot</h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-400">
        몸에 무리가 가지 않는 러닝 훈련을 돕는 참고용 가이드입니다.
      </p>
      <p className="text-sm text-zinc-500 dark:text-zinc-500">서비스를 준비하고 있습니다.</p>
    </div>
  );
}
