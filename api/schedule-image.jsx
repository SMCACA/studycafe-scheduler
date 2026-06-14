// ================================================================
// 📁 api/schedule-image.jsx
// ================================================================
// 학생 시간표를 PNG 이미지로 생성하는 Vercel Edge 함수예요.
// 마치 "즉석 사진관"처럼, URL로 요청이 오면 시간표 이미지를
// 실시간으로 만들어서 PNG 파일로 돌려줘요.
//
// 사용법: https://your-app.vercel.app/api/schedule-image?data=BASE64
// ================================================================

import { ImageResponse } from '@vercel/og'

// Edge Runtime 사용 (이미지 생성에 최적화된 서버 환경)
export const config = { runtime: 'edge' }

// ── 요일 정보 ──
const DAY_KEYS = [
  { key: 'mon_slots', label: '월', weekend: false },
  { key: 'tue_slots', label: '화', weekend: false },
  { key: 'wed_slots', label: '수', weekend: false },
  { key: 'thu_slots', label: '목', weekend: false },
  { key: 'fri_slots', label: '금', weekend: false },
  { key: 'sat_slots', label: '토', weekend: true  },
  { key: 'sun_slots', label: '일', weekend: true  },
]

// ── 멤버십별 색상 ──
const MS_COLOR = {
  '풀':   { bg: '#DCFCE7', color: '#15803D' },
  '평일': { bg: '#EEF2FF', color: '#4338CA' },
  '주말': { bg: '#FEF3C7', color: '#B45309' },
}

// ── 한국어 폰트 로드 (CDN에서 가져오기) ──
async function loadFont() {
  try {
    // 한국어 글꼴 (noto-sans-kr) - jsDelivr CDN
    const [kor, lat] = await Promise.all([
      fetch('https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-kr@5.0.22/files/noto-sans-kr-korean-400-normal.woff')
        .then(r => r.arrayBuffer()),
      fetch('https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-kr@5.0.22/files/noto-sans-kr-latin-400-normal.woff')
        .then(r => r.arrayBuffer()),
    ])
    return [
      { name: 'NotoKR', data: kor, weight: 400, style: 'normal' },
      { name: 'NotoKR', data: lat, weight: 400, style: 'normal' },
    ]
  } catch (e) {
    console.error('폰트 로드 실패 (한국어 글자가 깨질 수 있어요):', e.message)
    return []  // 폰트 없이 fallback
  }
}

