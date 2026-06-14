// ================================================================
// 📁 api/schedule-image.js
// Node.js 런타임용 - 이미지를 직접 전송하는 방식
// ================================================================

import { ImageResponse } from '@vercel/og'

// edge 설정 제거 → Node.js 런타임으로 동작
// (Vercel이 자동으로 Node.js 선택했으므로 맞춰줌)

const DAY_KEYS = [
  { key: 'mon_slots', label: '월', weekend: false },
  { key: 'tue_slots', label: '화', weekend: false },
  { key: 'wed_slots', label: '수', weekend: false },
  { key: 'thu_slots', label: '목', weekend: false },
  { key: 'fri_slots', label: '금', weekend: false },
  { key: 'sat_slots', label: '토', weekend: true  },
  { key: 'sun_slots', label: '일', weekend: true  },
]

const MS_COLOR = {
  '풀':   { bg: '#DCFCE7', color: '#15803D' },
  '평일': { bg: '#EEF2FF', color: '#4338CA' },
  '주말': { bg: '#FEF3C7', color: '#B45309' },
}

// JSX 없이 화면 구성하는 헬퍼
const h = (type, props, ...children) => {
  const flat = children.flat().filter(c => c !== null && c !== undefined && c !== false && c !== '')
  return {
    type,
    key: null,
    props: {
      ...props,
      children: flat.length === 0 ? undefined
               : flat.length === 1 ? flat[0]
               : flat,
    },
  }
}

async function loadFont() {
  try {
    const [kor, lat] = await Promise.all([
      fetch('https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-kr@5.0.22/files/noto-sans-kr-korean-400-normal.woff').then(r => r.arrayBuffer()),
      fetch('https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-kr@5.0.22/files/noto-sans-kr-latin-400-normal.woff').then(r => r.arrayBuffer()),
    ])
    return [
      { name: 'NotoKR', data: kor, weight: 400, style: 'normal' },
      { name: 'NotoKR', data: lat, weight: 400, style: 'normal' },
    ]
  } catch (e) {
    console.error('폰트 로드 실패:', e.message)
    return []
  }
}

