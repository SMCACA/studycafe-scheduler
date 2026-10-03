// ================================================================
// 📁 src/components/SlotPicker.jsx  (요일별 교시 선택 상자)
// ================================================================
// 비유: 요일별로 "몇 교시에 올지" 버튼을 눌러 고르는 출석 계획표예요.
//   - 신청서 화면(/apply)과 관리자 전환 창에서 같이 써요.
//   - 이용권(평일/주말/풀)에 따라 고를 수 있는 요일만 보여줘요.
//   - 각 버튼에 "1교시 · 오후 4시"처럼 실제 시간이 같이 보여서 고르기 쉬워요.
//   - "월요일과 똑같이 평일 전체 적용" 버튼으로 한 번에 채울 수 있어요.
// ================================================================

import { DAYS, isDayAllowed, timeLabel, DEFAULT_SLOT_CONFIG } from '../lib/applySchedule'

export default function SlotPicker({ membership, slots, onChange, slotConfig, timeConfig, error }) {
  const config = slotConfig || DEFAULT_SLOT_CONFIG
  const days = DAYS.filter(d => isDayAllowed(membership, d.type))

  if (!membership) {
    return (
      <div style={emptyBox}>먼저 위에서 <strong>이용권</strong>을 골라주세요</div>
    )
  }

  const countOf = d => config[d.cfgKey] ?? DEFAULT_SLOT_CONFIG[d.cfgKey]

  const toggle = (dayKey, n) => {
    const cur = slots[dayKey] || []
    const next = cur.includes(n) ? cur.filter(x => x !== n) : [...cur, n].sort((a, b) => a - b)
    onChange({ ...slots, [dayKey]: next })
  }

  const toggleAll = (d) => {
    const total = countOf(d)
    const cur = slots[d.key] || []
    const all = Array.from({ length: total }, (_, i) => i + 1)
    onChange({ ...slots, [d.key]: cur.length === total ? [] : all })
  }

  // 같은 종류(평일/주말) 요일에 똑같이 복사 — 그 요일에 없는 교시는 빼고 복사
  const copyToGroup = (src) => {
    const picked = slots[src.key] || []
    const next = { ...slots }
    days.filter(d => d.type === src.type && d.key !== src.key).forEach(d => {
      next[d.key] = picked.filter(n => n <= countOf(d))
    })
    onChange(next)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {membership === '평일' && <p style={hint}>평일권은 월~금만 선택할 수 있어요</p>}
      {membership === '주말' && <p style={hint}>주말권은 토·일만 선택할 수 있어요</p>}

      {days.map(d => {
        const cur = slots[d.key] || []
        const total = countOf(d)
        const sameGroup = days.filter(x => x.type === d.type)
        const isFirstOfGroup = sameGroup[0]?.key === d.key && sameGroup.length > 1
        const groupName = d.type === 'weekday' ? '평일' : '주말'

        return (
          <div key={d.key} style={{
            borderRadius: '12px', padding: '12px',
            border: '1px solid #E2E8F0', borderLeft: `4px solid ${d.color}`,
            background: cur.length ? d.bgLight : '#fff',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: d.color }}>
                {d.label}요일
                <span style={{ fontSize: '12px', fontWeight: 500, color: '#94A3B8', marginLeft: '6px' }}>
                  {cur.length ? `${cur.length}개 선택` : '안 와요'}
                </span>
              </span>
              <button type="button" onClick={() => toggleAll(d)} style={linkBtn(d.color)}>
                {cur.length === total ? '모두 해제' : '모두 선택'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(74px, 1fr))', gap: '6px' }}>
              {Array.from({ length: total }, (_, i) => {
                const n = i + 1
                const on = cur.includes(n)
                const t = timeLabel(timeConfig, d.type, n)
                return (
                  <button key={n} type="button" onClick={() => toggle(d.key, n)} style={{
                    padding: '7px 4px', borderRadius: '10px', cursor: 'pointer',
                    border: on ? `2px solid ${d.color}` : '1.5px solid #E2E8F0',
                    background: on ? d.color : '#F8FAFC',
                    color: on ? '#fff' : '#475569',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px',
                    transition: 'all 0.12s',
                  }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, opacity: 0.85 }}>{n}교시</span>
                    {t && <span style={{ fontSize: '12.5px', fontWeight: 700 }}>{t}</span>}
                  </button>
                )
              })}
            </div>

            {isFirstOfGroup && (
              <button type="button" onClick={() => copyToGroup(d)} disabled={cur.length === 0}
                style={{
                  marginTop: '10px', width: '100%', padding: '8px', borderRadius: '10px',
                  border: `1.5px dashed ${cur.length ? d.color : '#CBD5E1'}`,
                  background: '#fff', color: cur.length ? d.color : '#94A3B8',
                  fontSize: '12.5px', fontWeight: 700, cursor: cur.length ? 'pointer' : 'not-allowed',
                }}>
                ⬇ {d.label}요일과 똑같이 {groupName} 전체에 적용
              </button>
            )}
          </div>
        )
      })}

      {error && <p style={{ fontSize: '12px', color: '#EF4444', margin: 0 }}>{error}</p>}
    </div>
  )
}

const emptyBox = {
  padding: '18px', borderRadius: '12px', border: '1.5px dashed #CBD5E1',
  background: '#F8FAFC', color: '#94A3B8', fontSize: '13px', textAlign: 'center',
}
const hint = { fontSize: '12px', color: '#64748B', margin: 0 }
const linkBtn = color => ({
  fontSize: '12px', color, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, padding: 0,
})
