// ================================================================
// 📁 api/delete-point.js  (상점/벌점 기록 "삭제"를 서비스 키로 처리)
// ================================================================
// 비유: 등록 실수를 정정할 때, 방문증(익명 키)으로는 서류함에서
//       서류를 빼낼 권한이 없어요. 그래서 직원증(서비스 키)을 가진
//       이 서버가 대신 빼주는 역할을 해요.
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
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const { id } = body || {}

    if (!id) {
      return res.status(400).json({ error: 'id 값이 필요합니다' })
    }

    const { error } = await supabase
      .from('student_points')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[delete-point] 삭제 실패:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ success: true })

  } catch (err) {
    console.error('[delete-point] 서버 오류:', err)
    return res.status(500).json({ error: '서버 오류: ' + err.message })
  }
}