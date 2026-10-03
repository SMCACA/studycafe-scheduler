-- ================================================================
-- 📁 sql/applicants_schedule_link.sql
--    신청서 ↔ 학생등록 연동을 위해 applicants 테이블에 칸(column) 추가
-- ================================================================
-- 사용법: Supabase 대시보드 → SQL Editor → New query → 이 내용 전체 붙여넣기 → Run
-- 여러 번 실행해도 안전해요 (IF NOT EXISTS = "이미 있으면 건너뛰기")
-- ================================================================

-- ① 이용권 구분 : '평일' / '주말' / '풀'  (스케줄 관리의 재원 구분과 같은 값)
alter table applicants add column if not exists membership_type text;

-- ② 희망 스케줄 : {"mon_slots":[1,2], "tue_slots":[], ... "sun_slots":[3,4]}
--    요일별로 "몇 교시"에 오는지 숫자 목록으로 저장해요 (스케줄 관리와 같은 모양)
alter table applicants add column if not exists desired_slots jsonb;

-- ③ 전환 기록 : 어떤 학생으로, 언제, 어떤 상태로 등록됐는지 (중복 등록 방지용)
alter table applicants add column if not exists converted_student_id text;
alter table applicants add column if not exists converted_as text;      -- '재원생' 또는 '예비원생'
alter table applicants add column if not exists converted_at timestamptz;

-- ④ 신청일시 칸 (이미 있으면 그대로 둬요)
alter table applicants add column if not exists created_at timestamptz default now();

-- ⑤ 상태값 제한 규칙이 있다면 제거 (없으면 아무 일도 안 일어나요)
--    '대기중/연락완료/등록완료/취소' 네 가지를 자유롭게 쓰기 위해서예요.
alter table applicants drop constraint if exists applicants_status_check;
