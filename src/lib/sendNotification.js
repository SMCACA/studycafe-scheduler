// ================================================================
// 📁 src/lib/sendNotification.js
// ================================================================
// 알림톡 발송 도우미 함수 (여러 수신자 동시 발송 지원)
//
// 🔑 비유:
//   React (프론트) = 주문을 받는 직원
//   /api/send-notification = 실제 발송하는 주방
//   Solapi = 배달 서비스
// ================================================================

/**
 * 단일 수신자에게 알림톡 발송 (기존 호환성 유지)
 * @param {string} to    - 전화번호
 * @param {string} text  - 메시지
 * @param {string} type  - 'schedule' | 'reward'
 */
export async function sendNotification({ to, text, type = 'general' }) {
  if (!to) {
    throw new Error('전화번호가 등록되지 않은 학생입니다.\n학생 관리 페이지에서 번호를 먼저 등록해주세요!')
  }

  const response = await fetch('/api/send-notification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, text, type }),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || '알 수 없는 오류로 발송에 실패했습니다')
  }
  return data
}

/**
 * ✅ 여러 수신자에게 동시 발송 (학생 + 학부모 동시 발송용)
 *
 * @param {Object} params
 * @param {Array}  params.targets  - [{ label:'학부모', phone:'010-...' }, ...]
 * @param {string} params.text     - 메시지 내용
 * @param {string} params.type     - 'schedule' | 'reward'
 *
 * @example
 * await sendNotificationMulti({
 *   targets: [
 *     { label:'학부모', phone:'010-1234-5678' },
 *     { label:'학생',   phone:'010-9876-5432' },
 *   ],
 *   text: '스케줄 안내...',
 *   type: 'schedule',
 * })
 */
export async function sendNotificationMulti({ targets, text, type = 'general' }) {
  // 유효한 전화번호만 필터링
  const valid = (targets || []).filter(t => t.phone && t.phone.trim())
  if (valid.length === 0) {
    throw new Error('유효한 전화번호가 없어요. 학생 관리 페이지에서 번호를 등록해주세요!')
  }

  // 모든 수신자에게 동시 발송 (Promise.all = "동시에 여러 개 보내기")
  const results = await Promise.all(
    valid.map(async ({ label, phone }) => {
      const response = await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: phone, text, type }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(`${label}(${phone}) 발송 실패: ${data.error || '알 수 없는 오류'}`)
      }
      return { label, phone, ...data }
    })
  )

  return results
}
