// ================================================================
// 📁 api/send-notification.js
// ================================================================
// Vercel 서버리스 함수 (= 서버 역할을 하는 작은 프로그램)
// React 앱이 이 주소를 호출하면, 여기서 Solapi에 알림톡/문자를 보냅니다.
// API 키는 이 파일에서만 사용 → 브라우저에 절대 노출되지 않아요!
// ================================================================

import crypto from 'crypto'

// ──────────────────────────────────────────────────────────────
// Solapi 인증 헤더 생성
// (마치 편지에 도장 찍는 것처럼, 우리가 진짜 Solapi 회원임을 증명)
// ──────────────────────────────────────────────────────────────
function makeAuthHeader(apiKey, apiSecret) {
  const date      = new Date().toISOString()
  const salt      = Math.random().toString(36).substring(2, 15)
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(date + salt)
    .digest('hex')

  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`
}

// ──────────────────────────────────────────────────────────────
// 전화번호 정리 함수 (010-1234-5678 → 01012345678)
// ──────────────────────────────────────────────────────────────
function cleanPhone(phone) {
  return phone.replace(/[^0-9]/g, '')
}

// ──────────────────────────────────────────────────────────────
// 메인 핸들러
// ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // POST 요청만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 요청만 허용됩니다' })
  }

  // React에서 보낸 데이터
  const { to, text, type } = req.body

  if (!to || !text) {
    return res.status(400).json({ error: '수신번호와 메시지가 필요합니다' })
  }

  // ── Vercel 환경변수에서 API 키 읽기 ──
  const apiKey      = process.env.SOLAPI_API_KEY
  const apiSecret   = process.env.SOLAPI_API_SECRET
  const fromNumber  = process.env.SOLAPI_FROM_NUMBER
  const pfId        = process.env.SOLAPI_PF_ID          // 카카오 채널 ID
  const templateId  = process.env.SOLAPI_TEMPLATE_ID    // ✅ 알림톡 템플릿 ID (추가!)

  if (!apiKey || !apiSecret || !fromNumber) {
    return res.status(500).json({
      error: 'Vercel 환경변수를 확인해주세요 (SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_FROM_NUMBER)'
    })
  }

  // ── 메시지 객체 구성 ──
  const message = {
    to:   cleanPhone(to),
    from: cleanPhone(fromNumber),
    text: text,
  }

  // 카카오 채널 ID가 있으면 → 알림톡 시도 (실패 시 SMS 자동 대체)
  // 카카오 채널 ID가 없으면 → SMS/LMS로 바로 발송
  if (pfId) {
    message.kakaoOptions = {
      pfId:        pfId,
      disableSms:  false, // ✅ 알림톡 실패 시 SMS로 자동 대체 (중요!)
    }

    // ✅ 알림톡 템플릿 ID가 있으면 알림톡으로 발송, 없으면 SMS 폴백
    if (templateId) {
      message.kakaoOptions.templateId = templateId
      console.log('[알림톡 발송] 수신번호:', cleanPhone(to), '| 템플릿:', templateId)
    } else {
      // templateId 없으면 알림톡 발송 자체가 안 되므로 SMS로만 발송
      // pfId는 두되 templateId 없이 보내면 Solapi가 SMS로 자동 처리
      console.log('[SMS 폴백] templateId 없음 → SMS로 발송 | 수신번호:', cleanPhone(to))
    }
  } else {
    console.log('[SMS 발송] pfId 없음 | 수신번호:', cleanPhone(to))
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
      console.error('[Solapi 에러]', JSON.stringify(data))
      return res.status(response.status).json({
        error:  data.errorMessage || '발송 실패',
        detail: data,
      })
    }

    console.log('[발송 성공]', JSON.stringify(data))
    return res.status(200).json({ success: true, data })

  } catch (err) {
    console.error('[서버 오류]', err)
    return res.status(500).json({ error: '서버 오류: ' + err.message })
  }
}