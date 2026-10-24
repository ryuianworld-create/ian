import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";

export const metadata: Metadata = { title: "로그인" };

export default function LoginPage() {
  return (
    <AuthShell eyebrow="Sign in" title="로그인" intro="가입하신 이메일과 비밀번호로 로그인하세요. 승인된 회원은 지난 호 전체를 읽을 수 있습니다.">
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
    </AuthShell>
  );
}
