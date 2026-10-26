// 로그인·가입·승인 대기 공통 셸. 왼쪽은 서비스 소개, 오른쪽은 카드.
import type { ReactNode } from "react";
import { Brand } from "./Brand";

type Props = { eyebrow: string; title: string; intro?: ReactNode; children: ReactNode };

export function AuthShell({ eyebrow, title, intro, children }: Props) {
  return (
    <div className="jr jr-auth">
      <aside className="jr-pitch">
        <Brand size="lg" />
        <p className="jr-tagline">하루 한 편, HR 아티클·논문을 한글과 영어로.</p>
        <ul className="jr-points">
          <li>
            <b>매일 아침 7시</b> 그날의 요약과 단어장이 메일로 옵니다.
          </li>
          <li>
            <b>학술지 3종과 매체 3곳</b>에서 꼭 읽어야 할 글을 고릅니다.
          </li>
          <li>
            <b>본문 속 HR 용어</b>를 그대로 외우고, 진도는 기기 간에 이어집니다.
          </li>
        </ul>
        <p className="jr-pitchnote">비로그인으로도 최신 5편은 읽을 수 있습니다.</p>
      </aside>
      <section className="jr-card">
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="jr-cardtitle">{title}</h1>
        {intro ? <p className="jr-cardintro">{intro}</p> : null}
        {children}
      </section>
    </div>
  );
}
