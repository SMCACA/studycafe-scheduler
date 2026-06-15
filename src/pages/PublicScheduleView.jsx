import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

// ─────────────────────────────────────────────────────────
//  요일 정보 (공개 뷰용)
// ─────────────────────────────────────────────────────────
const DAY_KEYS = [
  { slotsKey: 'mon_slots', label: '월', type: 'weekday' },
  { slotsKey: 'tue_slots', label: '화', type: 'weekday' },
  { slotsKey: 'wed_slots', label: '수', type: 'weekday' },
  { slotsKey: 'thu_slots', label: '목', type: 'weekday' },
  { slotsKey: 'fri_slots', label: '금', type: 'weekday' },
  { slotsKey: 'sat_slots', label: '토', type: 'weekend' },
  { slotsKey: 'sun_slots', label: '일', type: 'weekend' },
]

// ─────────────────────────────────────────────────────────
//  연속된 교시를 그룹으로 묶어 rowspan 계산
//  예) [2,3,4,7] → { 2: 3(rowspan), 3: 0(skip), 4: 0(skip), 7: 1(rowspan) }
// ─────────────────────────────────────────────────────────
function buildGroups(slots) {
  if (!slots || slots.length === 0) return {}
  const sorted = [...slots].sort((a, b) => a - b)
  const result = {}
  let i = 0
  while (i < sorted.length) {
    const start = sorted[i]
    let end = start
    while (i + 1 < sorted.length && sorted[i + 1] === end + 1) {
      i++
      end = sorted[i]
    }
    result[start] = end - start + 1  // rowspan 값
    for (let p = start + 1; p <= end; p++) {
      result[p] = 0                   // 위 rowspan에 포함 → 건너뜀
    }
    i++
  }
  return result
}

// ─────────────────────────────────────────────────────────
//  ✅ timeConfig에서 올바른 시간 라벨 꺼내기 (평일/주말 분리)
//  - 새 구조: { weekday: {1:'오후4시',...}, weekend: {1:'오전10시',...} }
//  - 구 구조 (하위 호환): { 1:'오전9시', 2:'오전10시', ... }
// ─────────────────────────────────────────────────────────
function getTimeLabel(timeConfig, dayType, period) {
  if (timeConfig && typeof timeConfig.weekday === 'object') {
    // ✅ 새 구조: 평일/주말 구분해서 꺼내기
    const cfg = dayType === 'weekend' ? timeConfig.weekend : timeConfig.weekday
    return (cfg && cfg[period]) ? cfg[period] : `${period}교시`
  } else {
    // 구버전 하위 호환
    return (timeConfig && timeConfig[period]) ? timeConfig[period] : `${period}교시`
  }
}

