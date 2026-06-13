import { useState, useEffect, useMemo } from 'react'
import Layout from '../components/Layout'
import { createClient } from '@supabase/supabase-js'
import { X, Trash2, Settings, CalendarDays, Users } from 'lucide-react'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

const DAY_KEYS = [
  { key: 'mon_slots', label: '월', cfgKey: 'mon', type: 'weekday' },
  { key: 'tue_slots', label: '화', cfgKey: 'tue', type: 'weekday' },
  { key: 'wed_slots', label: '수', cfgKey: 'wed', type: 'weekday' },
  { key: 'thu_slots', label: '목', cfgKey: 'thu', type: 'weekday' },
  { key: 'fri_slots', label: '금', cfgKey: 'fri', type: 'weekday' },
  { key: 'sat_slots', label: '토', cfgKey: 'sat', type: 'weekend' },
  { key: 'sun_slots', label: '일', cfgKey: 'sun', type: 'weekend' },
]

const DEFAULT_SLOT_CONFIG = { mon:5, tue:5, wed:5, thu:5, fri:5, sat:10, sun:10 }

const loadSlotConfig = () => {
  try {
    const s = localStorage.getItem('smc_slot_config')
    return s ? { ...DEFAULT_SLOT_CONFIG, ...JSON.parse(s) } : { ...DEFAULT_SLOT_CONFIG }
  } catch { return { ...DEFAULT_SLOT_CONFIG } }
}

const isDayAvailable = (membership, dayType) => {
  if (membership === '풀') return true
  if (membership === '평일' && dayType === 'weekday') return true
  if (membership === '주말' && dayType === 'weekend') return true
  return false
}

const EMPTY_FORM = {
  student_id:'', seat_number:'', membership_type:'풀',
  mon_slots:[], tue_slots:[], wed_slots:[],
  thu_slots:[], fri_slots:[], sat_slots:[], sun_slots:[],
}

// ── 멤버십 배지 색상 ──────────────────────────────────────
const MEMBERSHIP_STYLE = {
  풀:   { bg:'#ECFDF5', color:'#059669', border:'#A7F3D0' },
  평일: { bg:'#EEF2FF', color:'#4F46E5', border:'#C7D2FE' },
  주말: { bg:'#FFF7ED', color:'#D97706', border:'#FDE68A' },
}

