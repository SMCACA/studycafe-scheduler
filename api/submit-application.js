import { createClient } from '@supabase/supabase-js'

// ⚠️ 여기서는 "익명 키(anon key)"가 아니라 "서비스 키(service role key)"를 써요.
//    비유: 익명 키는 손님용 출입증(보안 규칙 적용됨), 서비스 키는 직원용 마스터키(보안 규칙 우회 가능)예요.
//    그래서 절대로 화면(프론트엔드) 코드에는 쓰면 안 되고, 서버 코드(api 폴더)에서만 써야 해요.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  // POST 요청만 받기 (다른 방식으로 잘못 호출되면 막기)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '허용되지 않은 요청 방식이에요' })
  }

  const {
    name,
    grade,
    is_academy_student,
    school,
    parent_phone,
    student_phone,
    desired_start_date,
    desired_schedule_text,
  } = req.body

  // 서버 쪽에서도 최소한의 필수값 확인 (화면 쪽 검증을 믿지 않고 한 번 더 체크)
  if (!name || !grade || is_academy_student === null || is_academy_student === undefined) {
    return res.status(400).json({ error: '필수 항목이 비어있어요' })
  }

  try {
    const { data, error } = await supabase
      .from('applicants')
      .insert({
        name,
        grade,
        is_academy_student,
        school: school || null,
        parent_phone: parent_phone || null,
        student_phone: student_phone || null,
        desired_start_date: desired_start_date || null,
        desired_schedule_text: desired_schedule_text || null,
        status: '대기중',
      })
      .select()

    if (error) throw error

    return res.status(200).json({ success: true, applicant: data[0] })
  } catch (err) {
    console.error('신청서 저장 실패:', err)
    return res.status(500).json({ error: '저장 중 문제가 발생했어요' })
  }
}