// ================================================================
// 📁 api/get-reasons.js  (상점/벌점 "사유 목록" 조회를 서비스 키로 처리)
// ================================================================
// 비유: 예전에는 사유 목록을 각자의 "개인 수첩"(브라우저 localStorage)에
//       적어놨어요. 그래서 내 컴퓨터에는 보이는데, 다른 직원 컴퓨터나
//       다른 브라우저에서는 안 보였던 거예요.
//       이제는 회사 공용 캐비닛(Supabase의 point_reasons 테이블)에 적어두고,
//       누가 열어봐도 항상 같은 목록이 보이게 만들었어요.
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
    const { data, error } = await supabase
      .from('point_reasons')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[get-reasons] 조회 실패:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ success: true, data: data || [] })

  } catch (err) {
    console.error('[get-reasons] 서버 오류:', err)
    return res.status(500).json({ error: '서버 오류: ' + err.message })
  }
}
