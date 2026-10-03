// ================================================================
// 📁 api/submit-application.js  (신청서의 모든 서버 일을 한 파일에서 처리)
// ================================================================
// 비유: 접수 창구 하나에서 여러 가지 일을 하는 직원이에요.
//   - GET  ?mode=config  : 교시 수·교시별 시간표 알려주기     → 누구나 (/apply 화면이 사용)
//   - POST               : 신청서 접수                       → 누구나 (/apply 화면)
//   - GET                : 신청자 명단 보여주기               → 로그인한 관리자만
//   - PATCH {status}     : 처리 상태 도장 찍기               → 로그인한 관리자만
//   - PATCH {action:'convert'} : 신청자를 학생으로 등록 + 스케줄 등록 → 로그인한 관리자만
//   - DELETE {ids:[...]} : 신청서 삭제 (테스트·불필요한 것 정리)    → 로그인한 관리자만
//
// ⚠️ 왜 파일 하나에 다 모았나요?
//    Vercel 무료(Hobby) 요금제는 api 폴더 파일(=서버 함수)을 최대 12개까지만 허용해요.
//    그래서 파일을 늘리지 않고 이 파일에 기능을 얹었어요.
// ================================================================

import { createClient } from '@supabase/supabase-js'

// ⚠️ "서비스 키(service role key)" = 직원용 마스터키 (보안 규칙을 우회함)
//    그래서 절대 화면(프론트엔드) 코드에는 쓰면 안 되고, 서버 코드(api 폴더)에서만 써요.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── 공통 상수 ───────────────────────────────────────────────
// 관리자가 드롭다운으로 바꿀 수 있는 상태 ('등록완료'는 전환 버튼으로만 바뀜)
const MANUAL_STATUS = ['대기중', '연락완료', '취소']
const MEMBERSHIPS   = ['평일', '주말', '풀']        // 스케줄 관리의 "재원 구분"과 같은 값
const CONVERT_AS    = ['재원생', '예비원생']        // 학생 관리의 상태값과 같은 값

const DAY_KEYS = ['mon_slots', 'tue_slots', 'wed_slots', 'thu_slots', 'fri_slots', 'sat_slots', 'sun_slots']
const WEEKEND_KEYS = new Set(['sat_slots', 'sun_slots'])

// 스케줄 관리 화면(ScheduleManagement.jsx)과 똑같은 기본값
const DEFAULT_SLOT_CONFIG = { mon: 5, tue: 5, wed: 5, thu: 5, fri: 5, sat: 10, sun: 10 }
const DEFAULT_WEEKDAY_TIME = {
  1: '오후 4시', 2: '오후 5시', 3: '오후 6시', 4: '오후 7시', 5: '오후 8시',
  6: '오후 9시', 7: '오후 10시', 8: '오후 11시', 9: '오후 12시', 10: '오후 1시',
}
const DEFAULT_WEEKEND_TIME = {
  1: '오전 10시', 2: '오전 11시', 3: '오후 12시', 4: '오후 1시', 5: '오후 2시',
  6: '오후 3시', 7: '오후 4시', 8: '오후 5시', 9: '오후 6시', 10: '오후 7시',
}

// ── 도우미 함수들 ───────────────────────────────────────────

// 로그인한 관리자인지 확인
// 비유: 화면이 보내온 "출입증(토큰)"을 Supabase에 보여주고 진짜 직원 출입증인지 확인받기
async function isLoggedInAdmin(req) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) return false
  const { data, error } = await supabase.auth.getUser(token)
  return !error && !!data?.user
}