// ── Node.js 방식 핸들러: (req, res) 형태 ──
export default async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host}`)
  const raw = url.searchParams.get('data')

  if (!raw) {
    res.status(400).send('data 파라미터가 없어요')
    return
  }

  let data
  try {
    data = JSON.parse(decodeURIComponent(atob(raw)))
  } catch {
    res.status(400).send('잘못된 링크입니다')
    return
  }

  try {
    const fonts = await loadFont()

    const {
      name       = '학생',
      grade      = '',
      seat       = '',
      membership = '',
      slots      = {},
      timeConfig = {},
    } = data

    const activeDays = DAY_KEYS.filter(d => Array.isArray(slots[d.key]) && slots[d.key].length > 0)
    const allNums    = Object.values(slots).flat().filter(n => Number.isFinite(n))
    const maxPeriod  = allNums.length > 0 ? Math.max(...allNums) : 5
    const periods    = Array.from({ length: maxPeriod }, (_, i) => i + 1)
    const total      = allNums.length
    const ms         = MS_COLOR[membership] || { bg: '#F1F5F9', color: '#475569' }

    const now  = new Date()
    const date = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')} 기준`

    const W     = 800
    const PAD   = 32
    const COL_T = 112
    const nDays = Math.max(activeDays.length, 1)
    const COL_D = Math.floor((W - PAD * 2 - COL_T) / nDays)
    const ROW_H = 52
    const H     = 96 + 16 + 100 + 56 + (periods.length + 1) * ROW_H + 80

    const element = h('div', {
      style: {
        width: W, height: H,
        display: 'flex', flexDirection: 'column',
        background: '#EFF6FF',
        fontFamily: fonts.length > 0 ? 'NotoKR, sans-serif' : 'sans-serif',
      },
    },
      // 헤더
      h('div', {
        style: { display: 'flex', flexDirection: 'column', justifyContent: 'center', height: 96, padding: '0 40px', background: '#0F172A' },
      },
        h('div', { style: { color: '#94A3B8', fontSize: 13, marginBottom: 5 } }, 'SMC 스터디카페'),
        h('div', { style: { color: '#FFFFFF', fontSize: 22, fontWeight: 700 } }, '등원 스케줄 안내'),
      ),

      // 학생 카드
      h('div', {
        style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 100, margin: `16px ${PAD}px 0`, padding: '0 24px', background: '#FFFFFF', borderRadius: 18 },
      },
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: 7 } },
          h('div', { style: { fontSize: 30, fontWeight: 900, color: '#0F172A', lineHeight: 1 } }, name),
          h('div', { style: { display: 'flex', gap: 10, fontSize: 14, color: '#64748B' } },
            grade ? h('span', null, grade) : null,
            seat  ? h('span', null, `좌석 ${seat}번`) : null,
            h('span', { style: { color: '#6366F1', fontWeight: 700 } }, `주 ${total}교시`),
          ),
        ),
        membership ? h('div', {
          style: { padding: '8px 20px', borderRadius: 999, background: ms.bg, color: ms.color, fontSize: 14, fontWeight: 700 },
        }, `${membership} 멤버십`) : null,
      ),

      // 섹션 타이틀
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, height: 56, padding: `0 ${PAD + 8}px` } },
        h('div', { style: { fontSize: 16, fontWeight: 700, color: '#1E293B' } }, '주간 등원 시간표'),
        h('div', { style: { padding: '3px 10px', borderRadius: 999, background: '#FED7AA', color: '#92400E', fontSize: 11, fontWeight: 700 } }, '등원 = 주황색 칸'),
      ),

      // 시간표 그리드
      h('div', { style: { display: 'flex', flexDirection: 'column', margin: `0 ${PAD}px`, background: '#FFFFFF', borderRadius: 18, overflow: 'hidden' } },
        // 요일 헤더
        h('div', { style: { display: 'flex', background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' } },
          h('div', { style: { width: COL_T, height: ROW_H, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#94A3B8', borderRight: '1px solid #E2E8F0' } }, '시간'),
          ...activeDays.map((day, i) =>
            h('div', { key: day.key, style: { width: COL_D, height: ROW_H, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: day.label === '일' ? '#EF4444' : day.weekend ? '#D97706' : '#1E293B', borderRight: i < activeDays.length - 1 ? '1px solid #E2E8F0' : 'none' } }, day.label)
          ),
        ),
        // 교시 행
        ...periods.map((period, ri) =>
          h('div', { key: `row-${period}`, style: { display: 'flex', borderBottom: ri < periods.length - 1 ? '1px solid #F1F5F9' : 'none' } },
            h('div', { style: { width: COL_T, height: ROW_H, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', fontSize: 11, color: '#64748B', borderRight: '1px solid #E2E8F0', textAlign: 'center', padding: '0 4px' } }, timeConfig[period] || `${period}교시`),
            ...activeDays.map((day, ci) => {
              const on = Array.isArray(slots[day.key]) && slots[day.key].includes(period)
              return h('div', { key: `${day.key}-${period}`, style: { width: COL_D, height: ROW_H, display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? '#FED7AA' : '#FFFFFF', fontSize: 13, fontWeight: on ? 800 : 400, color: on ? '#92400E' : '#E2E8F0', borderRight: ci < activeDays.length - 1 ? '1px solid #F1F5F9' : 'none' } }, on ? '등원' : '-')
            }),
          )
        ),
      ),

      // 푸터
      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 60, padding: `0 ${PAD + 8}px`, marginTop: 20 } },
        h('div', { style: { fontSize: 12, color: '#94A3B8' } }, '문의사항은 원으로 연락 주세요'),
        h('div', { style: { fontSize: 11, color: '#CBD5E1' } }, date),
      ),
    )

    // ✅ Node.js 방식: ImageResponse를 버퍼로 변환 후 직접 전송
    const imageResponse = new ImageResponse(element, { width: W, height: H, fonts })
    const buffer = await imageResponse.arrayBuffer()

    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.end(Buffer.from(buffer))

  } catch (err) {
    console.error('이미지 생성 오류:', err)
    res.status(500).send(`오류: ${err.message}`)
  }
}