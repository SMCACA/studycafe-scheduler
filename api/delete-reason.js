// ================================================================
// 📁 api/delete-reason.js  (상점/벌점 "사유" 삭제를 서비스 키로 처리)
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
      .from('point_reasons')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[delete-reason] 삭제 실패:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ success: true })

  } catch (err) {
    console.error('[delete-reason] 서버 오류:', err)
    return res.status(500).json({ error: '서버 오류: ' + err.message })
  }
}