// 요일별 교시 수 + 교시별 시간 불러오기 (스케줄 관리에서 설정한 값)
async function loadScheduleConfig() {
  const slotConfig = { ...DEFAULT_SLOT_CONFIG }
  const timeConfig = { weekday: { ...DEFAULT_WEEKDAY_TIME }, weekend: { ...DEFAULT_WEEKEND_TIME } }

  const [slotRes, timeRes] = await Promise.all([
    supabase.from('schedule_slot_config').select('day_key, slot_count'),
    supabase.from('time_slot_config').select('period_number, day_type, time_label'),
  ])

  if (!slotRes.error && slotRes.data) {
    slotRes.data.forEach(r => {
      const n = Number(r.slot_count)
      if (r.day_key in slotConfig && Number.isInteger(n) && n > 0) slotConfig[r.day_key] = n
    })
  }
  if (!timeRes.error && timeRes.data) {
    timeRes.data.forEach(r => {
      const type = r.day_type === 'weekend' ? 'weekend' : 'weekday'
      if (r.time_label) timeConfig[type][r.period_number] = r.time_label
    })
  }
  return { slotConfig, timeConfig }
}

// 이용권으로 그 요일에 올 수 있는지
function isDayAllowed(membership, dayKey) {
  if (membership === '풀') return true
  if (membership === '평일') return !WEEKEND_KEYS.has(dayKey)
  if (membership === '주말') return WEEKEND_KEYS.has(dayKey)
  return false
}

// 화면에서 온 교시 선택값을 "검사 + 정리"
// 비유: 접수된 시간표를 직원이 한 번 더 훑어보며
//       ① 숫자가 아닌 것, ② 없는 교시, ③ 이용권으로 못 오는 요일을 걸러내는 과정
// 반환: { slots: {mon_slots:[...], ...}, total: 선택한 교시 총 개수, error: 문제 있으면 메시지 }
function sanitizeSlots(raw, membership, slotConfig) {
  const slots = {}
  let total = 0
  for (const key of DAY_KEYS) {
    const max = slotConfig[key.replace('_slots', '')] || 0
    const list = Array.isArray(raw?.[key]) ? raw[key] : []
    if (!isDayAllowed(membership, key)) { slots[key] = []; continue }

    const clean = new Set()
    for (const v of list) {
      const n = Number(v)
      if (!Number.isInteger(n) || n < 1 || n > max) {
        return { error: '선택한 교시 중 현재 운영하지 않는 교시가 있어요. 새로고침 후 다시 선택해주세요.' }
      }
      clean.add(n)
    }
    slots[key] = [...clean].sort((a, b) => a - b)
    total += slots[key].length
  }
  return { slots, total }
}

function isValidDateStr(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime())
}

function todayKorea() {
  // 예: 2026-10-03
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
}

// ================================================================
export default async function handler(req, res) {
  try {
    // ── GET ?mode=config : 교시 설정 (공개) ──
    if (req.method === 'GET' && req.query?.mode === 'config') {
      const cfg = await loadScheduleConfig()
      return res.status(200).json(cfg)
    }

    if (req.method === 'POST') return await handleSubmit(req, res)

    if (req.method === 'GET' || req.method === 'PATCH' || req.method === 'DELETE') {
      if (!(await isLoggedInAdmin(req))) {
        return res.status(401).json({ error: '로그인이 필요해요. 다시 로그인해주세요.' })
      }
      if (req.method === 'GET') return await handleList(req, res)
      if (req.method === 'DELETE') return await handleDelete(req, res)
      if (req.body?.action === 'convert') return await handleConvert(req, res)
      return await handleStatus(req, res)
    }

    return res.status(405).json({ error: '허용되지 않은 요청 방식이에요' })
  } catch (err) {
    console.error('submit-application 오류:', err)
    return res.status(500).json({ error: '서버 오류: ' + (err.message || '알 수 없는 오류') })
  }
}

