// ================================================================
// 📁 api/send-notification.js
// ================================================================
// 이 파일은 "Vercel 서버리스 함수" (= 서버 역할을 하는 작은 프로그램)입니다.
// React 앱이 이 주소를 호출하면, 여기서 Solapi에 알림톡/문자를 보냅니다.
// API 키는 이 파일에서만 사용 → 브라우저에 절대 노출되지 않아요!
//
// 🗂️ 위치: 프로젝트 최상단(root) > api > send-notification.js
// ================================================================

import crypto from 'crypto' // Node.js 내장 암호화 모듈 (설치 불필요)
import { createClient } from '@supabase/supabase-js' // ✅ [추가] 발송 기록을 남기기 위해 사용

// ✅ [추가] 발송 기록(notification_logs)을 저장하기 위한 서버 전용 클라이언트
//    비유: add-point.js, get-reasons.js 등에서 이미 쓰는 "직원증(서비스 키)"을
//    여기서도 똑같이 재사용해요. 추가로 등록할 환경변수는 없어요!
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

// ──────────────────────────────────────────────────────────────
// Solapi 인증 헤더 생성 함수
// (마치 편지에 도장 찍는 것처럼, 우리가 진짜 Solapi 회원임을 증명)
// ──────────────────────────────────────────────────────────────
function makeAuthHeader(apiKey, apiSecret) {
  const date = new Date().toISOString()                      // 현재 시간
  const salt = Math.random().toString(36).substring(2, 15)  // 무작위 문자열 (보안용)
  const signature = crypto                                   // 암호화 서명
    .createHmac('sha256', apiSecret)
    .update(date + salt)
    .digest('hex')

  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`
}

// ──────────────────────────────────────────────────────────────
// 전화번호 정리 함수 (010-1234-5678 → 01012345678)
// ──────────────────────────────────────────────────────────────
function cleanPhone(phone) {
  return phone.replace(/[^0-9]/g, '') // 숫자 외 모두 제거
}

// ──────────────────────────────────────────────────────────────
// 메인 핸들러: React에서 요청이 오면 이 함수가 실행됩니다
// ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // POST 요청만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 요청만 허용됩니다' })
  }

  // ✅ [수정 1] variables(템플릿 변수)와 buttons도 함께 꺼내기
  // 예전 코드: const { to, text, type } = req.body   ← variables, buttons 누락!
  // 수정 코드: variables = {#{학생이름}: '홍길동', #{좌석번호}: 'A1', ...}
  const { to, text, type, variables, buttons } = req.body

  // to        = 학부모/학생 전화번호 (수신자)
  // text      = 보낼 메시지 내용 (알림톡 실패 시 SMS 대체용)
  // type      = 'schedule'(시간표) / 'penalty'(벌점) / 'reward'(상점) 중 하나
  //             → 이 값에 따라 위 TEMPLATE_ID_MAP에서 템플릿이 자동으로 골라집니다
  // variables = #{학생이름} 같은 자리에 들어갈 실제 값들
  // buttons   = 알림톡 버튼 (시간표 링크 등, 상점/벌점에는 보통 필요 없음)

  // 필수값 체크
  if (!to || !text) {
    return res.status(400).json({ error: '수신번호와 메시지가 필요합니다' })
  }

  // ── Vercel 환경변수에서 API 키 읽기 ──
  const apiKey      = process.env.SOLAPI_API_KEY       // Solapi API 키
  const apiSecret   = process.env.SOLAPI_API_SECRET    // Solapi API Secret
  const fromNumber  = process.env.SOLAPI_FROM_NUMBER   // 발신번호 (등록된 번호)
  const pfId        = process.env.SOLAPI_PF_ID         // 카카오 채널 ID (알림톡용)
  // ✅ [수정 4] type별로 다른 템플릿을 쓰도록 매핑표 추가
  //    비유: 우체국 창구에 양식이 여러 개 있는 것과 같아요.
  //    "시간표 안내"용 양식, "벌점 안내"용 양식, "상점 안내"용 양식이 각각 다름.
  //    프론트엔드에서 보낸 type 값(schedule / penalty / reward)에 맞는
  //    템플릿ID를 Vercel 환경변수에서 골라옵니다.
  const TEMPLATE_ID_MAP = {
    schedule: process.env.SOLAPI_TEMPLATE_ID,           // 기존: 시간표 안내
    penalty:  process.env.SOLAPI_TEMPLATE_ID_PENALTY,   // 신규: 벌점 안내
    reward:   process.env.SOLAPI_TEMPLATE_ID_REWARD,    // 신규: 상점 안내
  }
  // type이 매핑표에 있는 종류(schedule/penalty/reward)면 그 값을 그대로 쓰고,
  // (아직 승인 전이라 값이 비어있어도 그대로 비워둠 → 아래에서 안전하게 SMS로 대체됨)
  // type이 매핑표에 없는 경우에만 예전처럼 기본 템플릿(SOLAPI_TEMPLATE_ID)으로 대체
  const templateId = (type in TEMPLATE_ID_MAP)
    ? TEMPLATE_ID_MAP[type]
    : process.env.SOLAPI_TEMPLATE_ID

  // 필수 환경변수 누락 시 에러
  if (!apiKey || !apiSecret || !fromNumber) {
    return res.status(500).json({
      error: 'Vercel 환경변수를 확인해주세요 (SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_FROM_NUMBER)'
    })
  }

  // ── 메시지 객체 구성 ──
  const message = {
    to:   cleanPhone(to),           // 수신자 번호
    from: cleanPhone(fromNumber),   // 발신자 번호
    text: text,                     // SMS 대체 전송용 텍스트
  }

  if (pfId && templateId) {
    // ✅ [수정 3] 알림톡 모드 - templateId와 variables 추가!
    // 예전: kakaoOptions에 pfId만 있어서 카카오가 "어떤 템플릿?" 모름 → 발송 거부
    // 수정: templateId로 승인된 템플릿 지정 + variables로 #{변수} 값 전달
    message.kakaoOptions = {
      pfId:       pfId,             // 카카오 채널 ID
      templateId: templateId,       // ✅ 추가! 승인된 템플릿 ID (KA01TP...)
      variables:  variables || {}, // ✅ 추가! #{학생이름} → 실제 값으로 교체
      disableSms: false,           // 알림톡 실패 시 SMS로 자동 대체 (권장!)
    }

    // ✅ 버튼 URL 길이 체크 후 추가 (솔라피 제한: 최대 300자)
    // 시간표 이미지 URL은 스케줄 데이터가 통째로 들어가서 500~700자가 됨 → 제한 초과!
    // ➡ URL이 300자 이하일 때만 버튼 추가, 그 이상이면 버튼 없이 발송
    if (buttons && buttons.length > 0) {
      const urlOk = buttons.every(btn =>
        (!btn.linkMo || btn.linkMo.length <= 300) &&
        (!btn.linkPc || btn.linkPc.length <= 300)
      )
      if (urlOk) {
        message.kakaoOptions.buttons = buttons
        console.log('[알림톡 발송] 버튼 추가 완료')
      } else {
        // URL이 너무 길면 버튼 없이 발송 (알림톡 자체는 정상 발송됨)
        console.warn('[경고] 버튼 URL이 300자 초과 → 버튼 없이 발송합니다')
        console.warn('[버튼 URL 길이]', buttons.map(b => ({ mo: b.linkMo?.length, pc: b.linkPc?.length })))
      }
    }

    console.log('[알림톡 발송] 수신번호:', cleanPhone(to))
    console.log('[알림톡 발송] 템플릿ID:', templateId)
    console.log('[알림톡 발송] 변수:', JSON.stringify(variables))

  } else if (pfId && !templateId) {
    // pfId는 있는데 templateId가 없는 경우 → 경고 로그
    console.warn('[경고] SOLAPI_PF_ID는 있지만 SOLAPI_TEMPLATE_ID가 없습니다. SMS로 발송됩니다.')
    console.log('[SMS 발송] 수신번호:', cleanPhone(to))

  } else {
    // 카카오 채널 미설정 → SMS/LMS 문자로 자동 사용
    console.log('[SMS 발송] 수신번호:', cleanPhone(to))
  }

  // ── Solapi API 호출 ──
  try {
    const authHeader = makeAuthHeader(apiKey, apiSecret)

    const response = await fetch('https://api.solapi.com/messages/v4/send', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({ message }),
    })

    const data = await response.json()

    if (!response.ok) {
      // Solapi가 에러를 반환한 경우
      console.error('[Solapi 에러]', JSON.stringify(data))

      // ✅ [추가] 이 경우도 "발송 실패"로 기록
      await logNotification({
        to, type, variables,
        sendStatus: 'failed',
        errorMessage: data.errorMessage || '발송 실패',
        statusCode: data?.statusCode,
        statusMessage: data?.statusMessage,
      })

      return res.status(response.status).json({
        error:  data.errorMessage || '발송 실패',
        detail: data,
      })
    }

    // 성공!
    console.log('[발송 성공]', JSON.stringify(data))

    // ✅ [추가] 발송 일지(notification_logs)에 한 줄 기록
    //    비유: 우체국 직원이 "몇 시에 누구에게 무엇을 부쳤는지" 장부에 적는 것과 같아요.
    //    여기 기록이 실패해도 발송 자체는 이미 성공했으니, 사용자에게는 그대로 성공 응답을 줘요.
    await logNotification({
      to, type, variables,
      sendStatus: 'sent',
      groupId:      data?.groupId,
      messageId:    data?.messageId,
      statusCode:   data?.statusCode,
      statusMessage:data?.statusMessage,
    })

    return res.status(200).json({ success: true, data })

  } catch (err) {
    console.error('[서버 오류]', err)

    // ✅ [추가] 발송 실패도 기록해둬야 "왜 안 갔는지" 나중에 확인할 수 있어요
    await logNotification({
      to, type, variables,
      sendStatus: 'failed',
      errorMessage: err.message,
    })

    return res.status(500).json({ error: '서버 오류: ' + err.message })
  }
}

// ──────────────────────────────────────────────────────────────
// ✅ [신규] 발송 기록 저장 함수
// (비유: 영수증을 발송 일지에 끼워 넣는 역할. 이게 실패해도
//  알림톡 발송 자체에는 영향이 없도록 try/catch로 감싸요)
// ──────────────────────────────────────────────────────────────
async function logNotification({ to, type, variables, sendStatus, groupId, messageId, statusCode, statusMessage, errorMessage }) {
  try {
    const studentName = variables?.['#{학생이름}'] || null
    await supabaseAdmin.from('notification_logs').insert({
      student_name: studentName,
      phone: to,
      notify_type: type || null,
      send_status: sendStatus,
      error_message: errorMessage || null,
      solapi_group_id: groupId || null,
      solapi_message_id: messageId || null,
      solapi_status_code: statusCode || null,
      solapi_status_message: statusMessage || null,
    })
  } catch (logErr) {
    // 기록 실패는 조용히 로그만 남기고 넘어가요 (발송 결과에 영향 주지 않음)
    console.error('[발송 기록 저장 실패]', logErr)
  }
}