// ── 메인 핸들러 ──
export default async function handler(req) {
  const { searchParams } = new URL(req.url)
  const raw = searchParams.get('data')

  // 1. URL 파라미터에서 학생 데이터 디코딩
  let data
  try {
    data = JSON.parse(decodeURIComponent(atob(raw)))
  } catch {
    return new Response('잘못된 링크입니다', { status: 400 })
  }

  // 2. 폰트 로드
  const fonts = await loadFont()

  // 3. 데이터 파싱
  const {
    name       = '학생',
    grade      = '',
    seat       = '',
    membership = '',
    slots      = {},
    timeConfig = {},
  } = data

  // 등원하는 요일만 필터링
  const activeDays = DAY_KEYS.filter(d =>
    Array.isArray(slots[d.key]) && slots[d.key].length > 0
  )

  // 전체 교시 범위 계산
  const allNums   = Object.values(slots).flat().filter(n => Number.isFinite(n))
  const maxPeriod = allNums.length > 0 ? Math.max(...allNums) : 5
  const periods   = Array.from({ length: maxPeriod }, (_, i) => i + 1)

  // 총 등원 교시
  const total = allNums.length

  // 멤버십 색상
  const ms = MS_COLOR[membership] || { bg: '#F1F5F9', color: '#475569' }

  // 오늘 날짜
  const now  = new Date()
  const date = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')} 기준`

  // ── 이미지 레이아웃 치수 계산 ──
  const W      = 800               // 이미지 너비 (고정)
  const PAD    = 32                // 좌우 여백
  const COL_T  = 112               // 시간 열 너비
  const nDays  = Math.max(activeDays.length, 1)
  const COL_D  = Math.floor((W - PAD * 2 - COL_T) / nDays)  // 요일 열 너비 (자동 분배)
  const ROW_H  = 52                // 각 교시 행 높이

  // 전체 이미지 높이 계산
  //   헤더(96) + 학생카드(마진16+높이100) + 섹션(56) + 표(헤더+교시행들) + 푸터(60)
  const H = 96 + 16 + 100 + 56 + (periods.length + 1) * ROW_H + 60 + 20

  // ── 이미지 생성 ──
  return new ImageResponse(
    (
      <div
        style={{
          width: W, height: H,
          display: 'flex', flexDirection: 'column',
          background: '#EFF6FF',
          fontFamily: fonts.length > 0 ? 'NotoKR, sans-serif' : 'sans-serif',
        }}
      >

        {/* ═══════════════════════════════════════ */}
        {/* 헤더 (상단 네이비 배경)                  */}
        {/* ═══════════════════════════════════════ */}
        <div
          style={{
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            height: 96, padding: '0 40px',
            background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 100%)',
          }}
        >
          <div style={{ color: '#94A3B8', fontSize: 13, marginBottom: 5 }}>
            📚 SMC 스터디카페
          </div>
          <div style={{ color: '#FFFFFF', fontSize: 22, fontWeight: 700 }}>
            등원 스케줄 안내
          </div>
        </div>

        {/* ═══════════════════════════════════════ */}
        {/* 학생 정보 카드                           */}
        {/* ═══════════════════════════════════════ */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            height: 100,
            margin: `16px ${PAD}px 0`,
            padding: '0 24px',
            background: '#FFFFFF',
            borderRadius: 18,
            boxShadow: '0 4px 20px rgba(15,23,42,0.08)',
          }}
        >
          {/* 이름 + 정보 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ fontSize: 30, fontWeight: 900, color: '#0F172A', lineHeight: 1 }}>
              {name}
            </div>
            <div style={{ display: 'flex', gap: 10, fontSize: 14, color: '#64748B' }}>
              {grade && <span>{grade}</span>}
              {seat  && <span>좌석 {seat}번</span>}
              <span style={{ color: '#6366F1', fontWeight: 700 }}>주 {total}교시</span>
            </div>
          </div>

          {/* 멤버십 배지 */}
          {membership && (
            <div
              style={{
                padding: '8px 20px',
                borderRadius: 999,
                background: ms.bg, color: ms.color,
                fontSize: 14, fontWeight: 700,
              }}
            >
              {membership} 멤버십
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════ */}
        {/* 시간표 섹션 타이틀                       */}
        {/* ═══════════════════════════════════════ */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            height: 56, padding: `0 ${PAD + 8}px`,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1E293B' }}>
            📅 주간 등원 시간표
          </div>
          <div
            style={{
              padding: '3px 10px', borderRadius: 999,
              background: '#FED7AA', color: '#92400E',
              fontSize: 11, fontWeight: 700,
            }}
          >
            등원 = 주황색 칸
          </div>
        </div>

        {/* ═══════════════════════════════════════ */}
        {/* 시간표 그리드                            */}
        {/* ═══════════════════════════════════════ */}
        <div
          style={{
            display: 'flex', flexDirection: 'column',
            margin: `0 ${PAD}px`,
            background: '#FFFFFF',
            borderRadius: 18,
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(15,23,42,0.08)',
          }}
        >
          {/* ── 헤더 행 (요일 표시) ── */}
          <div
            style={{
              display: 'flex',
              background: '#F8FAFC',
              borderBottom: '2px solid #E2E8F0',
            }}
          >
            {/* 시간 열 헤더 */}
            <div
              style={{
                width: COL_T, height: ROW_H,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#94A3B8',
                borderRight: '1px solid #E2E8F0',
              }}
            >
              시간
            </div>
            {/* 요일 헤더 */}
            {activeDays.map((day, i) => (
              <div
                key={day.key}
                style={{
                  width: COL_D, height: ROW_H,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 800,
                  color: day.label === '일' ? '#EF4444'
                       : day.weekend        ? '#D97706'
                       :                      '#1E293B',
                  borderRight: i < activeDays.length - 1 ? '1px solid #E2E8F0' : 'none',
                }}
              >
                {day.label}
              </div>
            ))}
          </div>

          {/* ── 교시별 행 ── */}
          {periods.map((period, ri) => (
            <div
              key={period}
              style={{
                display: 'flex',
                borderBottom: ri < periods.length - 1 ? '1px solid #F1F5F9' : 'none',
              }}
            >
              {/* 시간 라벨 */}
              <div
                style={{
                  width: COL_T, height: ROW_H,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: '#F8FAFC',
                  fontSize: 11, color: '#64748B',
                  borderRight: '1px solid #E2E8F0',
                  textAlign: 'center',
                  padding: '0 4px',
                }}
              >
                {timeConfig[period] || `${period}교시`}
              </div>

              {/* 요일별 등원 셀 */}
              {activeDays.map((day, ci) => {
                const on = Array.isArray(slots[day.key]) && slots[day.key].includes(period)
                return (
                  <div
                    key={day.key}
                    style={{
                      width: COL_D, height: ROW_H,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: on ? '#FED7AA' : '#FFFFFF',
                      fontSize: 13, fontWeight: on ? 800 : 400,
                      color: on ? '#92400E' : '#E2E8F0',
                      borderRight: ci < activeDays.length - 1 ? '1px solid #F1F5F9' : 'none',
                    }}
                  >
                    {on ? '등원' : '—'}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* ═══════════════════════════════════════ */}
        {/* 푸터                                    */}
        {/* ═══════════════════════════════════════ */}
        <div
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            height: 60, padding: `0 ${PAD + 8}px`,
          }}
        >
          <div style={{ fontSize: 12, color: '#94A3B8' }}>
            📌 문의사항은 원으로 연락 주세요
          </div>
          <div style={{ fontSize: 11, color: '#CBD5E1' }}>
            {date}
          </div>
        </div>

      </div>
    ),
    {
      width:  W,
      height: H,
      fonts,
    }
  )
}
