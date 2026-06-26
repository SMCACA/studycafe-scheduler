// ================================================================
// 📁 api/check-notification-status.js
// ================================================================
// 비유: 우체국에 "제가 어제 부친 편지, 잘 도착했나요?"라고
//       다시 전화해서 물어보는 역할이에요.
//
// 1) 우리 발송 일지(notification_logs)에서 그 알림톡의 "그룹 ID"를 찾고
// 2) 솔라피에 그 그룹 ID로 "지금 상태가 뭐예요?"라고 물어본 뒤
// 3) 받은 답변(상태 코드/문구)을 발송 일지에 다시 적어둬요.
// ================================================================

import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

function makeAuthHeader(apiKey, apiSecret) {
  const date = new Date().toISOString()
  const salt = Math.random().toString(36).substring(2, 15)
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(date + salt)
    .digest('hex')
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 요청만 허용됩니다' })
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const { id } = body || {}   // notification_logs 의 행 번호(id)

    if (!id) {
      return res.status(400).json({ error: 'id 값이 필요합니다' })
    }

    // ① 발송 일지에서 그룹 ID 찾기
    const { data: log, error: findError } = await supabase
      .from('notification_logs')
      .select('*')
      .eq('id', id)
      .single()

    if (findError || !log) {
      return res.status(404).json({ error: '해당 발송 기록을 찾을 수 없어요' })
    }

    if (!log.solapi_group_id) {
      return res.status(400).json({ error: '이 기록에는 조회할 그룹 ID가 없어요 (발송 자체가 실패했을 수 있어요)' })
    }

    // ② 솔라피에 "이 그룹, 지금 상태가 뭐예요?" 물어보기
    const apiKey    = process.env.SOLAPI_API_KEY
    const apiSecret = process.env.SOLAPI_API_SECRET
    if (!apiKey || !apiSecret) {
      return res.status(500).json({ error: 'Vercel 환경변수(SOLAPI_API_KEY/SECRET)를 확인해주세요' })
    }

    const authHeader = makeAuthHeader(apiKey, apiSecret)
    const url = `https://api.solapi.com/messages/v4/groups/${log.solapi_group_id}/messages`

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': authHeader },
    })

    const result = await response.json()

    if (!response.ok) {
      return res.status(response.status).json({ error: result.errorMessage || '상태 조회 실패', detail: result })
    }

    // 솔라피 응답 모양: { groupMessages: { [messageId]: {...} } } 또는 { messageList: [...] } 등
    // 어떤 모양이든 "메시지 1건 정보"를 안전하게 뽑아내요.
    let messageInfo = null
    if (Array.isArray(result.messageList) && result.messageList.length > 0) {
      messageInfo = result.messageList[0]
    } else if (result.groupMessages && typeof result.groupMessages === 'object') {
      const first = Object.values(result.groupMessages)[0]
      if (first) messageInfo = first
    } else if (Array.isArray(result) && result.length > 0) {
      messageInfo = result[0]
    }

    const statusCode    = messageInfo?.statusCode    || messageInfo?.status     || null
    const statusMessage = messageInfo?.statusMessage || messageInfo?.statusName || null

    // ③ 발송 일지에 새 상태 적어두기
    const { data: updated, error: updateError } = await supabase
      .from('notification_logs')
      .update({
        solapi_status_code: statusCode,
        solapi_status_message: statusMessage,
        checked_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('[check-notification-status] 업데이트 실패:', updateError)
      return res.status(500).json({ error: updateError.message })
    }

    return res.status(200).json({ success: true, data: updated, raw: result })

  } catch (err) {
    console.error('[check-notification-status] 서버 오류:', err)
    return res.status(500).json({ error: '서버 오류: ' + err.message })
  }
}
