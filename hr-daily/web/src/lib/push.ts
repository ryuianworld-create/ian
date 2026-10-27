// 웹 푸시 클라이언트 헬퍼. 서비스 워커(/sw.js) 등록 → PushManager 구독 → API 에 저장.
// iOS 는 16.4+ 에서 "홈 화면에 추가"한 웹앱(standalone)일 때만 푸시가 된다.
import { api } from "./api";

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type PushSupport =
  | { kind: "unsupported"; reason: string }
  | { kind: "ios_needs_home_screen" }
  | { kind: "denied" }
  | { kind: "ready"; permission: NotificationPermission };

function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return { kind: "unsupported", reason: "server" };
  if (!VAPID_PUBLIC_KEY) return { kind: "unsupported", reason: "서버에 푸시 키가 설정되지 않았습니다." };
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    if (isIOS() && !isStandalone()) return { kind: "ios_needs_home_screen" };
    return { kind: "unsupported", reason: "이 브라우저는 웹 푸시를 지원하지 않습니다." };
  }
  if (isIOS() && !isStandalone()) return { kind: "ios_needs_home_screen" };
  if (Notification.permission === "denied") return { kind: "denied" };
  return { kind: "ready", permission: Notification.permission };
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  return reg;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

/** 권한 요청 → 구독 → 서버 저장. 사용자 클릭 핸들러 안에서만 호출할 것 (iOS 요구사항). */
export async function subscribePush(token: string): Promise<PushSubscription> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("알림 권한이 허용되지 않았습니다.");
  const reg = await registration();
  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    }));
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error("구독 정보를 만들지 못했습니다.");
  await api.pushSubscribe({ endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth }, user_agent: navigator.userAgent }, token);
  return sub;
}

export async function unsubscribePush(token: string): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => undefined);
  await api.pushUnsubscribe(endpoint, token).catch(() => undefined);
}
