import type { Metadata } from "next";
import { LoginForm } from "@/app/login/LoginForm";

export const metadata: Metadata = { title: "로그인 · RunPilot" };

export default function LoginPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">로그인</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">이메일과 비밀번호로 로그인합니다.</p>
      </div>
      <LoginForm />
    </div>
  );
}
