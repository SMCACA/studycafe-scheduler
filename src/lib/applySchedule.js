// ================================================================
// 📁 src/lib/applySchedule.js  (신청서 ↔ 스케줄 공통 규칙)
// ================================================================
// 비유: 신청서 화면과 관리자 화면이 같은 "규칙표"를 보고 일하도록,
//       규칙을 종이 한 장(이 파일)에 모아둔 거예요.
//       스케줄 관리(ScheduleManagement.jsx)와 같은 값('평일'/'주말'/'풀', mon_slots 등)을
//       그대로 써야 학생 등록으로 전환할 때 오류가 안 나요.
// ================================================================

// 요일 정보 (색상은 스케줄 관리 화면과 동일)
export const DAYS = [
  { key: 'mon_slots', cfgKey: 'mon', label: '월', type: 'weekday', color: '#6366F1', bgLight: '#F5F7FF' },
  { key: 'tue_slots', cfgKey: 'tue', label: '화', type: 'weekday', color: '#8B5CF6', bgLight: '#FAF9FF' },
  { key: 'wed_slots', cfgKey: 'wed', label: '수', type: 'weekday', color: '#0EA5E9', bgLight: '#F7FBFF' },
  { key: 'thu_slots', cfgKey: 'thu', label: '목', type: 'weekday', color: '#14B8A6', bgLight: '#F7FEFC' },
  { key: 'fri_slots', cfgKey: 'fri', label: '금', type: 'weekday', color: '#10B981', bgLight: '#F5FDF9' },
  { key: 'sat_slots', cfgKey: 'sat', label: '토', type: 'weekend', color: '#F59E0B', bgLight: '#FFFAF3' },
  { key: 'sun_slots', cfgKey: 'sun', label: '일', type: 'weekend', color: '#E11D48', bgLight: '#FFF7F8' },
]

// 이용권 (value는 DB에 저장되는 값 = 스케줄 관리의 "재원 구분" 값)
export const MEMBERSHIP_OPTIONS = [
  { value: '평일', label: '평일권',   desc: '월 ~ 금' },
  { value: '주말', label: '주말권',   desc: '토 · 일' },
  { value: '풀',   label: '풀타임권', desc: '월 ~ 일 전체' },
]

export const MEMBERSHIP_LABEL = { 평일: '평일권', 주말: '주말권', 풀: '풀타임권' }

// 서버가 응답 못 할 때 쓰는 기본값 (스케줄 관리와 동일)
export const DEFAULT_SLOT_CONFIG = { mon: 5, tue: 5, wed: 5, thu: 5, fri: 5, sat: 10, sun: 10 }

/** 이용권으로 그 요일에 올 수 있는지 */
export function isDayAllowed(membership, dayType) {
  if (membership === '풀') return true
  if (membership === '평일') return dayType === 'weekday'
  if (membership === '주말') return dayType === 'weekend'
  return false
}

/** 빈 시간표 { mon_slots: [], ... } */
export function emptySlots() {
  return Object.fromEntries(DAYS.map(d => [d.key, []]))
}

/** 이용권·교시 수에 맞지 않는 칸을 지운 새 시간표를 돌려줌 */
export function cleanSlots(slots, membership, slotConfig) {
  const out = {}
  DAYS.forEach(d => {
    const max = slotConfig?.[d.cfgKey] ?? DEFAULT_SLOT_CONFIG[d.cfgKey]
    const list = Array.isArray(slots?.[d.key]) ? slots[d.key] : []
    out[d.key] = isDayAllowed(membership, d.type)
      ? [...new Set(list.map(Number))].filter(n => Number.isInteger(n) && n >= 1 && n <= max).sort((a, b) => a - b)
      : []
  })
  return out
}

/** 선택한 교시 총 개수 */
export function countSlots(slots) {
  return DAYS.reduce((sum, d) => sum + (slots?.[d.key]?.length || 0), 0)
}

/** 교시 번호 → 시간 글자 (예: 1 → '오후 4시') */
export function timeLabel(timeConfig, dayType, n) {
  return timeConfig?.[dayType]?.[n] || ''
}

/**
 * 요약 글자 만들기 (표에 보여줄 때)
 * 예) [{ day:'월', text:'1·2·3교시' }, { day:'토', text:'1·2교시' }]
 */
export function summarizeSlots(slots) {
  return DAYS
    .filter(d => (slots?.[d.key]?.length || 0) > 0)
    .map(d => ({ day: d.label, color: d.color, text: slots[d.key].join('·') + '교시' }))
}