export default function ScheduleManagement() {
  const [students,       setStudents]       = useState([])
  const [schedules,      setSchedules]      = useState([])
  const [loading,        setLoading]        = useState(false)
  const [isModalOpen,    setIsModalOpen]    = useState(false)
  const [editingSchedule,setEditingSchedule]= useState(null)
  const [selectedStudent,setSelectedStudent]= useState(null)
  const [form,           setForm]           = useState({ ...EMPTY_FORM })
  const [isConfigOpen,   setIsConfigOpen]   = useState(false)
  const [slotConfig,     setSlotConfig]     = useState(loadSlotConfig)
  const [tempConfig,     setTempConfig]     = useState(loadSlotConfig)
  const [toast,          setToast]          = useState(null)

  const dayConfig = useMemo(() =>
    DAY_KEYS.map(d => ({ ...d, slots: slotConfig[d.cfgKey] || 5 })), [slotConfig])

  const totalSlots = useMemo(() =>
    dayConfig.reduce((sum, d) => sum + d.slots, 0), [dayConfig])

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data: sts }, { data: schs }] = await Promise.all([
      supabase.from('students').select('*').order('name'),
      supabase.from('schedules').select('*'),
    ])
    if (sts)  setStudents(sts)
    if (schs) setSchedules(schs)
    setLoading(false)
  }

  const showToast = (msg, type='success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  const getSchedule = id => schedules.find(s => s.student_id === id) || null

  const handleRowClick = student => {
    const schedule = getSchedule(student.id)
    setSelectedStudent(student)
    if (schedule) {
      setEditingSchedule(schedule)
      setForm({
        student_id: student.id,
        seat_number: schedule.seat_number || student.seat_number || '',
        membership_type: schedule.membership_type || '풀',
        mon_slots: schedule.mon_slots || [], tue_slots: schedule.tue_slots || [],
        wed_slots: schedule.wed_slots || [], thu_slots: schedule.thu_slots || [],
        fri_slots: schedule.fri_slots || [], sat_slots: schedule.sat_slots || [],
        sun_slots: schedule.sun_slots || [],
      })
    } else {
      setEditingSchedule(null)
      setForm({ ...EMPTY_FORM, student_id: student.id, seat_number: student.seat_number || '' })
    }
    setIsModalOpen(true)
  }

  const toggleSlot = (dayKey, n) => {
    setForm(f => {
      const cur = f[dayKey] || []
      const next = cur.includes(n) ? cur.filter(s => s !== n) : [...cur, n].sort((a,b) => a-b)
      return { ...f, [dayKey]: next }
    })
  }

  const toggleAllDay = (dayKey, total) => {
    setForm(f => {
      const cur = f[dayKey] || []
      const all = Array.from({ length: total }, (_, i) => i + 1)
      return { ...f, [dayKey]: cur.length === total ? [] : all }
    })
  }

  const handleSave = async () => {
    const payload = {
      student_id: form.student_id, seat_number: form.seat_number,
      membership_type: form.membership_type,
      mon_slots: form.mon_slots, tue_slots: form.tue_slots,
      wed_slots: form.wed_slots, thu_slots: form.thu_slots,
      fri_slots: form.fri_slots, sat_slots: form.sat_slots,
      sun_slots: form.sun_slots,
    }
    let error
    if (editingSchedule) {
      ;({ error } = await supabase.from('schedules').update(payload).eq('id', editingSchedule.id))
      if (!error) showToast('스케줄이 수정됐어요 ✏️')
    } else {
      ;({ error } = await supabase.from('schedules').insert(payload))
      if (!error) showToast('스케줄이 추가됐어요 📅')
    }
    if (error) return showToast('저장 실패: ' + error.message, 'error')
    setIsModalOpen(false)
    fetchAll()
  }

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    if (!window.confirm('이 스케줄을 삭제할까요?')) return
    const { error } = await supabase.from('schedules').delete().eq('id', id)
    if (error) return showToast('삭제 실패', 'error')
    showToast('스케줄이 삭제됐어요 🗑️')
    fetchAll()
  }

  const saveConfig = () => {
    setSlotConfig({ ...tempConfig })
    localStorage.setItem('smc_slot_config', JSON.stringify(tempConfig))
    setIsConfigOpen(false)
    showToast('교시 설정이 저장됐어요 ⚙️')
  }

  const openConfig = () => { setTempConfig({ ...slotConfig }); setIsConfigOpen(true) }

  const adjustSlot = (cfgKey, delta) => {
    setTempConfig(c => ({ ...c, [cfgKey]: Math.min(20, Math.max(1, (c[cfgKey]||5)+delta)) }))
  }

  // ── 공통 th/td 테두리 스타일 ────────────────────────────
  const cellBorder = '1px solid #E2E8F0'

  return (
    <Layout>
      <div style={{ padding:'28px 32px' }}>

        {/* ── 페이지 헤더 ── */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'24px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
            <div style={{
              width:'46px', height:'46px', borderRadius:'14px',
              background:'#EEF2FF', display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <CalendarDays size={22} style={{ color:'#6366F1' }} />
            </div>
            <div>
              <h1 style={{ fontSize:'22px', fontWeight:700, color:'#0F172A', margin:0 }}>스케줄 관리</h1>
              <p style={{ fontSize:'13px', color:'#94A3B8', marginTop:'3px' }}>학생 행을 클릭하면 스케줄을 설정할 수 있어요</p>
            </div>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            {/* 통계 뱃지 */}
            <div style={{
              display:'flex', alignItems:'center', gap:'8px',
              padding:'8px 16px', borderRadius:'12px',
              background:'#fff', border:'1px solid #E2E8F0',
            }}>
              <Users size={14} style={{ color:'#94A3B8' }} />
              <span style={{ fontSize:'13px', color:'#64748B' }}>
                등록 <strong style={{ color:'#0F172A' }}>{schedules.length}</strong>
                {' / '}전체 <strong style={{ color:'#0F172A' }}>{students.length}</strong>명
              </span>
            </div>
            {/* 교시 설정 버튼 */}
            <button
              onClick={openConfig}
              style={{
                display:'flex', alignItems:'center', gap:'8px',
                padding:'10px 18px', borderRadius:'12px',
                background:'#fff', border:'1px solid #E2E8F0',
                fontSize:'13px', fontWeight:600, color:'#475569', cursor:'pointer',
                transition:'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='#6366F1'; e.currentTarget.style.color='#6366F1' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='#E2E8F0'; e.currentTarget.style.color='#475569' }}
            >
              <Settings size={15} /> 교시 설정
            </button>
          </div>
        </div>

        {/* ── 범례 ── */}
        <div style={{
          display:'flex', alignItems:'center', gap:'16px',
          marginBottom:'16px', padding:'10px 16px',
          background:'#fff', borderRadius:'12px', border:'1px solid #E2E8F0',
        }}>
          <span style={{ fontSize:'12px', color:'#94A3B8', fontWeight:600 }}>범례</span>
          {[
            { label:'출석 예정', bg:'#EEF2FF', color:'#6366F1', text:'○' },
            { label:'주말 출석', bg:'#FFF7ED', color:'#D97706', text:'○' },
          ].map(({ label, bg, color, text }) => (
            <span key={label} style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', color:'#64748B' }}>
              <span style={{
                width:'20px', height:'20px', borderRadius:'6px', background:bg,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:'12px', fontWeight:700, color,
              }}>{text}</span>
              {label}
            </span>
          ))}
          <span style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', color:'#64748B' }}>
            <span style={{
              width:'20px', height:'20px', borderRadius:'6px',
              background:'#1E293B', display:'flex', alignItems:'center',
              justifyContent:'center', fontSize:'9px', color:'#64748B', fontWeight:600,
            }}>✕</span>
            회원권 외 요일
          </span>
          <span style={{ marginLeft:'auto', fontSize:'12px', color:'#6366F1', fontWeight:600 }}>
            💡 행 클릭 → 스케줄 편집
          </span>
        </div>

        {/* ── 메인 테이블 ── */}
        {loading ? (
          <div style={{ textAlign:'center', padding:'64px 0', color:'#94A3B8', fontSize:'14px' }}>
            불러오는 중...
          </div>
        ) : (
          <div style={{
            background:'#fff', borderRadius:'16px',
            border:'1px solid #E2E8F0',
            boxShadow:'0 1px 4px rgba(0,0,0,0.04)',
            overflowX:'auto',
          }}>
            <table style={{
              width:'100%', borderCollapse:'collapse',
              fontSize:'12px', minWidth:'1000px',
            }}>

              {/* ── 헤드 1행: 요일 대헤더 ── */}
              <thead>
                <tr>
                  {/* 고정 컬럼 헤더들 */}
                  {[
                    { label:'구분',  w:60,  left:0   },
                    { label:'좌석',  w:48,  left:60  },
                    { label:'이름',  w:80,  left:108 },
                    { label:'학년',  w:56,  left:188 },
                  ].map(({ label, w, left }) => (
                    <th key={label} rowSpan={2} style={{
                      position:'sticky', left:`${left}px`, zIndex:20,
                      background:'#F8FAFC', minWidth:`${w}px`, width:`${w}px`,
                      border:cellBorder, padding:'10px 8px',
                      fontSize:'11px', fontWeight:700, color:'#64748B',
                      letterSpacing:'0.04em', textAlign:'center',
                      boxShadow: left === 188 ? '4px 0 8px rgba(0,0,0,0.06)' : 'none',
                    }}>{label}</th>
                  ))}

                  {/* 요일별 헤더 */}
                  {dayConfig.map(day => (
                    <th key={day.key} colSpan={day.slots} style={{
                      border:cellBorder, padding:'8px 4px',
                      textAlign:'center', fontSize:'12px', fontWeight:700,
                      background: day.type === 'weekend' ? '#FFF1F2' : '#EEF2FF',
                      color:       day.type === 'weekend' ? '#E11D48'  : '#4F46E5',
                    }}>
                      {day.label}요일
                      <span style={{ marginLeft:'4px', fontSize:'10px', fontWeight:400, opacity:0.65 }}>
                        ({day.slots}교시)
                      </span>
                    </th>
                  ))}

                  <th rowSpan={2} style={{
                    background:'#F8FAFC', border:cellBorder,
                    padding:'10px 8px', minWidth:'44px',
                    fontSize:'11px', fontWeight:700, color:'#94A3B8', letterSpacing:'0.04em',
                  }}>삭제</th>
                </tr>

                {/* ── 헤드 2행: 교시 번호 ── */}
                <tr>
                  {dayConfig.map(day =>
                    Array.from({ length: day.slots }, (_, i) => (
                      <th key={`${day.key}-${i}`} style={{
                        border:cellBorder, padding:'5px 2px',
                        textAlign:'center', width:'28px',
                        fontSize:'10px', fontWeight:500, color:'#94A3B8',
                        background: day.type === 'weekend' ? '#FFF8F8' : '#F5F8FF',
                      }}>
                        {i + 1}
                      </th>
                    ))
                  )}
                </tr>
              </thead>

              {/* ── 바디 ── */}
              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={4 + totalSlots + 1} style={{
                      textAlign:'center', padding:'64px 0',
                      color:'#94A3B8', fontSize:'14px', border:cellBorder,
                    }}>
                      등록된 학생이 없어요.<br />
                      먼저 학생 관리에서 학생을 추가해 주세요.
                    </td>
                  </tr>
                ) : (
                  students.map((student, rowIdx) => {
                    const schedule = getSchedule(student.id)
                    const rowBg = rowIdx % 2 === 0 ? '#fff' : '#FAFBFF'

                    return (
                      <tr
                        key={student.id}
                        onClick={() => handleRowClick(student)}
                        style={{ cursor:'pointer' }}
                        onMouseEnter={e => { e.currentTarget.style.background='#F0F4FF' }}
                        onMouseLeave={e => { e.currentTarget.style.background=rowBg }}
                      >

                        {/* 구분 (멤버십 배지) — sticky */}
                        <td style={{
                          position:'sticky', left:0, zIndex:10,
                          background:rowBg, border:cellBorder,
                          padding:'8px 6px', textAlign:'center',
                        }}>
                          {schedule ? (() => {
                            const s = MEMBERSHIP_STYLE[schedule.membership_type] || MEMBERSHIP_STYLE['풀']
                            return (
                              <span style={{
                                padding:'2px 8px', borderRadius:'999px', fontSize:'10px', fontWeight:700,
                                background:s.bg, color:s.color, border:`1px solid ${s.border}`,
                                whiteSpace:'nowrap',
                              }}>
                                {schedule.membership_type}
                              </span>
                            )
                          })() : (
                            <span style={{ fontSize:'10px', color:'#6366F1', fontWeight:600, textDecoration:'underline', textDecorationStyle:'dotted' }}>
                              클릭
                            </span>
                          )}
                        </td>

                        {/* 좌석 — sticky */}
                        <td style={{
                          position:'sticky', left:60, zIndex:10,
                          background:rowBg, border:cellBorder,
                          padding:'8px 6px', textAlign:'center',
                          fontWeight:700, fontSize:'13px', color:'#374151', fontFamily:'monospace',
                        }}>
                          {schedule?.seat_number
                            ? <span style={{
                                display:'inline-flex', alignItems:'center', justifyContent:'center',
                                width:'26px', height:'26px', borderRadius:'8px',
                                background:'#EEF2FF', color:'#6366F1', fontSize:'12px', fontWeight:700,
                              }}>{schedule.seat_number}</span>
                            : <span style={{ color:'#CBD5E1' }}>–</span>
                          }
                        </td>

                        {/* 이름 — sticky */}
                        <td style={{
                          position:'sticky', left:108, zIndex:10,
                          background:rowBg, border:cellBorder,
                          padding:'8px 10px', fontWeight:700, color:'#0F172A',
                          whiteSpace:'nowrap', fontSize:'13px',
                        }}>
                          {student.name}
                        </td>

                        {/* 학년 — sticky + 오른쪽 그림자 */}
                        <td style={{
                          position:'sticky', left:188, zIndex:10,
                          background:rowBg, border:cellBorder,
                          padding:'8px 8px', whiteSpace:'nowrap',
                          boxShadow:'4px 0 8px rgba(0,0,0,0.06)',
                        }}>
                          {student.grade && (
                            <span style={{
                              padding:'1px 8px', borderRadius:'999px', fontSize:'10px', fontWeight:700,
                              background: student.grade.startsWith('고') ? '#EEF2FF' : '#ECFDF5',
                              color:      student.grade.startsWith('고') ? '#4F46E5' : '#059669',
                            }}>
                              {student.grade}
                            </span>
                          )}
                        </td>

                        {/* 시간표 슬롯 */}
                        {schedule ? (
                          dayConfig.map(day => {
                            const avail = isDayAvailable(schedule.membership_type, day.type)
                            if (!avail) {
                              return (
                                <td key={day.key} colSpan={day.slots} style={{
                                  border:cellBorder, textAlign:'center',
                                  background:'#1E293B', height:'36px',
                                }}>
                                  <span style={{ fontSize:'9px', color:'#475569', fontWeight:600, letterSpacing:'0.05em' }}>✕</span>
                                </td>
                              )
                            }
                            return Array.from({ length: day.slots }, (_, i) => {
                              const n = i + 1
                              const active = (schedule[day.key] || []).includes(n)
                              return (
                                <td key={`${day.key}-${n}`} style={{
                                  border:cellBorder, textAlign:'center', width:'28px', height:'36px',
                                  background: active
                                    ? (day.type === 'weekend' ? '#FFF7ED' : '#EEF2FF')
                                    : 'transparent',
                                  verticalAlign:'middle',
                                }}>
                                  {active && (
                                    <span style={{
                                      display:'inline-flex', alignItems:'center', justifyContent:'center',
                                      width:'18px', height:'18px', borderRadius:'50%',
                                      background: day.type === 'weekend' ? '#F59E0B' : '#6366F1',
                                      fontSize:'9px', fontWeight:900, color:'#fff',
                                    }}>●</span>
                                  )}
                                </td>
                              )
                            })
                          })
                        ) : (
                          dayConfig.flatMap(day =>
                            Array.from({ length: day.slots }, (_, i) => (
                              <td key={`${day.key}-e-${i}`} style={{
                                border:cellBorder, width:'28px', height:'36px',
                                background: day.type === 'weekend' ? '#FFFBFA' : '#FAFBFF',
                              }} />
                            ))
                          )
                        )}

                        {/* 삭제 버튼 */}
                        <td style={{ border:cellBorder, textAlign:'center', padding:'4px' }}>
                          {schedule && (
                            <button
                              onClick={e => handleDelete(e, schedule.id)}
                              style={{
                                padding:'4px 6px', borderRadius:'8px', border:'none',
                                background:'transparent', cursor:'pointer',
                                color:'#FCA5A5', transition:'all 0.15s',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background='#FEF2F2'; e.currentTarget.style.color='#EF4444' }}
                              onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#FCA5A5' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════
          모달: 스케줄 추가/수정
      ═══════════════════════════════════════════ */}
      {isModalOpen && selectedStudent && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(15,23,42,0.55)',
          display:'flex', alignItems:'center', justifyContent:'center',
          zIndex:50, padding:'16px',
        }}>
          <div style={{
            background:'#fff', borderRadius:'24px', width:'100%', maxWidth:'560px',
            maxHeight:'90vh', overflowY:'auto',
            boxShadow:'0 20px 60px rgba(0,0,0,0.15)',
          }}>

            {/* 헤더 */}
            <div style={{
              position:'sticky', top:0, background:'#fff',
              borderBottom:'1px solid #F1F5F9', padding:'20px 24px 16px',
              display:'flex', justifyContent:'space-between', alignItems:'center',
              borderRadius:'24px 24px 0 0', zIndex:10,
            }}>
              <div>
                <h2 style={{ fontSize:'17px', fontWeight:700, color:'#0F172A', margin:0 }}>
                  {editingSchedule ? '✏️ 스케줄 수정' : '📅 스케줄 등록'}
                </h2>
                <p style={{ fontSize:'12px', color:'#94A3B8', marginTop:'2px' }}>
                  학생 정보는 학생 관리 페이지에서 수정 가능해요
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{
                  width:'32px', height:'32px', borderRadius:'10px', border:'none',
                  background:'#F1F5F9', cursor:'pointer', display:'flex',
                  alignItems:'center', justifyContent:'center', color:'#64748B',
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:'18px' }}>

              {/* 학생 정보 카드 */}
              <div style={{
                background:'#F8FAFF', borderRadius:'14px', padding:'16px',
                border:'1px solid #E0E7FF',
              }}>
                <p style={{ fontSize:'11px', fontWeight:700, color:'#6366F1', marginBottom:'12px', letterSpacing:'0.04em' }}>
                  👤 학생 정보
                </p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                  {[
                    { label:'이름',      val:selectedStudent.name,          big:true },
                    { label:'학년',      val:selectedStudent.grade || '–' },
                    { label:'학교',      val:selectedStudent.school || '–' },
                    { label:'학생 연락처', val:selectedStudent.student_phone || '–' },
                    { label:'학부모 연락처', val:selectedStudent.parent_phone || '–' },
                  ].map(({ label, val, big }) => (
                    <div key={label}>
                      <p style={{ fontSize:'10px', color:'#94A3B8', marginBottom:'2px' }}>{label}</p>
                      <p style={{ fontSize: big ? '16px' : '13px', fontWeight: big ? 700 : 500, color:'#0F172A' }}>{val}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 재원구분 + 좌석 */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px' }}>
                <div>
                  <label style={{ fontSize:'12px', fontWeight:700, color:'#374151', display:'block', marginBottom:'8px' }}>재원 구분</label>
                  <div style={{ display:'flex', gap:'6px' }}>
                    {['평일','주말','풀'].map(type => {
                      const active = form.membership_type === type
                      return (
                        <button key={type} type="button"
                          onClick={() => setForm(f => ({ ...f, membership_type: type }))}
                          style={{
                            flex:1, padding:'9px 4px', borderRadius:'10px', border:'none',
                            cursor:'pointer', fontSize:'13px', fontWeight:700, transition:'all 0.15s',
                            background: active ? '#6366F1' : '#F1F5F9',
                            color: active ? '#fff' : '#64748B',
                            boxShadow: active ? '0 4px 12px rgba(99,102,241,0.3)' : 'none',
                          }}
                        >
                          {type}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize:'12px', fontWeight:700, color:'#374151', display:'block', marginBottom:'8px' }}>좌석 번호</label>
                  <input
                    type="text" value={form.seat_number}
                    onChange={e => setForm(f => ({ ...f, seat_number: e.target.value }))}
                    placeholder="예: 5"
                    style={{
                      width:'100%', padding:'9px 12px', borderRadius:'10px',
                      border:'1.5px solid #E2E8F0', fontSize:'13px', outline:'none',
                      boxSizing:'border-box', color:'#0F172A',
                    }}
                    onFocus={e => { e.target.style.borderColor='#6366F1'; e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,0.1)' }}
                    onBlur={e => { e.target.style.borderColor='#E2E8F0'; e.target.style.boxShadow='none' }}
                  />
                </div>
              </div>

              {/* 교시 선택 */}
              <div>
                <label style={{ fontSize:'12px', fontWeight:700, color:'#374151', display:'block', marginBottom:'10px' }}>
                  교시 선택
                  <span style={{ fontSize:'11px', fontWeight:400, color:'#94A3B8', marginLeft:'8px' }}>
                    {form.membership_type === '평일' && '월~금 활성'}
                    {form.membership_type === '주말' && '토·일 활성'}
                    {form.membership_type === '풀'   && '전체 활성'}
                  </span>
                </label>
                <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                  {dayConfig.map(day => {
                    const avail = isDayAvailable(form.membership_type, day.type)
                    const cur   = form[day.key] || []
                    return (
                      <div key={day.key} style={{
                        borderRadius:'12px', padding:'12px 14px',
                        border:'1px solid #E2E8F0', background: avail ? '#fff' : '#F8FAFC',
                        opacity: avail ? 1 : 0.45, transition:'opacity 0.15s',
                      }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
                          <span style={{
                            fontSize:'13px', fontWeight:700,
                            color: !avail ? '#94A3B8' : day.type === 'weekend' ? '#E11D48' : '#0F172A',
                          }}>
                            {day.label}요일
                            <span style={{ fontSize:'11px', fontWeight:400, color:'#94A3B8', marginLeft:'6px' }}>({day.slots}교시)</span>
                          </span>
                          {avail && (
                            <button type="button"
                              onClick={() => toggleAllDay(day.key, day.slots)}
                              style={{ fontSize:'11px', color:'#6366F1', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}
                            >
                              {cur.length === day.slots ? '모두 해제' : '모두 선택'}
                            </button>
                          )}
                        </div>
                        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                          {Array.from({ length: day.slots }, (_, i) => {
                            const n = i + 1
                            const checked = cur.includes(n)
                            return (
                              <button key={n} type="button"
                                onClick={() => avail && toggleSlot(day.key, n)}
                                disabled={!avail}
                                style={{
                                  width:'36px', height:'36px', borderRadius:'10px',
                                  border: checked ? 'none' : '1.5px solid #E2E8F0',
                                  cursor: avail ? 'pointer' : 'not-allowed',
                                  fontSize:'13px', fontWeight:700, transition:'all 0.12s',
                                  background: checked ? '#6366F1' : '#F8FAFC',
                                  color: checked ? '#fff' : '#94A3B8',
                                  boxShadow: checked ? '0 3px 8px rgba(99,102,241,0.3)' : 'none',
                                  transform: checked ? 'scale(1.05)' : 'scale(1)',
                                }}
                              >
                                {n}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* 하단 버튼 */}
            <div style={{
              position:'sticky', bottom:0, background:'#fff',
              borderTop:'1px solid #F1F5F9', padding:'16px 24px',
              display:'flex', gap:'10px', borderRadius:'0 0 24px 24px',
            }}>
              <button onClick={() => setIsModalOpen(false)} style={{
                flex:1, padding:'12px', borderRadius:'12px', border:'1.5px solid #E2E8F0',
                background:'#fff', fontSize:'14px', fontWeight:600, color:'#64748B', cursor:'pointer',
              }}>취소</button>
              <button onClick={handleSave} style={{
                flex:1, padding:'12px', borderRadius:'12px', border:'none',
                background:'linear-gradient(135deg,#6366F1,#7C3AED)',
                fontSize:'14px', fontWeight:700, color:'#fff', cursor:'pointer',
                boxShadow:'0 4px 14px rgba(99,102,241,0.35)',
              }}>
                {editingSchedule ? '수정 완료' : '등록 완료'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          모달: 교시 수 설정
      ═══════════════════════════════════════════ */}
      {isConfigOpen && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(15,23,42,0.55)',
          display:'flex', alignItems:'center', justifyContent:'center',
          zIndex:50, padding:'16px',
        }}>
          <div style={{
            background:'#fff', borderRadius:'24px', width:'100%', maxWidth:'360px',
            boxShadow:'0 20px 60px rgba(0,0,0,0.15)',
          }}>
            <div style={{
              padding:'20px 24px 16px', borderBottom:'1px solid #F1F5F9',
              display:'flex', justifyContent:'space-between', alignItems:'center',
            }}>
              <div>
                <h2 style={{ fontSize:'16px', fontWeight:700, color:'#0F172A', margin:0 }}>⚙️ 교시 수 설정</h2>
                <p style={{ fontSize:'12px', color:'#94A3B8', marginTop:'2px' }}>요일별 교시 수를 자유롭게 설정하세요</p>
              </div>
              <button onClick={() => setIsConfigOpen(false)} style={{
                width:'32px', height:'32px', borderRadius:'10px', border:'none',
                background:'#F1F5F9', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                <X size={16} style={{ color:'#64748B' }} />
              </button>
            </div>

            <div style={{ padding:'20px 24px' }}>
              <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                {DAY_KEYS.map(day => (
                  <div key={day.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <span style={{
                      fontSize:'14px', fontWeight:700, width:'60px',
                      color: day.type === 'weekend' ? '#E11D48' : '#0F172A',
                    }}>
                      {day.label}요일
                    </span>
                    <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                      {['–', tempConfig[day.cfgKey]||5, '+'].map((v, i) => (
                        i === 1 ? (
                          <span key="val" style={{ width:'32px', textAlign:'center', fontWeight:700, fontSize:'16px', color:'#0F172A' }}>{v}</span>
                        ) : (
                          <button key={v} type="button"
                            onClick={() => adjustSlot(day.cfgKey, i === 0 ? -1 : 1)}
                            style={{
                              width:'32px', height:'32px', borderRadius:'8px',
                              border:'1.5px solid #E2E8F0', background:'#F8FAFC',
                              fontSize:'16px', fontWeight:700, color:'#64748B', cursor:'pointer',
                            }}
                          >{v}</button>
                        )
                      ))}
                      <span style={{ fontSize:'12px', color:'#94A3B8', width:'30px' }}>교시</span>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{
                marginTop:'16px', padding:'10px 14px', borderRadius:'12px',
                background:'#FFFBEB', border:'1px solid #FDE68A',
              }}>
                <p style={{ fontSize:'11px', color:'#92400E' }}>
                  ⚠️ 교시 수를 줄이면 기존 높은 번호 교시는 화면에서 보이지 않아요. (데이터는 유지됩니다)
                </p>
              </div>
            </div>

            <div style={{ padding:'0 24px 24px', display:'flex', gap:'10px' }}>
              <button onClick={() => setIsConfigOpen(false)} style={{
                flex:1, padding:'11px', borderRadius:'12px', border:'1.5px solid #E2E8F0',
                background:'#fff', fontSize:'14px', fontWeight:600, color:'#64748B', cursor:'pointer',
              }}>취소</button>
              <button onClick={saveConfig} style={{
                flex:1, padding:'11px', borderRadius:'12px', border:'none',
                background:'linear-gradient(135deg,#6366F1,#7C3AED)',
                fontSize:'14px', fontWeight:700, color:'#fff', cursor:'pointer',
              }}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 토스트 ── */}
      {toast && (
        <div style={{
          position:'fixed', bottom:'24px', right:'24px', zIndex:100,
          display:'flex', alignItems:'center', gap:'10px',
          padding:'12px 18px', borderRadius:'14px',
          background: toast.type === 'error' ? '#EF4444' : '#10B981',
          color:'#fff', fontSize:'13px', fontWeight:600,
          boxShadow:'0 8px 24px rgba(0,0,0,0.12)',
        }}>
          {toast.msg}
        </div>
      )}
    </Layout>
  )
}
