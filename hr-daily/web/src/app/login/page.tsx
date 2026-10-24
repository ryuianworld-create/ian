import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = { title: "로그인" };

export default function LoginPage() {
  return (
    <section>
      <div className="sec-head" style={{ marginTop: 20 }}>
        <span className="eyebrow">Sign in</span>
        <h2 className="sec">로그인</h2>
      </div>
      <p className="page-note">가입하신 이메일과 비밀번호로 로그인하세요. 승인된 회원은 전체 아티클을 읽을 수 있습니다.</p>
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
    </section>
  );
}
