-- 트리거 전용 함수는 REST RPC 로 호출되면 안 된다 (Supabase 보안 린터 0028/0029)
revoke execute on function public.handle_new_user() from public, anon, authenticated;
