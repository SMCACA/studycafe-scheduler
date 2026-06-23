// ================================================================
// 📁 src/lib/pointReasonsApi.js
// ================================================================
// 비유: addPoint.js, pointsApi.js와 같은 역할이에요.
//       "사유 등록/조회/삭제 요청서"를 만들어서 서버(api/)에 전달해요.
// ================================================================

/** 등록된 사유 목록 전체를 가져옵니다. */
export async function fetchReasons() {
  const res = await fetch('/api/get-reasons')
  const result = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(result.error || '사유 목록 조회 실패')
  return result.data || []
}

/** 새 사유를 등록합니다. */
export async function addReason({ type, title, points }) {
  const res = await fetch('/api/add-reason', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, title, points }),
  })
  const result = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(result.error || '사유 등록 실패')
  return result.data
}

/** 사유를 삭제합니다. */
export async function deleteReason(id) {
  const res = await fetch('/api/delete-reason', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })
  const result = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(result.error || '사유 삭제 실패')
  return result
}
