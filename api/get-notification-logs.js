// ================================================================
// 📁 api/get-notification-logs.js  (알림톡 "발송 기록" 목록 조회)
// ================================================================
// 비유: get-reasons.js와 똑같은 방식이에요. notification_logs 표는
//       보안 정책(RLS)으로 잠겨있어서, 직원증(서비스 키)을 가진
//       이 서버 함수만 열어볼 수 있어요.
// ================================================================

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET 요청만 허용됩니다' })
  }

  try {
    // ?limit=50 처럼 개수를 조절할 수 있어요 (기본 100개)
    const limit = Math.min(Number(req.query.limit) || 100, 300)

    const { data, error } = await supabase
      .from('notification_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[get-notification-logs] 조회 실패:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ success: true, data: data || [] })

  } catch (err) {
    console.error('[get-notification-logs] 서버 오류:', err)
    return res.status(500).json({ error: '서버 오류: ' + err.message })
  }
}
