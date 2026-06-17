// ================================================================
// 📁 api/save-snapshot.js  (시간표 데이터를 Supabase에 저장 → 짧은 ID 반환)
// ================================================================
//  비유: 택배 "창고 접수처".
//   - 시간표 내용물(payload)을 받아 창고에 넣고,
//   - 짧은 "보관번호(id)"만 돌려줍니다.
//   - 이후 이미지/뷰어는 이 id로 내용물을 꺼내봅니다.
// ================================================================

import { createClient } from '@supabase/supabase-js'

// ⚠️ 서버 전용 키(Service Role)를 써야 RLS와 무관하게 안전하게 저장됩니다.
//    Vercel 환경변수에 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 등록 필요!
//    (없으면 ANON 키로도 동작은 하지만, 위 SQL의 insert 정책이 열려있어야 함)
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

// 짧고 충돌 없는 ID 생성 (예: 'k7f3a9b2')
function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST만 허용됩니다' })
    return
  }

  try {
    // body가 문자열로 올 수도 있어 안전하게 파싱
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const payload = body?.payload

    if (!payload || typeof payload !== 'object') {
      res.status(400).json({ error: 'payload가 없습니다' })
      return
    }

    const id = makeId()

    const { error } = await supabase
      .from('schedule_snapshots')
      .insert({ id, payload })

    if (error) {
      console.error('스냅샷 저장 실패:', error)
      res.status(500).json({ error: error.message })
      return
    }

    // 짧은 ID만 돌려줌
    res.status(200).json({ id })

  } catch (err) {
    console.error('save-snapshot 오류:', err)
    res.status(500).json({ error: err.message })
  }
}