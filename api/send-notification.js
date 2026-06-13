// ================================================================
// 📁 api/send-notification.js
// ================================================================
// 이 파일은 "Vercel 서버리스 함수" (= 서버 역할을 하는 작은 프로그램)입니다.
// React 앱이 이 주소를 호출하면, 여기서 Solapi에 알림톡/문자를 보냅니다.
// API 키는 이 파일에서만 사용 → 브라우저에 절대 노출되지 않아요!
//
// 🗂️ 위치: 프로젝트 최상단(root) > api > send-notification.js
//          (src 폴더 안이 아니라 프로젝트 루트에 api 폴더를 새로 만들어야 해요!)
// ================================================================

import crypto from 'crypto' // Node.js 내장 암호화 모듈 (설치 불필요)

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

  // React에서 보낸 데이터를 꺼냄
  const { to, text, type } = req.body
  // to   = 학부모 전화번호 (수신자)
  // text = 보낼 메시지 내용
  // type = 'schedule'(스케줄) 또는 'reward'(상벌점)

  // 필수값 체크
  if (!to || !text) {
    return res.status(400).json({ error: '수신번호와 메시지가 필요합니다' })
  }

  // ── Vercel 환경변수에서 API 키 읽기 ──
  const apiKey      = process.env.SOLAPI_API_KEY       // Solapi API 키
  const apiSecret   = process.env.SOLAPI_API_SECRET    // Solapi API Secret
  const fromNumber  = process.env.SOLAPI_FROM_NUMBER   // 발신번호 (등록된 번호)
  const pfId        = process.env.SOLAPI_PF_ID         // 카카오 채널 ID (알림톡용)

  // 필수 환경변수 누락 시 에러
  if (!apiKey || !apiSecret || !fromNumber) {
    return res.status(500).json({
      error: 'Vercel 환경변수를 확인해주세요 (SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_FROM_NUMBER)'
    })
  }

  // ── 메시지 객체 구성 ──
  // 카카오 채널(pfId)이 설정되어 있으면 → 알림톡(ATA)
  // 없으면 → SMS/LMS 문자로 자동 전환 (텍스트 90바이트 초과 시 LMS)
  const message = {
    to:   cleanPhone(to),           // 수신자 번호
    from: cleanPhone(fromNumber),   // 발신자 번호
    text: text,
  }

  if (pfId) {
    // 📲 알림톡 모드 (카카오 채널 연동 완료 후)
    message.kakaoOptions = {
      pfId:       pfId,
      disableSms: false, // 알림톡 실패 시 SMS로 자동 대체 (권장!)
    }
    console.log('[알림톡 발송] 수신번호:', cleanPhone(to))
  } else {
    // 📱 SMS/LMS 모드 (카카오 채널 미설정 시 자동 사용)
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
      console.error('[Solapi 에러]', data)
      return res.status(response.status).json({
        error:  data.errorMessage || '발송 실패',
        detail: data,
      })
    }

    // 성공!
    console.log('[발송 성공]', data)
    return res.status(200).json({ success: true, data })

  } catch (err) {
    console.error('[서버 오류]', err)
    return res.status(500).json({ error: '서버 오류: ' + err.message })
  }
}