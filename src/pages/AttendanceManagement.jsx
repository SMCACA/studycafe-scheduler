import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import { createClient } from '@supabase/supabase-js'
import { ClipboardList, RefreshCw, Users, CheckCircle, Clock } from 'lucide-react'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

const DAY_SLOT_KEYS = ['sun_slots','mon_slots','tue_slots','wed_slots','thu_slots','fri_slots','sat_slots']

const getToday = () => new Date().toLocaleDateString('sv-SE')

const formatDateKr = (d) => {
  const date = new Date(d + 'T00:00:00')
  const days = ['일','월','화','수','목','금','토']
  return `${date.getFullYear()}년 ${date.getMonth()+1}월 ${date.getDate()}일 ${days[date.getDay()]}요일`
}

const ATTENDANCE_OPTIONS = ['등원예정','등원']
const ABSENCE_OPTIONS    = ['-','결석','하원','학원','식사']

// ── 공통 스타일 ──────────────────────────────────────────
const cell = { border:'1px solid #E2E8F0', padding:'10px 14px', verticalAlign:'middle' }
const stickyCell = (left) => ({
  ...cell, position:'sticky', left:`${left}px`, zIndex:10, background:'#fff',
})

export default function AttendanceManagement() {
  const [selectedDate, setSelectedDate] = useState(getToday())
  const [rows,         setRows]         = useState([])
  const [loading,      setLoading]      = useState(false)
  const [localText,    setLocalText]    = useState({})

  useEffect(() => { fetchAttendance(); setLocalText({}) }, [selectedDate])

  const fetchAttendance = async () => {
    setLoading(true)
    const dow     = new Date(selectedDate + 'T00:00:00').getDay()
    const slotKey = DAY_SLOT_KEYS[dow]

    const { data: schedules, error } = await supabase
      .from('schedules')
      .select('*, students(id,name,seat_number,school,grade)')

    if (error || !schedules) { setLoading(false); return }

    const allRows = []
    for (const sch of schedules) {
      const slots   = sch[slotKey]
      const student = sch.students
      if (!Array.isArray(slots) || slots.length === 0 || !student) continue
      for (const period of slots) {
        allRows.push({
          scheduleId: sch.id, studentId: student.id,
          studentName: student.name,
          seatNumber: student.seat_number ?? sch.seat_number ?? null,
          school: student.school, grade: student.grade, period,
        })
      }
    }

    const studentMinPeriod = {}
    for (const row of allRows) {
      if (!studentMinPeriod[row.studentId] || row.period < studentMinPeriod[row.studentId].period)
        studentMinPeriod[row.studentId] = row
    }
    const todayRows = Object.values(studentMinPeriod)
    todayRows.sort((a,b) => a.period !== b.period ? a.period-b.period : a.studentName.localeCompare(b.studentName))

    const { data: attData } = await supabase
      .from('attendance').select('*').eq('date', selectedDate)

    const attMap = {}
    if (attData) for (const a of attData) attMap[`${a.student_id}_${a.period}`] = a

    setRows(todayRows.map(row => ({ ...row, attendance: attMap[`${row.studentId}_${row.period}`] || null })))
    setLoading(false)
  }

  const stats = (() => {
    const total   = rows.length
    const present = rows.filter(r => r.attendance?.attendance_status==='등원' && r.attendance?.absence_status==='-').length
    return { total, present, absent: total-present }
  })()

  const upsertField = useCallback(async (row, field, value) => {
    const att = row.attendance
    const payload = {
      date: selectedDate, student_id: row.studentId, period: row.period,
      attendance_status: att?.attendance_status ?? '등원예정',
      absence_status:    att?.absence_status    ?? '-',
      absence_reason:    att?.absence_reason    ?? '',
      is_late:           att?.is_late           ?? false,
      late_reason:       att?.late_reason       ?? '',
      [field]: value,
    }
    if (att?.id) payload.id = att.id

    const { data } = await supabase
      .from('attendance')
      .upsert(payload, { onConflict: 'date,student_id,period' })
      .select().single()

    if (data) setRows(prev => prev.map(r =>
      r.studentId===row.studentId && r.period===row.period ? { ...r, attendance:data } : r
    ))
  }, [selectedDate])

  const handleTextChange = (studentId, period, field, value) => {
    const key = `${studentId}_${period}`
    setLocalText(prev => ({ ...prev, [key]: { ...(prev[key]||{}), [field]: value } }))
  }
  const handleTextBlur = (row, field, value) => upsertField(row, field, value)
  const textVal = (row, field) => {
    const key = `${row.studentId}_${row.period}`
    return localText[key]?.[field] !== undefined ? localText[key][field] : row.attendance?.[field] || ''
  }

  return (
    <Layout>
      <div style={{ padding:'28px 32px' }}>

        {/* ── 페이지 헤더 ── */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'24px', flexWrap:'wrap', gap:'16px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
            <div style={{ width:'46px', height:'46px', borderRadius:'14px', background:'#ECFDF5', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <ClipboardList size={22} style={{ color:'#059669' }} />
            </div>
            <div>
              <h1 style={{ fontSize:'22px', fontWeight:700, color:'#0F172A', margin:0 }}>등원 기록</h1>
              <p style={{ fontSize:'13px', color:'#94A3B8', marginTop:'3px' }}>{formatDateKr(selectedDate)}</p>
            </div>
          </div>

          {/* 우측 컨트롤 */}
          <div style={{ display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' }}>
            {/* 통계 카드 3개 */}
            {[
              { label:'등원 예정', value:stats.total,   icon:Users,        bg:'#EEF2FF', color:'#6366F1' },
              { label:'현재 있음', value:stats.present, icon:CheckCircle,  bg:'#ECFDF5', color:'#059669' },
              { label:'없음/예정', value:stats.absent,  icon:Clock,        bg:'#FEF2F2', color:'#EF4444' },
            ].map(({ label, value, icon:Icon, bg, color }) => (
              <div key={label} style={{
                display:'flex', alignItems:'center', gap:'10px',
                padding:'10px 16px', borderRadius:'12px',
                background:bg, border:`1px solid ${color}22`,
              }}>
                <Icon size={16} style={{ color }} />
                <div>
                  <p style={{ fontSize:'10px', color, fontWeight:600, margin:0 }}>{label}</p>
                  <p style={{ fontSize:'20px', fontWeight:700, color, margin:0, lineHeight:1.1 }}>{value}</p>
                </div>
              </div>
            ))}

            {/* 날짜 선택 */}
            <input
              type="date" value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              style={{
                border:'1.5px solid #E2E8F0', borderRadius:'10px',
                padding:'9px 12px', fontSize:'13px', outline:'none',
                color:'#0F172A', background:'#fff',
              }}
            />

            {/* 새로고침 */}
            <button
              onClick={fetchAttendance}
              style={{
                display:'flex', alignItems:'center', gap:'7px',
                padding:'9px 14px', borderRadius:'10px',
                border:'1.5px solid #E2E8F0', background:'#fff',
                fontSize:'13px', fontWeight:600, color:'#475569', cursor:'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='#6366F1'; e.currentTarget.style.color='#6366F1' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='#E2E8F0'; e.currentTarget.style.color='#475569' }}
            >
              <RefreshCw size={14} /> 새로고침
            </button>
          </div>
        </div>

        {/* ── 테이블 ── */}
        {loading ? (
          <div style={{ textAlign:'center', padding:'80px 0', color:'#94A3B8', fontSize:'14px' }}>불러오는 중...</div>
        ) : rows.length === 0 ? (
          <div style={{
            textAlign:'center', padding:'80px 0',
            background:'#fff', borderRadius:'16px', border:'1px solid #E2E8F0',
            color:'#94A3B8',
          }}>
            <p style={{ fontSize:'40px', marginBottom:'12px' }}>📭</p>
            <p style={{ fontWeight:600, color:'#64748B' }}>이 날은 등원 예정 학생이 없어요</p>
            <p style={{ fontSize:'13px', marginTop:'4px' }}>스케줄 관리에서 스케줄을 먼저 등록해주세요</p>
          </div>
        ) : (
          <div style={{
            background:'#fff', borderRadius:'16px',
            border:'1px solid #E2E8F0', overflowX:'auto',
            boxShadow:'0 1px 4px rgba(0,0,0,0.04)',
          }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
              <thead>
                <tr>
                  {[
                    '등원 예정 교시','이름','좌석번호','등원 현황','결석 현황','결석 사유','지각 여부','지각 사유'
                  ].map((h, i) => (
                    <th key={h} style={{
                      ...cell,
                      background:'#F8FAFC', fontSize:'11px', fontWeight:700,
                      color:'#64748B', letterSpacing:'0.04em', textAlign:'left',
                      whiteSpace:'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const att       = row.attendance
                  const isPresent = att?.attendance_status==='등원' && att?.absence_status==='-'
                  const isAbsent  = att?.absence_status && att.absence_status!=='-'
                  const rowBg     = isPresent ? '#F0FDF4' : isAbsent ? '#FEF2F2' : (idx%2===0 ? '#fff' : '#FAFBFF')

                  return (
                    <tr key={`${row.studentId}_${row.period}`}
                      style={{ background:rowBg, transition:'background 0.15s' }}>

                      {/* 교시 */}
                      <td style={{ ...cell, textAlign:'center' }}>
                        <span style={{
                          display:'inline-block', padding:'3px 12px', borderRadius:'999px',
                          background:'#EEF2FF', color:'#6366F1', fontSize:'11px', fontWeight:700,
                        }}>{row.period}교시</span>
                      </td>

                      {/* 이름 + 학년 */}
                      <td style={{ ...cell, whiteSpace:'nowrap' }}>
                        <span style={{ fontWeight:700, color:'#0F172A' }}>{row.studentName}</span>
                        {row.grade && (
                          <span style={{
                            marginLeft:'8px', padding:'1px 7px', borderRadius:'999px',
                            fontSize:'10px', fontWeight:700,
                            background: row.grade.startsWith('고') ? '#EEF2FF' : '#ECFDF5',
                            color:      row.grade.startsWith('고') ? '#4F46E5' : '#059669',
                          }}>{row.grade}</span>
                        )}
                      </td>

                      {/* 좌석번호 */}
                      <td style={{ ...cell, textAlign:'center' }}>
                        {row.seatNumber
                          ? <span style={{
                              display:'inline-flex', alignItems:'center', justifyContent:'center',
                              width:'28px', height:'28px', borderRadius:'8px',
                              background:'#EEF2FF', color:'#6366F1', fontSize:'12px', fontWeight:700,
                            }}>{row.seatNumber}</span>
                          : <span style={{ color:'#CBD5E1' }}>–</span>
                        }
                      </td>

                      {/* 등원 현황 */}
                      <td style={cell}>
                        <select
                          value={att?.attendance_status || '등원예정'}
                          onChange={e => upsertField(row, 'attendance_status', e.target.value)}
                          style={{
                            padding:'5px 10px', borderRadius:'8px', fontSize:'12px',
                            fontWeight:600, cursor:'pointer', outline:'none',
                            border: att?.attendance_status==='등원'
                              ? '1.5px solid #A5B4FC' : '1.5px solid #E2E8F0',
                            background: att?.attendance_status==='등원' ? '#EEF2FF' : '#F8FAFC',
                            color: att?.attendance_status==='등원' ? '#4F46E5' : '#64748B',
                          }}
                        >
                          {ATTENDANCE_OPTIONS.map(o => <option key={o}>{o}</option>)}
                        </select>
                      </td>

                      {/* 결석 현황 */}
                      <td style={cell}>
                        <select
                          value={att?.absence_status || '-'}
                          onChange={e => upsertField(row, 'absence_status', e.target.value)}
                          style={{
                            padding:'5px 10px', borderRadius:'8px', fontSize:'12px',
                            fontWeight:600, cursor:'pointer', outline:'none',
                            border: isAbsent ? '1.5px solid #FCA5A5' : '1.5px solid #E2E8F0',
                            background: isAbsent ? '#FEF2F2' : '#F8FAFC',
                            color: isAbsent ? '#EF4444' : '#64748B',
                          }}
                        >
                          {ABSENCE_OPTIONS.map(o => <option key={o}>{o}</option>)}
                        </select>
                      </td>

                      {/* 결석 사유 */}
                      <td style={cell}>
                        <input
                          type="text"
                          value={textVal(row, 'absence_reason')}
                          onChange={e => handleTextChange(row.studentId, row.period, 'absence_reason', e.target.value)}
                          onBlur={e  => handleTextBlur(row, 'absence_reason', e.target.value)}
                          placeholder="사유 입력"
                          style={{
                            padding:'5px 10px', borderRadius:'8px', fontSize:'12px',
                            border:'1.5px solid #E2E8F0', outline:'none', width:'100px',
                            background:'#F8FAFC', color:'#374151',
                          }}
                          onFocus={e => { e.target.style.borderColor='#6366F1'; e.target.style.background='#fff' }}
                          onBlur2={e => { e.target.style.borderColor='#E2E8F0'; e.target.style.background='#F8FAFC' }}
                        />
                      </td>

                      {/* 지각 여부 */}
                      <td style={cell}>
                        <select
                          value={att?.is_late ? '지각' : '정각'}
                          onChange={e => upsertField(row, 'is_late', e.target.value==='지각')}
                          style={{
                            padding:'5px 10px', borderRadius:'8px', fontSize:'12px',
                            fontWeight:600, cursor:'pointer', outline:'none',
                            border: att?.is_late ? '1.5px solid #FDE68A' : '1.5px solid #E2E8F0',
                            background: att?.is_late ? '#FFFBEB' : '#F8FAFC',
                            color: att?.is_late ? '#D97706' : '#64748B',
                          }}
                        >
                          <option>정각</option>
                          <option>지각</option>
                        </select>
                      </td>

                      {/* 지각 사유 */}
                      <td style={cell}>
                        <input
                          type="text"
                          value={textVal(row, 'late_reason')}
                          onChange={e => handleTextChange(row.studentId, row.period, 'late_reason', e.target.value)}
                          onBlur={e  => handleTextBlur(row, 'late_reason', e.target.value)}
                          placeholder="사유 입력"
                          style={{
                            padding:'5px 10px', borderRadius:'8px', fontSize:'12px',
                            border:'1.5px solid #E2E8F0', outline:'none', width:'100px',
                            background:'#F8FAFC', color:'#374151',
                          }}
                          onFocus={e => { e.target.style.borderColor='#6366F1'; e.target.style.background='#fff' }}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  )
}
