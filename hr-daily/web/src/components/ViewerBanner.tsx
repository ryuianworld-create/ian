import Link from "next/link";
import type { Viewer } from "@/lib/types";

/** 상단 viewer 상태 배너. anon/approved/admin 은 표시하지 않는다. */
export function ViewerBanner({ viewer }: { viewer: Viewer }) {
  if (viewer.kind === "pending") {
    return (
      <div className="banner pending" role="status">
        <span>
          <b>승인 대기 중</b>입니다. 관리자가 승인하면 메일로 알려드리고, 그때부터 전체 아티클과 매일 아침 메일을 받을 수
          있습니다. 그동안 단어 진도는 저장됩니다.
        </span>
        <Link className="lnk" href="/pending">
          자세히 →
        </Link>
      </div>
    );
  }
  if (viewer.kind === "rejected") {
    return (
      <div className="banner rejected" role="status">
        <span>
          가입 요청이 <b>승인되지 않았습니다</b>. 최신 {" "}무료 아티클은 계속 읽을 수 있습니다. 문의는 내 정보 화면을
          참고하세요.
        </span>
        <Link className="lnk" href="/account">
          내 정보 →
        </Link>
      </div>
    );
  }
  return null;
}
