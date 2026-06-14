// ─────────────────────────────────────────────────────────
//  교시 → 시간 매핑 유틸리티 (Supabase 저장 버전)
//  테이블: time_slot_config { period_number, time_label }
// ─────────────────────────────────────────────────────────

/** 기본값: 교시별 기본 시간 라벨 */
export const DEFAULT_TIME_CONFIG = {
  1: '오전 9시',
  2: '오전 10시',
  3: '오전 11시',
  4: '오후 12시',
  5: '오후 1시',
  6: '오후 2시',
  7: '오후 3시',
  8: '오후 4시',
  9: '오후 5시',
  10: '오후 6시',
}

/**
 * Supabase에서 시간 설정 불러오기
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<Record<number, string>>}
 */
export async function loadTimeConfig(supabase) {
  try {
    const { data, error } = await supabase
      .from('time_slot_config')
      .select('period_number, time_label')
      .order('period_number')

    if (error || !data || data.length === 0) {
      return { ...DEFAULT_TIME_CONFIG }
    }

    const config = { ...DEFAULT_TIME_CONFIG }  // 기본값 위에 덮어쓰기
    data.forEach(row => {
      config[row.period_number] = row.time_label
    })
    return config
  } catch {
    return { ...DEFAULT_TIME_CONFIG }
  }
}

/**
 * Supabase에 시간 설정 저장 (upsert)
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Record<number, string>} config
 */
export async function saveTimeConfig(supabase, config) {
  const rows = Object.entries(config)
    .filter(([, label]) => label && label.trim() !== '')
    .map(([period, label]) => ({
      period_number: parseInt(period, 10),
      time_label: label.trim(),
    }))

  const { error } = await supabase
    .from('time_slot_config')
    .upsert(rows, { onConflict: 'period_number' })

  if (error) throw error
}

/**
 * 학생 스케줄 공개 링크 생성
 * - 현재 시간 설정을 URL에 포함시켜 로그인 없이 시간표 표시
 */
export function buildPublicUrl(student, schedule, timeConfig) {
  const payload = {
    name: student.name,
    grade: student.grade || '',
    seat: student.seat_number ?? schedule?.seat_number ?? '',
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
    timeConfig,
  }
  const encoded = btoa(encodeURIComponent(JSON.stringify(payload)))
  return `${window.location.origin}/view?data=${encoded}`
}
