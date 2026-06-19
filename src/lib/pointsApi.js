// ================================================================
// 📁 src/lib/pointsApi.js
// ================================================================
// 비유: addPoint.js가 "저장 주문서를 접수처에 전달"하는 역할이라면,
//       이 파일은 "조회/삭제 요청서를 접수처에 전달"하는 역할이에요.
//       student_points 테이블은 보안 정책(RLS) 때문에 브라우저에서
//       직접 읽거나 지울 수 없어서, 항상 서버(api/)를 거쳐야 해요.
// ================================================================

/** 최근 등록된 상점/벌점 기록을 가져옵니다. */
export async function fetchRecentPoints(limit = 8) {
  const res = await fetch(`/api/get-points?mode=recent&limit=${limit}`)
  const result = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(result.error || '조회 실패')
  return result.data || []
}

/** 특정 기간(yyyy-MM-dd ~ yyyy-MM-dd)의 상점/벌점 기록을 가져옵니다.
 *  studentId를 넘기면 그 학생의 기록만 가져와요 (누적 점수 계산용). */
export async function fetchMonthPoints(start, end, studentId) {
  let url = `/api/get-points?mode=month&start=${start}&end=${end}`
  if (studentId) url += `&studentId=${studentId}`
  const res = await fetch(url)
  const result = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(result.error || '조회 실패')
  return result.data || []
}

/** 상점/벌점 기록 하나를 삭제합니다. */
export async function deletePoint(id) {
  const res = await fetch('/api/delete-point', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })
  const result = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(result.error || '삭제 실패')
  return result
}