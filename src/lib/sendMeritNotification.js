// ================================================================
// 📁 src/lib/sendMeritNotification.js  (신규 파일)
// ================================================================
// 비유: "상점/벌점 부여 버튼"을 누르면 이 함수가 우체국(api/send-notification.js)에
//       편지(알림톡)를 대신 부쳐주는 역할을 합니다.
//
// ⚠️ 아직 TODO로 표시된 부분(누적 벌점/상점 계산)은
//    상벌점 데이터가 저장된 실제 테이블 구조를 몰라서 비워뒀어요.
//    해당 컴포넌트/테이블 구조를 알려주시면 채워서 완성해드릴게요!
// ================================================================

/**
 * 상점 또는 벌점 알림톡을 보냅니다.
 *
 * @param {'reward'|'penalty'} type - 'reward'(상점) 또는 'penalty'(벌점)
 * @param {object} payload
 *   - to            : 수신자 전화번호 (학생 또는 학부모)
 *   - studentName   : 학생 이름
 *   - reason        : 부여 사유
 *   - points        : 부여된 점수 (숫자)
 *   - month         : 기준 월 (벌점일 때만 사용, 예: 6)
 *   - totalPenalty  : 이번 달 누적 벌점 (벌점일 때만 사용)
 *   - totalReward   : 이번 달 누적 상점 (벌점일 때만 사용)
 * @returns {Promise<object>} 서버 응답 (success, data 또는 error)
 */
export async function sendMeritNotification(type, payload) {
  const {
    to,
    studentName,
    reason,
    points,
    month,
    totalPenalty,
    totalReward,
  } = payload

  const isReward = type === 'reward'

  // ⚠️ 아래 key 이름(학생이름, 벌점사유 등)은
  //    솔라피에 등록한 템플릿의 변수명과 "정확히 똑같이" 적어야 합니다!
  //    (오타 하나만 있어도 발송이 거부돼요)
  const variables = isReward
    ? {
        '학생이름': studentName,
        '상점사유': reason,
        '상점점수': `${points}점`,
      }
    : {
        '학생이름': studentName,
        '벌점사유': reason,
        '벌점점수': `${points}점`,
        '기준월':   String(month),
        '누적벌점': String(totalPenalty),
        '누적상점': String(totalReward),
      }

  // 알림톡 발송이 실패했을 때 대신 보내는 일반 문자(SMS) 내용
  const fallbackText = isReward
    ? `[SMC 스터디카페 상점 안내]\n${studentName} 학생에게 ${reason}로 상점 ${points}점이 부여되었습니다.`
    : `[SMC 스터디카페 벌점 안내]\n${studentName} 학생에게 ${reason}로 벌점 ${points}점이 부여되었습니다. (이번달 벌점 ${totalPenalty}점/상점 ${totalReward}점)`

  const response = await fetch('/api/send-notification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to,
      text: fallbackText,
      type, // 'penalty' 또는 'reward' → 서버가 알맞은 템플릿을 자동 선택
      variables,
    }),
  })

  return response.json()
}

// ----------------------------------------------------------------
// 사용 예시 (상벌점 관리 컴포넌트의 "벌점 부여" 버튼 onClick 안에서)
// ----------------------------------------------------------------
//
// import { sendMeritNotification } from '../lib/sendMeritNotification'
//
// async function handleGivePenalty(student, reason, points) {
//   // TODO: 이번 달 누적 벌점/상점 합계를 Supabase에서 계산해서 가져오기
//   const totalPenalty = /* 이번달 벌점 합계 쿼리 결과 */
//   const totalReward  = /* 이번달 상점 합계 쿼리 결과 */
//
//   const result = await sendMeritNotification('penalty', {
//     to: student.parentPhone,      // 학부모 번호 (또는 student.phone)
//     studentName: student.name,
//     reason,
//     points,
//     month: new Date().getMonth() + 1,
//     totalPenalty,
//     totalReward,
//   })
//
//   if (!result.success) {
//     alert('알림톡 발송 실패: ' + result.error)
//   }
// }