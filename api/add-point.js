// ================================================================
// 📁 api/add-point.js  (상점/벌점 점수를 student_points 테이블에 저장)
// ================================================================
// 비유: 회사 정문에 보안요원(RLS = Row Level Security, 줄 단위 접근 제한)이
//       서 있어서, 방문객(브라우저가 쓰는 "익명 키")은 직접 들어가
//       서류함(student_points 테이블)에 글을 쓸 수 없어요.
//       그래서 "직원증(Service Role Key = 서버 전용 만능 키)"을 가진
//       이 서버 함수가 대신 들어가서 써주는 역할을 해요.
//
//       (api/save-snapshot.js에서 이미 같은 방식을 쓰고 있어서,
//        같은 Vercel 환경변수 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY를
//        그대로 재사용해요. 추가로 등록할 환경변수는 없어요!)
// ================================================================

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 요청만 허용됩니다' })
  }

  try {
    // body가 문자열로 올 수도 있어 안전하게 파싱
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const { student_id, type, points, reason, record_date } = body || {}

    if (!student_id || !type || !points || !reason || !record_date) {
      return res.status(400).json({
        error: '필수 값이 빠졌습니다 (student_id, type, points, reason, record_date)',
      })
    }

    const { data, error } = await supabase
      .from('student_points')
      .insert({ student_id, type, points, reason, record_date })
      .select()
      .single()

    if (error) {
      console.error('[add-point] 저장 실패:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ success: true, data })

  } catch (err) {
    console.error('[add-point] 서버 오류:', err)
    return res.status(500).json({ error: '서버 오류: ' + err.message })
  }
}