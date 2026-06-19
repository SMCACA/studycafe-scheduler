// ================================================================
// 📁 api/get-points.js  (상점/벌점 기록 "조회"를 서비스 키로 처리)
// ================================================================
// 비유: api/add-point.js가 "서류함에 글을 쓰는" 직원증 역할이라면,
//       이 파일은 "서류함을 열어서 보여주는" 같은 직원증 역할이에요.
//       (브라우저의 방문증/익명 키로는 student_points 테이블을 읽을 권한이
//        없어서, 조회도 서버를 거치도록 만든 파일입니다)
//
// ⚠️ student_points ↔ students를 한 번에 조인해서 가져오면, 두 테이블 사이에
//    "관계(foreign key)"가 미리 설정돼 있어야만 동작해요. 관계가 없으면
//    에러도 없이 그냥 빈 결과만 나올 수 있어서, 이 파일은 두 테이블을
//    따로따로 조회한 다음 자바스크립트(코드)에서 직접 이름을 붙여줘요.
//    (마치 "주문 목록"과 "고객 명단"을 따로 받아서, 손으로 직접 짝지어주는 것과 같아요)
//
// 사용법 (쿼리 파라미터):
//   - 최근 N개: /api/get-points?mode=recent&limit=8
//   - 월별 범위: /api/get-points?mode=month&start=2026-06-01&end=2026-06-30
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
    const { mode, limit, start, end } = req.query || {}

    // 1️⃣ student_points 기록을 조인 없이 가져옴
    let pointsQuery = supabase.from('student_points').select('*')

    if (mode === 'month') {
      if (!start || !end) {
        return res.status(400).json({ error: 'start, end 값이 필요합니다' })
      }
      pointsQuery = pointsQuery
        .gte('record_date', start)
        .lte('record_date', end)
        .order('record_date', { ascending: false })
    } else {
      pointsQuery = pointsQuery
        .order('created_at', { ascending: false })
        .limit(Number(limit) > 0 ? Number(limit) : 8)
    }

    const { data: points, error: pointsError } = await pointsQuery

    if (pointsError) {
      console.error('[get-points] student_points 조회 실패:', pointsError)
      return res.status(500).json({ error: pointsError.message })
    }

    // 2️⃣ 위에서 나온 학생 id들로 학생 정보(이름, 좌석)를 따로 조회
    const studentIds = [...new Set((points || []).map(p => p.student_id).filter(Boolean))]
    let studentsMap = {}

    if (studentIds.length > 0) {
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id, name, seat_number')
        .in('id', studentIds)

      if (studentsError) {
        console.error('[get-points] students 조회 실패:', studentsError)
        return res.status(500).json({ error: studentsError.message })
      }

      studentsMap = Object.fromEntries((students || []).map(s => [s.id, s]))
    }

    // 3️⃣ 두 결과를 코드에서 직접 합쳐줌 (students(name, seat_number) 형태와 동일하게 맞춤)
    const data = (points || []).map(p => ({
      ...p,
      students: studentsMap[p.student_id] || null,
    }))

    return res.status(200).json({ success: true, data })

  } catch (err) {
    console.error('[get-points] 서버 오류:', err)
    return res.status(500).json({ error: '서버 오류: ' + err.message })
  }
}