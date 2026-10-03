// ================================================================
// 📁 api/submit-application.js  (신청서 "저장 + 조회 + 상태 변경"을 한 파일에서 처리)
// ================================================================
// 비유: 접수 창구 하나에서 세 가지 일을 하는 직원이에요.
//   - POST  (손님이 신청서를 냄)        → 누구나 가능 (/apply 화면)
//   - GET   (관리자가 신청서 묶음을 봄)  → 로그인한 관리자만 가능
//   - PATCH (관리자가 처리 상태 도장 찍음) → 로그인한 관리자만 가능
//
// ⚠️ 왜 새 파일을 안 만들고 여기에 합쳤나요?
//    Vercel 무료(Hobby) 요금제는 api 폴더 파일(=서버 함수)을 최대 12개까지만 허용해요.
//    이미 13개라서, 파일을 더 늘리지 않고 기존 파일에 기능을 얹었어요.
// ================================================================

import { createClient } from '@supabase/supabase-js'

// ⚠️ "서비스 키(service role key)" = 직원용 마스터키 (보안 규칙을 우회함)
//    그래서 절대 화면(프론트엔드) 코드에는 쓰면 안 되고, 서버 코드(api 폴더)에서만 써요.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// 관리자가 바꿀 수 있는 상태 목록 (이 외의 값은 거절)
const ALLOWED_STATUS = ['대기중', '연락완료', '등록완료', '취소']

// ── 로그인한 관리자인지 확인하는 함수 ──
// 비유: 화면이 보내온 "출입증(토큰, 로그인했다는 증명서)"을 Supabase에 보여주고
//       진짜 우리 직원 출입증이 맞는지 확인받는 과정이에요.
async function isLoggedInAdmin(req) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) return false
  const { data, error } = await supabase.auth.getUser(token)
  return !error && !!data?.user
}

export default async function handler(req, res) {
  // ────────────────────────────────────────────────
  // 1) POST : 신청서 저장 (누구나)
  // ────────────────────────────────────────────────
  if (req.method === 'POST') {
    const {
      name,
      grade,
      is_academy_student,
      school,
      parent_phone,
      student_phone,
      desired_start_date,
      desired_schedule_text,
    } = req.body

    // 서버 쪽에서도 최소한의 필수값 확인 (화면 쪽 검증을 믿지 않고 한 번 더 체크)
    if (!name || !grade || is_academy_student === null || is_academy_student === undefined) {
      return res.status(400).json({ error: '필수 항목이 비어있어요' })
    }

    try {
      const { data, error } = await supabase
        .from('applicants')
        .insert({
          name,
          grade,
          is_academy_student,
          school: school || null,
          parent_phone: parent_phone || null,
          student_phone: student_phone || null,
          desired_start_date: desired_start_date || null,
          desired_schedule_text: desired_schedule_text || null,
          status: '대기중',
        })
        .select()

      if (error) throw error

      return res.status(200).json({ success: true, applicant: data[0] })
    } catch (err) {
      console.error('신청서 저장 실패:', err)
      return res.status(500).json({ error: '저장 중 문제가 발생했어요' })
    }
  }

  // ────────────────────────────────────────────────
  // 2) GET : 신청자 명단 조회 (관리자만)
  // ────────────────────────────────────────────────
  if (req.method === 'GET') {
    if (!(await isLoggedInAdmin(req))) {
      return res.status(401).json({ error: '로그인이 필요해요' })
    }

    try {
      // 최신 신청이 위로 오도록 created_at(생성 시각) 기준 내림차순 정렬
      let { data, error } = await supabase
        .from('applicants')
        .select('*')
        .order('created_at', { ascending: false })

      // 혹시 created_at 칸이 없는 테이블이면 정렬 없이 다시 시도
      if (error) {
        console.warn('created_at 정렬 실패, 정렬 없이 재시도:', error.message)
        const retry = await supabase.from('applicants').select('*')
        data = retry.data
        error = retry.error
      }
      if (error) throw error

      return res.status(200).json({ applicants: data || [] })
    } catch (err) {
      console.error('신청자 명단 조회 실패:', err)
      return res.status(500).json({ error: '명단을 불러오지 못했어요: ' + err.message })
    }
  }

  // ────────────────────────────────────────────────
  // 3) PATCH : 처리 상태 변경 (관리자만)
  // ────────────────────────────────────────────────
  if (req.method === 'PATCH') {
    if (!(await isLoggedInAdmin(req))) {
      return res.status(401).json({ error: '로그인이 필요해요' })
    }

    const { id, status } = req.body || {}
    if (!id || !ALLOWED_STATUS.includes(status)) {
      return res.status(400).json({ error: '잘못된 요청이에요 (id 또는 상태값 확인)' })
    }

    try {
      const { data, error } = await supabase
        .from('applicants')
        .update({ status })
        .eq('id', id)
        .select()

      if (error) throw error
      if (!data || data.length === 0) {
        return res.status(404).json({ error: '해당 신청서를 찾지 못했어요' })
      }

      return res.status(200).json({ success: true, applicant: data[0] })
    } catch (err) {
      console.error('상태 변경 실패:', err)
      return res.status(500).json({ error: '상태 변경 실패: ' + err.message })
    }
  }

  // 그 외 방식은 거절
  return res.status(405).json({ error: '허용되지 않은 요청 방식이에요' })
}
