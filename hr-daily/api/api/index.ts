// Vercel Functions 진입점. vercel.json 의 rewrite 로 모든 경로가 이 함수로 온다.
// Vercel 의 Node 런타임은 (req, res) 형태의 Node 요청을 넘긴다. @hono/node-server 의
// getRequestListener 가 Node 요청을 Web Request 로 바꿔 Hono 에 넘기고 응답을 되돌려 쓴다.
// (hono/vercel 은 Web Request 전용이라 "this.raw.headers.get is not a function" 이 난다)
import { getRequestListener } from "@hono/node-server";
import app from "../src/app.js";

export default getRequestListener(app.fetch);
