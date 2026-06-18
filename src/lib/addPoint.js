// ================================================================
// 📁 src/lib/addPoint.js
// ================================================================
// 비유: "주문서를 만들어서 창고 접수처(api/add-point.js)에 전달"하는
//       역할만 해요. 실제로 데이터베이스에 글을 쓰는 건 서버(api/add-point.js)예요.
//
// ⚠️ 브라우저에서 supabase.from('student_points').insert(...)를 직접 호출하면
//    "new row violates row-level security policy" 오류가 나요.
//    (보안 정책상 브라우저의 익명 키로는 점수 테이블에 직접 못 써요)
//    그래서 항상 이 함수를 통해 서버를 거쳐서 저장해야 해요.
// ================================================================

/**
 * 상점/벌점 점수를 student_points 테이블에 저장합니다.
 *
 * @param {object} params
 *   - studentId  : students 테이블의 학생 id
 *   - type       : '상점' | '벌점'
 *   - points     : 점수 (숫자)
 *   - reason     : 사유
 *   - recordDate : 기록 날짜 ('yyyy-MM-dd' 문자열)
 * @returns {Promise<object>} 서버 응답 ({ success: true, data } 또는 에러 throw)
 */
export async function addPoint({ studentId, type, points, reason, recordDate }) {
  const response = await fetch('/api/add-point', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      student_id: studentId,
      type,
      points,
      reason,
      record_date: recordDate,
    }),
  })

  const result = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(result.error || `점수 저장 실패 (${response.status})`)
  }

  return result
}