// ================================================================
// 📁 src/lib/sendNotification.js
// ================================================================
// React 컴포넌트에서 알림톡을 쉽게 보낼 수 있는 "도우미 함수"입니다.
// 
// 🔑 핵심 원리 (비유):
//   React (프론트엔드) = 카페 직원 (주문을 받아서)
//   /api/send-notification = 주방 (실제 요리, 즉 API 키 사용)
//   Solapi = 배달 서비스 (최종 발송)
//
// 🗂️ 위치: src > lib > sendNotification.js
// ================================================================

/**
 * 카카오 알림톡 (또는 SMS) 발송
 * 
 * @param {Object} params
 * @param {string} params.to     - 수신자 전화번호 (학부모 번호)
 * @param {string} params.text   - 발송할 메시지 내용
 * @param {string} params.type   - 'schedule' | 'reward' (메시지 종류)
 * 
 * @returns {Promise<{success: boolean}>}
 * @throws {Error} 발송 실패 시 에러 메시지
 */
export async function sendNotification({ to, text, type = 'general' }) {
  // 전화번호 없으면 바로 에러
  if (!to) {
    throw new Error('학부모 전화번호가 등록되지 않은 학생입니다.\n학생 관리 페이지에서 번호를 먼저 등록해주세요!')
  }

  // 우리가 만든 Vercel 서버 함수에 요청 보내기
  // (마치 주방에 주문서를 전달하는 것)
  const response = await fetch('/api/send-notification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, text, type }),
  })

  const data = await response.json()

  // 실패했으면 에러 던지기
  if (!response.ok) {
    throw new Error(data.error || '알 수 없는 오류로 발송에 실패했습니다')
  }

  return data
}