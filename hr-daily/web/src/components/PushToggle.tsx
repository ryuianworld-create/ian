"use client";
// "새 글 알림" 켜기/끄기 카드. 로그인한 사용자가 기기별로 웹 푸시를 구독한다.
import { useEffect, useState } from "react";
import { errorMessage } from "@/lib/errors";
import { currentSubscription, pushSupport, subscribePush, unsubscribePush, type PushSupport } from "@/lib/push";
import { useAuth } from "./AuthProvider";

type State = { support: PushSupport; subscribed: boolean } | null;

export function PushToggle({ compact = false }: { compact?: boolean }) {
  const { ready, token } = useAuth();
  const [state, setState] = useState<State>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const support = pushSupport();
      const sub = support.kind === "ready" ? await currentSubscription().catch(() => null) : null;
      if (alive) setState({ support, subscribed: Boolean(sub) });
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!ready || !token || !state) return null;
  const { support, subscribed } = state;

  const enable = async () => {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      await subscribePush(token);
      setState({ support: pushSupport(), subscribed: true });
      setDone("이 기기에서 새 글 알림을 받습니다. 매일 아침 7시 전후에 옵니다.");
    } catch (e) {
      setError(errorMessage(e));
      setState({ support: pushSupport(), subscribed: false });
    } finally {
      setBusy(false);
    }
  };
  const disable = async () => {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      await unsubscribePush(token);
      setState({ support: pushSupport(), subscribed: false });
      setDone("이 기기의 새 글 알림을 껐습니다.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  let body: React.ReactNode;
  if (support.kind === "ios_needs_home_screen") {
    body = (
      <p className="m-0 text-xs leading-relaxed text-slate-600">
        iPhone·iPad에서는 홈 화면에 추가한 앱에서만 알림을 켤 수 있습니다. Safari 공유 버튼 → <b>홈 화면에 추가</b> 후, 홈 화면의
        DailyHR 앱을 열어 이 버튼을 눌러 주세요.
      </p>
    );
  } else if (support.kind === "unsupported") {
    body = <p className="m-0 text-xs leading-relaxed text-slate-600">{support.reason}</p>;
  } else if (support.kind === "denied") {
    body = (
      <p className="m-0 text-xs leading-relaxed text-slate-600">
        알림 권한이 차단돼 있습니다. 기기 설정 → 알림(또는 브라우저 사이트 설정)에서 DailyHR 알림을 허용한 뒤 다시 시도해 주세요.
      </p>
    );
  } else {
    body = subscribed ? (
      <button type="button" className="btn" onClick={disable} disabled={busy}>
        {busy ? "처리 중…" : "이 기기 알림 끄기"}
      </button>
    ) : (
      <button type="button" className="btn primary" onClick={enable} disabled={busy}>
        {busy ? "허용 대기 중…" : "이 기기에서 새 글 알림 켜기"}
      </button>
    );
  }

  return (
    <div className={`push-card${compact ? " compact" : ""}`}>
      <div className="push-head">
        <span className="push-title">🔔 새 글 알림</span>
        <span className={`push-state ${subscribed ? "on" : ""}`}>{subscribed ? "켜짐" : "꺼짐"}</span>
      </div>
      {!compact ? (
        <p className="m-0 text-xs leading-relaxed text-slate-600">
          매일 아침 새 아티클이 올라오면 이 기기로 알림을 보냅니다. 메일·카카오톡과 별개로 기기마다 켭니다.
        </p>
      ) : null}
      {body}
      {error ? <div className="err">{error}</div> : null}
      {done ? <div className="msg">{done}</div> : null}
    </div>
  );
}
