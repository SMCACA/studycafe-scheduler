// ================================================================
// 📁 src/lib/notificationLogsApi.js
// ================================================================
// 비유: pointReasonsApi.js와 같은 역할이에요.
//       "발송 기록 보여줘" / "이 기록 실제 상태 다시 확인해줘"라는
//       요청서를 만들어서 서버(api/)에 전달해요.
// ================================================================

/** 최근 발송 기록 목록을 가져옵니다. */
export async function fetchNotificationLogs(limit = 100) {
  const res = await fetch(`/api/get-notification-logs?limit=${limit}`)
  const result = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(result.error || '발송 기록 조회 실패')
  return result.data || []
}

/** 특정 발송 기록의 실제 카카오/문자 수신 상태를 다시 확인합니다. */
export async function checkNotificationStatus(id) {
  const res = await fetch('/api/check-notification-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })
  const result = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(result.error || '상태 확인 실패')
  return result.data
}
