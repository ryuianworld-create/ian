// Hono 앱. 라우트는 /v1/* (공개·회원·관리자) 와 /cron/* (Vercel Cron). 헬스체크 GET /.
import { Hono } from "hono";
import { cors } from "hono/cors";
import { withAuth, type AppEnv } from "./lib/auth";
import { webUrl } from "./lib/env";
import { HttpError, errorBody } from "./lib/http";
import { admin } from "./routes/admin";
import { articles } from "./routes/articles";
import { cron } from "./routes/cron";
import { feed } from "./routes/feed";
import { library } from "./routes/library";
import { me } from "./routes/me";
import { stats } from "./routes/stats";
import { vocab } from "./routes/vocab";

export const app = new Hono<AppEnv>();

// CORS: WEB_URL + 로컬 개발 서버
app.use(
  "*",
  cors({
    origin: (origin) => {
      const allowed = new Set([webUrl(), "http://localhost:3000", "http://127.0.0.1:3000"]);
      return allowed.has(origin) ? origin : null;
    },
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    maxAge: 600,
  }),
);

app.get("/", (c) => c.json({ ok: true, service: "hr-daily-api", time: new Date().toISOString() }));

// /v1/* 는 모두 viewer 를 계산한다
app.use("/v1/*", withAuth);
app.route("/v1/feed", feed);
app.route("/v1/articles", articles);
app.route("/v1/library", library);
app.route("/v1/me", me);
app.route("/v1/vocab", vocab);
app.route("/v1/stats", stats);
app.route("/v1/admin", admin);

app.route("/cron", cron);

app.notFound((c) => c.json(errorBody("not_found", `경로가 없습니다: ${c.req.method} ${c.req.path}`), 404));

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json(errorBody(err.code, err.message, err.extra), err.status);
  console.error(`[${c.req.method} ${c.req.path}]`, err);
  const message = err instanceof Error ? err.message : "internal error";
  return c.json(errorBody("internal", message), 500);
});

export default app;
