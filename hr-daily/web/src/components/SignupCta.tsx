import Link from "next/link";
import type { ForbiddenCode, Viewer } from "@/lib/types";

type Props = {
  code?: ForbiddenCode;
  viewer?: Viewer;
  freeLimit?: number;
  compact?: boolean;
};

/** 잠긴 글 아래 / 403 미리보기 아래에 붙는 가입·승인 안내 */
export function SignupCta({ code, viewer, freeLimit = 5, compact }: Props) {
  const kind = code ?? (viewer?.kind === "pending" ? "approval_pending" : viewer?.kind === "rejected" ? "rejected" : "signup_required");

  if (kind === "approval_pending") {
    return (
      <div className="cta">
        <h3>승인을 기다리고 있습니다</h3>
        <p>관리자가 승인하면 메일로 알려드립니다. 승인 후에는 지난 아티클 전체와 매일 아침 메일을 받을 수 있습니다.</p>
        <div className="row">
          <Link href="/pending" className="btn">
            안내 보기
          </Link>
        </div>
      </div>
    );
  }
  if (kind === "rejected") {
    return (
      <div className="cta">
        <h3>이 글은 승인 회원만 읽을 수 있습니다</h3>
        <p>가입 요청이 승인되지 않았습니다. 최신 {freeLimit}편은 계속 무료로 읽을 수 있습니다.</p>
      </div>
    );
  }
  return (
    <div className="cta">
      <h3>{compact ? "가입하고 이어서 읽기" : `${freeLimit + 1}편째부터는 가입 후 읽을 수 있습니다`}</h3>
      <p>
        이메일로 가입하면 관리자 승인 후 지난 아티클 전체를 읽고, 매일 아침 7시에 그날의 아티클을 메일로 받습니다. 단어
        진도도 기기 간에 이어집니다.
      </p>
      <div className="row">
        <Link href="/signup" className="btn primary">
          가입하기
        </Link>
        <Link href="/login" className="btn">
          로그인
        </Link>
      </div>
    </div>
  );
}