// ─────────────────────────────────────────────────────────
//  ✅ 시간표 테이블 (평일 또는 주말 한 섹션 렌더링)
// ─────────────────────────────────────────────────────────
function ScheduleTable({ sectionDays, slots, timeConfig, dayType }) {
  if (!sectionDays || sectionDays.length === 0) return null

  // 이 섹션 요일들의 rowspan 그룹 계산
  const dayGroups = {}
  sectionDays.forEach(day => {
    dayGroups[day.slotsKey] = buildGroups(slots[day.slotsKey] || [])
  })

  // 이 섹션에서 사용되는 최대 교시 번호
  const allNums = sectionDays.flatMap(d => slots[d.slotsKey] || []).filter(Number.isFinite)
  const maxPeriod = allNums.length > 0 ? Math.max(...allNums) : 1
  const periods = Array.from({ length: maxPeriod }, (_, i) => i + 1)

  const isWeekend = dayType === 'weekend'
  const badgeColor  = isWeekend ? '#D97706' : '#4338CA'
  const badgeBg     = isWeekend ? '#FEF3C7' : '#EEF2FF'

  return (
    <div style={{ marginBottom: '20px' }}>

      {/* 평일/주말 배지 */}
      <div style={{ marginBottom: '10px' }}>
        <span style={{
          display: 'inline-block',
          padding: '3px 14px', borderRadius: '999px',
          background: badgeBg, color: badgeColor,
          fontSize: '12px', fontWeight: 800,
        }}>
          {isWeekend ? '📅 주말' : '🗓️ 평일'}
        </span>
      </div>

      {/* 테이블 */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{
          borderCollapse: 'collapse',
          width: '100%',
          minWidth: `${sectionDays.length * 68 + 88}px`,
          fontSize: '13px',
        }}>
          <thead>
            <tr>
              {/* 시간 열 헤더 */}
              <th style={{
                padding: '10px 14px',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                fontSize: '11px', fontWeight: 700, color: '#94A3B8',
                width: '88px', minWidth: '88px', textAlign: 'center',
              }}>시간</th>

              {/* 요일 열 헤더 */}
              {sectionDays.map(day => {
                const isSun = day.label === '일'
                const isSat = day.label === '토'
                const color = isSun ? '#EF4444' : isSat ? '#D97706' : '#374151'
                return (
                  <th key={day.slotsKey} style={{
                    padding: '10px 8px',
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    fontSize: '14px', fontWeight: 800,
                    textAlign: 'center', minWidth: '68px', color,
                  }}>
                    {day.label}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {periods.map(period => (
              <tr key={period}>
                {/* ✅ 시간 라벨: 평일/주말 구분 적용 */}
                <td style={{
                  padding: '9px 14px',
                  border: '1px solid #E2E8F0',
                  background: '#F8FAFC',
                  fontSize: '12px', fontWeight: 600, color: '#64748B',
                  whiteSpace: 'nowrap', textAlign: 'center',
                }}>
                  {getTimeLabel(timeConfig, dayType, period)}
                </td>

                {/* 요일별 셀 */}
                {sectionDays.map(day => {
                  const span = dayGroups[day.slotsKey]?.[period]

                  // span === 0 → 위 rowspan에 포함됨 → null 반환 (셀 렌더링 안 함)
                  if (span === 0) return null

                  // span > 0 → 연속 블록의 시작 → 등원 셀 (주황색)
                  if (span > 0) {
                    return (
                      <td
                        key={day.slotsKey}
                        rowSpan={span}
                        style={{
                          border: '2px solid #FDBA74',
                          background: 'linear-gradient(135deg, #FED7AA, #FDBA74)',
                          textAlign: 'center',
                          verticalAlign: 'middle',
                          fontWeight: 800,
                          fontSize: '15px',
                          color: '#92400E',
                          letterSpacing: '-0.02em',
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)',
                          position: 'relative',
                        }}
                      >
                        등원
                      </td>
                    )
                  }

                  // 빈 셀
                  return (
                    <td key={day.slotsKey} style={{
                      border: '1px solid #E2E8F0',
                      background: '#fff',
                    }} />
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {/* 모바일 스크롤 안내 */}
        <p style={{ fontSize: '11px', color: '#CBD5E1', textAlign: 'center', marginTop: '8px' }}>
          ← 표를 좌우로 스크롤할 수 있어요 →
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
//  멤버십 색상
// ─────────────────────────────────────────────────────────
const MEMBERSHIP_COLOR = {
  '풀':   { bg: '#ECFDF5', color: '#059669' },
  '평일': { bg: '#EEF2FF', color: '#4F46E5' },
  '주말': { bg: '#FFF7ED', color: '#D97706' },
}

// ─────────────────────────────────────────────────────────
//  공개 시간표 뷰 컴포넌트
// ─────────────────────────────────────────────────────────
export default function PublicScheduleView() {
  const [searchParams] = useSearchParams()

  // URL의 ?data= 파라미터를 디코딩
  const data = useMemo(() => {
    try {
      const raw = searchParams.get('data')
      if (!raw) return null
      return JSON.parse(decodeURIComponent(atob(raw)))
    } catch {
      return null
    }
  }, [searchParams])

  // 잘못된 링크인 경우
  if (!data) {
    return (
      <div style={{
        minHeight: '100vh', background: '#F8FAFC',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif',
      }}>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ fontSize: '52px', marginBottom: '16px' }}>⚠️</p>
          <p style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A' }}>잘못된 링크예요</p>
          <p style={{ fontSize: '14px', color: '#64748B', marginTop: '8px' }}>
            SMC 스터디카페에 문의해주세요
          </p>
        </div>
      </div>
    )
  }

  const timeConfig = data.timeConfig || {}
  const slots = data.slots || {}

  // ✅ 평일/주말 요일 분리
  const allActiveDays = DAY_KEYS.filter(day => {
    const s = slots[day.slotsKey]
    return Array.isArray(s) && s.length > 0
  })
  const weekdayActiveDays = allActiveDays.filter(d => d.type === 'weekday')
  const weekendActiveDays = allActiveDays.filter(d => d.type === 'weekend')

  // 총 등원 교시 수
  const totalPeriods = Object.values(slots).reduce((s, arr) => s + (arr?.length || 0), 0)

  const ms = MEMBERSHIP_COLOR[data.membership] || { bg: '#F1F5F9', color: '#475569' }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0F172A 0%, #1E293B 40%, #F1F5F9 40%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Pretendard", sans-serif',
    }}>

      {/* ── 상단 헤더 ── */}
      <div style={{ padding: '32px 24px 24px', textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '10px',
          background: 'rgba(255,255,255,0.08)', borderRadius: '999px',
          padding: '6px 18px 6px 12px', marginBottom: '6px',
        }}>
          <span style={{ fontSize: '18px' }}>📚</span>
          <span style={{ color: '#E2E8F0', fontWeight: 700, fontSize: '15px', letterSpacing: '-0.01em' }}>
            SMC 스터디카페
          </span>
        </div>
        <p style={{ color: '#64748B', fontSize: '13px', marginTop: '4px' }}>
          등원 스케줄 안내
        </p>
      </div>

      {/* ── 컨텐츠 영역 ── */}
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '0 16px 48px' }}>

        {/* 학생 정보 카드 */}
        <div style={{
          background: '#fff', borderRadius: '20px', padding: '22px 24px',
          marginBottom: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          border: '1px solid rgba(255,255,255,0.9)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <p style={{ fontSize: '26px', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
                {data.name}
              </p>
              <p style={{ fontSize: '13px', color: '#64748B', marginTop: '5px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {data.grade && <span>{data.grade}</span>}
                {data.grade && data.seat && <span style={{ color: '#CBD5E1' }}>·</span>}
                {data.seat && <span>좌석 {data.seat}번</span>}
                {(data.grade || data.seat) && <span style={{ color: '#CBD5E1' }}>·</span>}
                <span>주 <strong style={{ color: '#4F46E5' }}>{totalPeriods}</strong>교시</span>
              </p>
            </div>
            {data.membership && (
              <span style={{
                padding: '6px 18px', borderRadius: '999px', fontSize: '13px', fontWeight: 700,
                background: ms.bg, color: ms.color, flexShrink: 0,
              }}>{data.membership} 멤버십</span>
            )}
          </div>
        </div>

        {/* 시간표 카드 */}
        <div style={{
          background: '#fff', borderRadius: '20px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          border: '1px solid rgba(255,255,255,0.9)',
          overflow: 'hidden',
        }}>

          {/* 카드 헤더 */}
          <div style={{
            padding: '18px 24px 14px',
            borderBottom: '1px solid #F1F5F9',
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <div style={{
              width: '34px', height: '34px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #6366F1, #7C3AED)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px', flexShrink: 0,
            }}>📅</div>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', margin: 0 }}>주간 등원 시간표</p>
              <p style={{ fontSize: '12px', color: '#94A3B8', margin: '2px 0 0' }}>
                오렌지 칸이 등원하는 시간이에요
              </p>
            </div>
          </div>

          {/* ✅ 시간표 테이블 (평일/주말 섹션 분리) */}
          <div style={{ padding: '16px 20px 24px' }}>
            {allActiveDays.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#94A3B8' }}>
                <p style={{ fontSize: '36px' }}>📭</p>
                <p style={{ fontSize: '14px', marginTop: '8px' }}>등록된 스케줄이 없어요</p>
              </div>
            ) : (
              <>
                {/* 평일 섹션 */}
                <ScheduleTable
                  sectionDays={weekdayActiveDays}
                  slots={slots}
                  timeConfig={timeConfig}
                  dayType="weekday"
                />

                {/* 주말 섹션 */}
                <ScheduleTable
                  sectionDays={weekendActiveDays}
                  slots={slots}
                  timeConfig={timeConfig}
                  dayType="weekend"
                />
              </>
            )}
          </div>
        </div>

        {/* 푸터 */}
        <div style={{
          textAlign: 'center', marginTop: '24px',
          padding: '16px', borderRadius: '14px',
          background: 'rgba(255,255,255,0.6)',
        }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#475569', margin: 0 }}>
            📌 SMC 스터디카페
          </p>
          <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>
            문의사항은 원으로 연락 주세요 😊
          </p>
        </div>
      </div>
    </div>
  )
}
