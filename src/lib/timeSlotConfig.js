// ─────────────────────────────────────────────────────────
//  교시 → 시간 매핑 유틸리티 (평일/주말 분리 버전)
//  Supabase 테이블: time_slot_config { period_number, day_type, time_label }
//  day_type = 'weekday' (평일) 또는 'weekend' (주말)
// ─────────────────────────────────────────────────────────

/** 기본값: 평일 교시별 기본 시간 */
export const DEFAULT_WEEKDAY_CONFIG = {
  1: '오후 4시',  2: '오후 5시',  3: '오후 6시',  4: '오후 7시',  5: '오후 8시',
  6: '오후 9시',  7: '오후 10시', 8: '오후 11시', 9: '오후 12시', 10: '오후 1시',
}

/** 기본값: 주말 교시별 기본 시간 */
export const DEFAULT_WEEKEND_CONFIG = {
  1: '오전 10시', 2: '오전 11시', 3: '오후 12시', 4: '오후 1시',  5: '오후 2시',
  6: '오후 3시',  7: '오후 4시',  8: '오후 5시',  9: '오후 6시',  10: '오후 7시',
}

/** 구조화된 기본 설정 (평일+주말 합친 것) */
export const DEFAULT_TIME_CONFIG = {
  weekday: { ...DEFAULT_WEEKDAY_CONFIG },
  weekend: { ...DEFAULT_WEEKEND_CONFIG },
}

/**
 * 요일 키를 받아 weekday / weekend 판단
 * 예) 'sat_slots' → 'weekend', 'mon_slots' → 'weekday'
 */
export function getDayType(dayKey) {
  return (dayKey === 'sat_slots' || dayKey === 'sun_slots') ? 'weekend' : 'weekday'
}

/**
 * Supabase에서 평일/주말 시간 설정 불러오기
 * @returns {Promise<{ weekday: Record<number,string>, weekend: Record<number,string> }>}
 */
export async function loadTimeConfig(supabase) {
  const fallback = {
    weekday: { ...DEFAULT_WEEKDAY_CONFIG },
    weekend: { ...DEFAULT_WEEKEND_CONFIG },
  }

  try {
    const { data, error } = await supabase
      .from('time_slot_config')
      .select('period_number, day_type, time_label')
      .order('period_number')

    if (error || !data || data.length === 0) return fallback

    // 기본값 위에 Supabase 값 덮어쓰기
    const result = {
      weekday: { ...DEFAULT_WEEKDAY_CONFIG },
      weekend: { ...DEFAULT_WEEKEND_CONFIG },
    }
    data.forEach(row => {
      const type = row.day_type === 'weekend' ? 'weekend' : 'weekday'
      result[type][row.period_number] = row.time_label
    })
    return result

  } catch {
    return fallback
  }
}

/**
 * Supabase에 평일/주말 시간 설정 저장 (upsert)
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ weekday: Record<number,string>, weekend: Record<number,string> }} config
 */
export async function saveTimeConfig(supabase, config) {
  const rows = []
  for (const [dayType, periods] of Object.entries(config)) {
    for (const [period, label] of Object.entries(periods)) {
      if (label && label.trim() !== '') {
        rows.push({
          period_number: parseInt(period, 10),
          day_type: dayType,              // 'weekday' 또는 'weekend'
          time_label: label.trim(),
        })
      }
    }
  }

  const { error } = await supabase
    .from('time_slot_config')
    .upsert(rows, { onConflict: 'period_number,day_type' })

  if (error) throw error
}

// ─────────────────────────────────────────────────────────
//  ✅ 사이트 주소 (알림톡 버튼 URL 생성에 사용)
//  window.location.origin은 브라우저에서만 값이 있고,
//  알림톡 발송 시점에는 비어서 'https://' 만 남는 문제가 있었음 → 3109 에러
//  ➡ 실제 배포 주소를 고정값으로 박아서 항상 완전한 URL이 되도록 함
//  ⚠️ 도메인이 바뀌면 아래 SITE_ORIGIN 값만 새 주소로 변경하세요!
// ─────────────────────────────────────────────────────────
const SITE_ORIGIN = 'https://studycafe-scheduler.vercel.app'

/** 현재 사이트 주소를 안전하게 반환 (브라우저면 현재 주소, 아니면 고정 주소) */
function getOrigin() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return SITE_ORIGIN
}

/**
 * 시간표 데이터를 깔끔한 객체(payload)로 정리 (내부 공통 함수)
 * timeConfig는 { weekday: {...}, weekend: {...} } 구조로 전달
 */
function buildSchedulePayload(student, schedule, timeConfig) {
  return {
    name:       student.name,
    grade:      student.grade || '',
    seat:       student.seat_number ?? schedule?.seat_number ?? '',
    membership: schedule?.membership_type || '',
    slots: {
      mon_slots: schedule?.mon_slots || [],
      tue_slots: schedule?.tue_slots || [],
      wed_slots: schedule?.wed_slots || [],
      thu_slots: schedule?.thu_slots || [],
      fri_slots: schedule?.fri_slots || [],
      sat_slots: schedule?.sat_slots || [],
      sun_slots: schedule?.sun_slots || [],
    },
    timeConfig,  // ✅ { weekday: {...}, weekend: {...} } 구조
  }
}

/**
 * ✅ 시간표 데이터를 Supabase 창고에 저장하고 "짧은 ID"를 받아옴
 *    (비유: 택배 내용물을 창고에 맡기고 보관번호를 받는 단계)
 *    발송 직전에 한 번 호출하면 됩니다.
 * @returns {Promise<string>} 짧은 ID (예: 'k7f3a9b2')
 */
export async function saveSnapshot(student, schedule, timeConfig) {
  const payload = buildSchedulePayload(student, schedule, timeConfig)

  const res = await fetch('/api/save-snapshot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `시간표 저장 실패 (${res.status})`)
  }

  const { id } = await res.json()
  if (!id) throw new Error('시간표 저장 응답에 ID가 없습니다')
  return id
}

/**
 * ✅ 짧은 ID로 시간표 이미지 URL 생성 (알림톡 버튼에 사용)
 *    예: https://.../api/schedule-image?id=k7f3a9b2  ← 아주 짧음!
 */
export function buildImageUrlFromId(id) {
  return `${getOrigin()}/api/schedule-image?id=${id}`
}

/**
 * ✅ 짧은 ID로 공개 웹페이지 URL 생성 (관리자 참고용)
 */
export function buildPublicUrlFromId(id) {
  return `${getOrigin()}/view?id=${id}`
}