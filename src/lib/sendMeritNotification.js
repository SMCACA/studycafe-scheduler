// ================================================================
// 📁 src/lib/sendMeritNotification.js
// ================================================================
// 비유: "상점/벌점 부여 버튼"을 누르면 이 함수가 우체국(api/send-notification.js)에
//       편지(알림톡)를 대신 부쳐주는 역할을 합니다.
//
// ✅ 솔라피에 승인된 두 템플릿과 변수명이 정확히 일치하도록 맞춰져 있어요.
//    - 상점 템플릿 변수: #{학생이름} #{상점사유} #{상점점수}
//    - 벌점 템플릿 변수: #{학생이름} #{벌점사유} #{벌점점수} #{기준월} #{누적벌점} #{누적상점}
//    누적 벌점/상점(totalPenalty, totalReward)은 직접 계산하지 않고
//    호출하는 쪽에서 넘겨받아요. 같은 폴더의 pointsSummary.js의
//    getMonthlyPointTotals() 함수로 쉽게 구할 수 있어요.
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
 *   - fallbackText  : (선택) 알림톡 실패 시 보낼 SMS 대체 문구를 직접 지정.
 *                      비워두면 아래 기본 문구가 자동으로 만들어져요.
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
    fallbackText: customFallbackText,
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
  // (customFallbackText를 넘겨주면 그 문구를 그대로 쓰고, 안 넘겨주면 기본 문구를 만들어요)
  const fallbackText = customFallbackText || (isReward
    ? `[SMC 스터디카페 상점 안내]\n${studentName} 학생에게 ${reason}로 상점 ${points}점이 부여되었습니다.`
    : `[SMC 스터디카페 벌점 안내]\n${studentName} 학생에게 ${reason}로 벌점 ${points}점이 부여되었습니다. (이번달 벌점 ${totalPenalty}점/상점 ${totalReward}점)`)

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
// 실제 연동 위치
// ----------------------------------------------------------------
// - src/pages/StudentPoints.jsx  : 점수 등록 시 자동으로 호출돼요
// - src/pages/RewardNotification.jsx : 수동 알림톡 발송 시 호출돼요
//
// 두 곳 모두 pointsSummary.js의 getMonthlyPointTotals()로
// 이번 달 누적 합계를 구한 뒤, 벌점일 때만 month/totalPenalty/totalReward를
// 함께 넘겨주고 있어요.