import type { Metadata } from "next";
import { SignupForm } from "@/app/signup/SignupForm";

export const metadata: Metadata = { title: "회원가입 · RunPilot" };

export default function SignupPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">회원가입</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          이메일과 비밀번호로 가입합니다. 만 19세 이상만 가입할 수 있습니다.
        </p>
      </div>
      <SignupForm />
    </div>
  );
}
