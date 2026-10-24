import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = { title: "가입" };

export default function SignupPage() {
  return (
    <section>
      <div className="sec-head" style={{ marginTop: 20 }}>
        <span className="eyebrow">Sign up</span>
        <h2 className="sec">가입하기</h2>
      </div>
      <p className="page-note">
        가입 후 관리자가 승인하면 지난 아티클 전체를 읽고, 매일 아침 7시에 그날의 아티클을 메일로 받습니다. 승인 여부는
        메일로 알려드립니다.
      </p>
      <Suspense>
        <AuthForm mode="signup" />
      </Suspense>
    </section>
  );
}
