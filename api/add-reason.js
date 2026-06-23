// ================================================================
// 📁 api/add-reason.js  (상점/벌점 "사유"를 point_reasons 테이블에 저장)
// ================================================================
// 기존 api/add-point.js와 똑같은 방식이에요. 브라우저의 익명 키로는
// 직접 저장할 수 없어서(RLS 보안 정책), 서비스 키를 가진 이 서버가
// 대신 저장해줘요.
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
    const { type, title, points } = body || {}

    if (!type || !title || !points) {
      return res.status(400).json({ error: '필수 값이 빠졌습니다 (type, title, points)' })
    }

    const { data, error } = await supabase
      .from('point_reasons')
      .insert({ type, title, points })
      .select()
      .single()

    if (error) {
      console.error('[add-reason] 저장 실패:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ success: true, data })

  } catch (err) {
    console.error('[add-reason] 서버 오류:', err)
    return res.status(500).json({ error: '서버 오류: ' + err.message })
  }
}
