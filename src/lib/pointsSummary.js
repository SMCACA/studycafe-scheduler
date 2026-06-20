// ================================================================
// 📁 src/lib/pointsSummary.js
// ================================================================
// 비유: 가계부에서 "이번 달 수입/지출 합계"를 구하는 것과 같아요.
//       student_points 테이블(상점/벌점이 한 줄씩 쌓인 표)에서
//       특정 학생의 "이번 달" 줄만 모아 더해줍니다.
//
// 벌점 알림톡 템플릿에는 "현재 누적 벌점 N점, 누적 상점 N점"이라는
// 문구가 들어가야 해서, 이 합계를 구하는 함수가 필요해요.
// (상점 알림톡 템플릿에는 누적 합계가 필요 없어서 이 함수를 안 써도 돼요)
//
// ⚠️ student_points 테이블은 보안 정책(RLS) 때문에 브라우저가 익명 키로
//    직접 조회할 수 없어요 (에러 없이 그냥 빈 결과만 돌아와서, 누적 점수가
//    항상 0으로 보이는 문제가 있었어요). 그래서 조회용 서버 창구
//    (api/get-points.js, src/lib/pointsApi.js)를 거쳐서 가져온 다음,
//    여기서 학생별 합계만 더해줍니다.
// ================================================================

import { fetchMonthPoints } from './pointsApi'

/* ── 해당 월의 1일 / 말일을 'yyyy-MM-dd' 문자열로 변환 ── */
function getMonthRange(monthDate) {
  const y = monthDate.getFullYear()
  const m = monthDate.getMonth()
  const pad = (n) => String(n).padStart(2, '0')
  const first = `${y}-${pad(m + 1)}-01`
  const lastDay = new Date(y, m + 1, 0).getDate() // 그 달의 마지막 날짜 (28~31)
  const last = `${y}-${pad(m + 1)}-${pad(lastDay)}`
  return { first, last }
}

/**
 * 특정 학생의 특정 월 누적 상점/벌점 합계를 구합니다.
 *
 * @param {string} studentId   - students 테이블의 학생 id
 * @param {Date}   monthDate   - 합계를 구할 기준 달 (그 달 1일~말일 범위로 계산돼요)
 * @returns {Promise<{ totalReward: number, totalPenalty: number }>}
 *          totalReward  = 이번 달 상점 합계
 *          totalPenalty = 이번 달 벌점 합계
 */
export async function getMonthlyPointTotals(studentId, monthDate) {
  const { first, last } = getMonthRange(monthDate)

  // ✅ 서버 창구(api/get-points.js)를 거쳐 해당 학생의 이번 달 기록만 받아와요
  const rows = await fetchMonthPoints(first, last, studentId)

  let totalReward = 0
  let totalPenalty = 0
  rows.forEach((row) => {
    // ⚠️ 이중 안전장치: 서버(api/get-points.js)가 studentId로 걸러서 주지만,
    //    혹시라도 다른 학생 기록이 섞여 와도 여기서 한 번 더 막아줘요.
    //    (비유: 문 앞에서 신분증 확인했어도, 입장할 때 한 번 더 확인하는 느낌)
    if (row.student_id !== studentId) return
    if (row.type === '상점') totalReward += row.points
    else totalPenalty += row.points
  })

  return { totalReward, totalPenalty }
}