// ────────────────────────────────────────────────
// 1) POST : 신청서 저장 (누구나)
// ────────────────────────────────────────────────
async function handleSubmit(req, res) {
  const {
    name, grade, is_academy_student, school,
    parent_phone, student_phone, desired_start_date, desired_schedule_text,
    membership_type, desired_slots,
  } = req.body || {}

  // 서버 쪽에서도 필수값 확인 (화면 쪽 검증을 믿지 않고 한 번 더 체크)
  if (!name?.trim() || !grade || typeof is_academy_student !== 'boolean') {
    return res.status(400).json({ error: '필수 항목이 비어있어요' })
  }
  if (!parent_phone?.trim() && !student_phone?.trim()) {
    return res.status(400).json({ error: '연락처를 하나 이상 입력해주세요' })
  }
  if (!MEMBERSHIPS.includes(membership_type)) {
    return res.status(400).json({ error: '이용권(평일권/주말권/풀타임권)을 선택해주세요' })
  }
  if (desired_start_date && !isValidDateStr(desired_start_date)) {
    return res.status(400).json({ error: '희망 시작일 형식이 올바르지 않아요' })
  }

  const { slotConfig } = await loadScheduleConfig()
  const checked = sanitizeSlots(desired_slots, membership_type, slotConfig)
  if (checked.error) return res.status(400).json({ error: checked.error })
  if (checked.total === 0) {
    return res.status(400).json({ error: '희망 스케줄을 최소 1개 이상 선택해주세요' })
  }

  const { data, error } = await supabase
    .from('applicants')
    .insert({
      name: name.trim(),
      grade,
      is_academy_student,
      school: school?.trim() || null,
      parent_phone: parent_phone?.trim() || null,
      student_phone: student_phone?.trim() || null,
      desired_start_date: desired_start_date || null,
      desired_schedule_text: desired_schedule_text?.trim() || null,
      membership_type,
      desired_slots: checked.slots,
      status: '대기중',
    })
    .select()

  if (error) {
    console.error('신청서 저장 실패:', error)
    // 칸이 없다는 오류면 SQL을 아직 안 돌린 것
    // 실제 원인(error.message)도 같이 보여줘서, 문제가 생기면 바로 원인을 알 수 있게 해요
    if (/could not find|does not exist|schema cache/i.test(error.message)) {
      return res.status(500).json({ error: `신청서 저장 칸이 준비되지 않았어요 (관리자: SQL 실행 필요) [${error.message}]` })
    }
    return res.status(500).json({ error: `저장 중 문제가 발생했어요 [${error.message}]` })
  }
  return res.status(200).json({ success: true, applicant: data[0] })
}

// ────────────────────────────────────────────────
// 2) GET : 신청자 명단 + 교시 설정 (관리자만)
// ────────────────────────────────────────────────
async function handleList(req, res) {
  let { data, error } = await supabase
    .from('applicants')
    .select('*')
    .order('created_at', { ascending: false })

  // 혹시 created_at 칸이 없는 테이블이면 정렬 없이 다시 시도
  if (error) {
    console.warn('created_at 정렬 실패, 정렬 없이 재시도:', error.message)
    const retry = await supabase.from('applicants').select('*')
    data = retry.data
    error = retry.error
  }
  if (error) throw error

  const config = await loadScheduleConfig()
  return res.status(200).json({ applicants: data || [], ...config })
}

// ────────────────────────────────────────────────
// 3) PATCH {id, status} : 처리 상태 변경 (관리자만)
// ────────────────────────────────────────────────
async function handleStatus(req, res) {
  const { id, status } = req.body || {}
  if (!id || !MANUAL_STATUS.includes(status)) {
    return res.status(400).json({ error: '잘못된 요청이에요 (등록완료는 전환 버튼으로만 바꿀 수 있어요)' })
  }

  // 이미 학생으로 전환된 신청서는 상태를 못 바꾸게 잠금
  const { data: cur, error: curErr } = await supabase
    .from('applicants').select('id, converted_student_id').eq('id', id).maybeSingle()
  if (curErr) throw curErr
  if (!cur) return res.status(404).json({ error: '해당 신청서를 찾지 못했어요' })
  if (cur.converted_student_id) {
    return res.status(409).json({ error: '이미 학생으로 등록된 신청서라 상태를 바꿀 수 없어요' })
  }

  const { data, error } = await supabase
    .from('applicants').update({ status }).eq('id', id).select()
  if (error) throw error
  return res.status(200).json({ success: true, applicant: data[0] })
}

