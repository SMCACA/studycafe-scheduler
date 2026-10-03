-- ================================================================
-- 📁 sql/app_settings.sql
--    사이트 설정을 보관하는 작은 테이블 (예: 새 신청자 문자 받을 번호)
-- ================================================================
-- 사용법: Supabase → SQL Editor → New query → 전체 붙여넣기 → Run
-- 여러 번 실행해도 안전해요
-- ================================================================

create table if not exists app_settings (
  key        text primary key,          -- 설정 이름 (예: 'apply_notify_phones')
  value      jsonb,                     -- 설정 값  (예: ["01012345678","01099998888"])
  updated_at timestamptz default now()
);

-- 보안: 브라우저(익명 키)에서는 못 읽고 못 쓰게 잠금
--       → 서버(api 폴더, 서비스 키)를 거쳐서만 읽고 써요 (전화번호 보호)
alter table app_settings enable row level security;

-- 새 테이블을 서버가 바로 알아차리도록 새로고침
notify pgrst, 'reload schema';
