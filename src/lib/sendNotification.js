// ================================================================
// 📁 src/lib/sendNotification.js  (브라우저용 프론트엔드 파일)
// ================================================================
// 마치 "배달 앱"처럼, 실제 발송은 /api/send-notification(주방)이 하고
// 이 파일은 "주문서"를 만들어서 서버에 전달하는 역할만 해요.
// ================================================================

// ── 단일 수신자 발송 ──
export async function sendNotification({ to, text, type, variables, buttons }) {
  const response = await fetch('/api/send-notification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, text, type, variables, buttons }),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || `발송 실패 (${response.status})`)
  }

  return response.json()
}

// ── 여러 수신자 동시 발송 ──
export async function sendNotificationMulti({ targets, text, type, variables, buttons }) {
  if (!targets || targets.length === 0) {
    throw new Error('수신자가 없어요')
  }

  const results = await Promise.allSettled(
    targets.map(({ phone }) =>
      sendNotification({ to: phone, text, type, variables, buttons })
    )
  )

  const failed  = results.filter(r => r.status === 'rejected')
  const success = results.filter(r => r.status === 'fulfilled')

  if (failed.length > 0 && success.length === 0) {
    throw new Error(`발송 실패: ${failed[0].reason?.message}`)
  }

  if (failed.length > 0) {
    throw new Error(`${failed.length}명 발송 실패 (${success.length}명은 성공)`)
  }

  return results.map(r => r.value)
}