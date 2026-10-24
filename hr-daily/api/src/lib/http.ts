// 오류 응답 규약: { error: { code, message } } + HTTP 상태 (SPEC 「API 계약」)
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export class HttpError extends Error {
  constructor(
    public status: ContentfulStatusCode,
    public code: string,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function errorBody(code: string, message: string, extra?: Record<string, unknown>) {
  return { error: { code, message }, ...(extra ?? {}) };
}

export function fail(c: Context, status: ContentfulStatusCode, code: string, message: string, extra?: Record<string, unknown>) {
  return c.json(errorBody(code, message, extra), status);
}

export const badRequest = (msg: string, code = "bad_request") => new HttpError(400, code, msg);
export const unauthorized = (msg = "로그인이 필요합니다", code = "unauthorized") => new HttpError(401, code, msg);
export const forbidden = (msg = "권한이 없습니다", code = "forbidden") => new HttpError(403, code, msg);
export const notFound = (msg = "찾을 수 없습니다", code = "not_found") => new HttpError(404, code, msg);

/** JSON body 를 안전하게 읽는다. 비어 있거나 깨졌으면 {} / 400 */
export async function readJson(c: Context): Promise<Record<string, unknown>> {
  const text = await c.req.text();
  if (!text.trim()) return {};
  try {
    const v: unknown = JSON.parse(text);
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
    throw badRequest("JSON 객체가 필요합니다");
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw badRequest("JSON 본문을 해석할 수 없습니다");
  }
}

/** ?limit= 파싱: 정수, [1, max] 로 클램프 */
export function parseLimit(raw: string | undefined, def: number, max: number): number {
  if (raw === undefined || raw === "") return def;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) throw badRequest("limit 은 1 이상의 정수여야 합니다");
  return Math.min(n, max);
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