// ────────────────────────────────────────────────
// 4) PATCH {action:'convert'} : 신청자 → 학생 등록 + 스케줄 등록 (관리자만)
// ────────────────────────────────────────────────
// 순서 (비유: 입학 서류 처리)
//   ① 신청서 꺼내기 → 이미 처리됐는지 확인 (중복 등록 방지)
//   ② 입력값 검사 (상태·이용권·교시·좌석·날짜)
//   ③ 좌석이 이미 다른 학생 것인지 확인
//   ④ 같은 이름 학생이 이미 있는지 확인 (관리자가 "그래도 등록" 하면 통과)
//   ⑤ 학생 명부(students)에 등록
//   ⑥ 스케줄(schedules)에 등록 → 실패하면 ⑤를 되돌림
//   ⑦ 신청서에 "처리 완료" 도장 → 실패하면 ⑤⑥을 되돌림
//   (되돌리기 = 롤백(rollback): 중간에 실패하면 반쯤 처리된 흔적을 지워서 원래대로 돌려놓기)
async function handleConvert(req, res) {
  const { id, as, membership_type, slots, seat_number, first_attendance_date, force } = req.body || {}

  // ① 신청서 확인
  const { data: app, error: appErr } = await supabase
    .from('applicants').select('*').eq('id', id).maybeSingle()
  if (appErr) throw appErr
  if (!app) return res.status(404).json({ error: '해당 신청서를 찾지 못했어요' })
  if (app.converted_student_id) {
    return res.status(409).json({ error: `이미 ${app.converted_as || '학생'}(으)로 등록된 신청서예요` })
  }

  // ② 입력값 검사
  if (!CONVERT_AS.includes(as)) return res.status(400).json({ error: '재원생/예비원생 중 하나를 골라주세요' })
  if (!MEMBERSHIPS.includes(membership_type)) return res.status(400).json({ error: '이용권을 선택해주세요' })

  const { slotConfig } = await loadScheduleConfig()
  const checked = sanitizeSlots(slots, membership_type, slotConfig)
  if (checked.error) return res.status(400).json({ error: checked.error })
  if (checked.total === 0) return res.status(400).json({ error: '스케줄을 최소 1개 이상 선택해주세요' })

  let seat = null
  if (seat_number !== null && seat_number !== undefined && seat_number !== '') {
    seat = Number(seat_number)
    if (!Number.isInteger(seat) || seat < 1) return res.status(400).json({ error: '좌석번호가 올바르지 않아요' })
  }
  if (first_attendance_date && !isValidDateStr(first_attendance_date)) {
    return res.status(400).json({ error: '첫등원일 형식이 올바르지 않아요' })
  }

  // ③ 좌석 중복 확인 (재원생·예비원생이 쓰는 좌석은 불가, 퇴원생 좌석은 비어있는 것으로 봄)
  if (seat !== null) {
    const { data: seatUsers, error: seatErr } = await supabase
      .from('students').select('id, name, status').eq('seat_number', seat)
    if (seatErr) throw seatErr
    const taken = (seatUsers || []).find(s => (s.status || '재원생') !== '퇴원생')
    if (taken) {
      return res.status(409).json({ error: `${seat}번 좌석은 이미 ${taken.name} 학생이 쓰고 있어요` })
    }
  }

  // ④ 같은 이름 학생 확인 (퇴원생 제외)
  if (!force) {
    const { data: same, error: sameErr } = await supabase
      .from('students').select('id, name, grade, school, status').eq('name', app.name)
    if (sameErr) throw sameErr
    const active = (same || []).filter(s => (s.status || '재원생') !== '퇴원생')
    if (active.length > 0) {
      return res.status(409).json({
        code: 'DUPLICATE_NAME',
        error: `같은 이름의 학생이 이미 있어요`,
        matches: active.map(s => ({ name: s.name, grade: s.grade, school: s.school, status: s.status || '재원생' })),
      })
    }
  }

  // ⑤ 학생 등록
  const memoLines = [`[신청서 등록 ${todayKorea()}]`]
  if (app.desired_schedule_text) memoLines.push(`희망사항: ${app.desired_schedule_text}`)

  const { data: stuRows, error: stuErr } = await supabase
    .from('students')
    .insert({
      name: app.name,
      grade: app.grade,
      school: app.school || null,
      parent_phone: app.parent_phone || null,
      student_phone: app.student_phone || null,
      status: as,
      is_academy_student: !!app.is_academy_student,
      seat_number: seat,
      first_attendance_date: first_attendance_date || app.desired_start_date || null,
      memo: memoLines.join('\n'),
    })
    .select()
  if (stuErr) {
    console.error('학생 등록 실패:', stuErr)
    return res.status(500).json({ error: '학생 등록 실패: ' + stuErr.message })
  }
  const student = stuRows[0]

  // ⑥ 스케줄 등록 (스케줄 관리 화면과 완전히 같은 모양)
  const { data: schRows, error: schErr } = await supabase
    .from('schedules')
    .insert({
      student_id: student.id,
      seat_number: seat,
      membership_type,
      ...checked.slots,
    })
    .select()
  if (schErr) {
    console.error('스케줄 등록 실패 → 학생 등록 되돌림:', schErr)
    await supabase.from('students').delete().eq('id', student.id)
    return res.status(500).json({ error: '스케줄 등록 실패 (학생 등록도 취소했어요): ' + schErr.message })
  }
  const schedule = schRows[0]

  // ⑦ 신청서에 처리 완료 기록
  //    .is('converted_student_id', null) : 그 사이 다른 관리자가 먼저 처리했으면 덮어쓰지 않음
  const { data: updRows, error: updErr } = await supabase
    .from('applicants')
    .update({
      status: '등록완료',
      membership_type,
      desired_slots: checked.slots,
      converted_student_id: String(student.id),
      converted_as: as,
      converted_at: new Date().toISOString(),
    })
    .eq('id', app.id)
    .is('converted_student_id', null)
    .select()

  if (updErr || !updRows || updRows.length === 0) {
    console.error('신청서 업데이트 실패 → 전부 되돌림:', updErr)
    await supabase.from('schedules').delete().eq('id', schedule.id)
    await supabase.from('students').delete().eq('id', student.id)
    const msg = updErr
      ? '신청서 기록 실패 (등록을 모두 취소했어요): ' + updErr.message
      : '다른 곳에서 먼저 처리된 신청서예요 (등록을 취소했어요). 새로고침해주세요.'
    return res.status(updErr ? 500 : 409).json({ error: msg })
  }

  return res.status(200).json({ success: true, applicant: updRows[0], student, schedule })
}

// ────────────────────────────────────────────────
// 5) DELETE {ids:[...]} : 신청서 삭제 (관리자만)
// ────────────────────────────────────────────────
// ⚠️ applicants(신청서) 기록만 지워요.
//    이미 학생으로 전환된 신청서라도 students(학생)·schedules(스케줄)는 건드리지 않아요.
//    (비유: 접수 서류철에서 신청서 한 장을 버려도, 이미 만든 학생 명부는 그대로)
async function handleDelete(req, res) {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(v => v !== null && v !== undefined && v !== '') : []
  if (ids.length === 0) return res.status(400).json({ error: '삭제할 신청서를 골라주세요' })
  if (ids.length > 200) return res.status(400).json({ error: '한 번에 200건까지만 삭제할 수 있어요' })

  const { data, error } = await supabase
    .from('applicants')
    .delete()
    .in('id', ids)
    .select('id')
  if (error) throw error

  return res.status(200).json({ success: true, deletedIds: (data || []).map(r => r.id) })
}
