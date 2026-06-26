// ================================================================
// 📁 src/lib/seatConfig.js
// ================================================================
// 비유: "우리 스터디카페는 1번부터 30번까지 좌석을 써요"라는
//       종이 한 장을 Supabase에 보관해두는 역할이에요.
//       students 테이블처럼 RLS(접근 제한) 없이 브라우저에서
//       바로 읽고 쓸 수 있게 해뒀어요.
// ================================================================

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

/** 현재 좌석 사용 범위를 가져옵니다. (없으면 기본값 1~30) */
export async function fetchSeatConfig() {
  const { data, error } = await supabase
    .from('seat_config')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  if (error || !data) {
    return { min_seat: 1, max_seat: 30 }
  }
  return data
}

/** 좌석 사용 범위를 수정합니다. */
export async function updateSeatConfig({ minSeat, maxSeat }) {
  const { data, error } = await supabase
    .from('seat_config')
    .upsert({ id: 1, min_seat: minSeat, max_seat: maxSeat, updated_at: new Date().toISOString() })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}
