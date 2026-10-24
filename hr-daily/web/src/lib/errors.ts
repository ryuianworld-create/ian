import type { ApiErrorBody } from "./types";

export class ApiError extends Error {
  status: number;
  code: string;
  body: ApiErrorBody | null;

  constructor(status: number, code: string, message: string, body: ApiErrorBody | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

export function errorMessage(e: unknown, fallback = "요청을 처리하지 못했습니다."): string {
  if (isApiError(e)) return e.message || fallback;
  if (e instanceof Error) return e.message || fallback;
  return fallback;
}
