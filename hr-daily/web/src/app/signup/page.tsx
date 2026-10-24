import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";

export const metadata: Metadata = { title: "가입" };

export default function SignupPage() {
  return (
    <AuthShell
      eyebrow="Sign up"
      title="가입하기"
      intro="가입 후 관리자가 승인하면 지난 호 전체를 읽고, 매일 아침 7시에 그날의 아티클을 메일로 받습니다. 승인 여부는 메일로 알려드립니다."
    >
      <Suspense>
        <AuthForm mode="signup" />
      </Suspense>
    </AuthShell>
  );
}
