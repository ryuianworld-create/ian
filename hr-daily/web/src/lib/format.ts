import type { Viewer } from "./types";

/** "2026-10-23" → "10.23" (서재 목록용) */
export function shortDate(d: string | null | undefined): string {
  return (d ?? "").slice(5).replace("-", ".");
}

export function stripTags(html: string): string {
  return String(html).replace(/<[^>]+>/g, "");
}

export function isLoggedIn(v: Viewer | null | undefined): boolean {
  return !!v && v.kind !== "anon";
}

export function viewerLabel(kind: Viewer["kind"]): string {
  switch (kind) {
    case "admin":
      return "관리자";
    case "approved":
      return "승인 회원";
    case "pending":
      return "승인 대기";
    case "rejected":
      return "승인 거절";
    default:
      return "비로그인";
  }
}
