import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import { createClient } from '@supabase/supabase-js'
import { ClipboardList, RefreshCw, Users, CheckCircle, Clock, ChevronUp, ChevronDown, X } from 'lucide-react'

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

const cell = { border:'1px solid #E2E8F0', padding:'10px 14px', verticalAlign:'middle' }

// ✅ 정렬 방향 토글 헬퍼
function SortIcon({ field, sortField, sortDir }) {
  if (sortField !== field) return <span style={{ color:'#CBD5E1', fontSize:'10px' }}>↕</span>
  return sortDir === 'asc'
    ? <ChevronUp  size={12} style={{ color:'#6366F1' }} />
    : <ChevronDown size={12} style={{ color:'#6366F1' }} />
}

export default function AttendanceManagement() {
  const [selectedDate, setSelectedDate] = useState(getToday())
  const [rows,         setRows]         = useState([])
  const [loading,      setLoading]      = useState(false)
  const [localText,    setLocalText]    = useState({})

  // ✅ 정렬 상태
  const [sortField, setSortField] = useState('period')  // 기본: 교시순
  const [sortDir,   setSortDir]   = useState('asc')

  // ✅ 필터 상태
  const [filterAttendance, setFilterAttendance] = useState('전체')  // 전체/등원/결석/등원예정
  const [filterAbsence,    setFilterAbsence]    = useState('전체')  // 전체/-/결석/하원/학원/식사
  const [filterPeriod,     setFilterPeriod]     = useState(0)       // 0=전체, 1~N=해당 교시만

  // ✅ 특이사항 팝업
  const [notesPopup, setNotesPopup] = useState(null)  // { name, notes }

  useEffect(() => { fetchAttendance(); setLocalText({}); setFilterPeriod(0) }, [selectedDate])

  const fetchAttendance = async () => {
    setLoading(true)
    const dow     = new Date(selectedDate + 'T00:00:00').getDay()
    const slotKey = DAY_SLOT_KEYS[dow]

    // ✅ 재원생만 불러오기 (schedules를 통해 student 조회) + 첫등원일자 포함
    const { data: schedules, error } = await supabase
      .from('schedules')
      .select('*, students(id,name,seat_number,school,grade,special_notes,status,first_attendance_date)')

    if (error || !schedules) { setLoading(false); return }

    const allRows = []
    for (const sch of schedules) {
      const slots   = sch[slotKey]
      const student = sch.students
      // ✅ 재원생만 표시
      if (!Array.isArray(slots) || slots.length === 0 || !student) continue
      if ((student.status || '재원생') !== '재원생') continue

      // ✅ 첫등원일자 체크: 선택한 날짜가 첫등원일 이전이면 등원기록에서 제외
      if (student.first_attendance_date && selectedDate < student.first_attendance_date) continue

      // ✅ 오늘 해당 학생의 전체 교시 목록 저장
      const allPeriods = [...slots].sort((a,b) => a-b)

      for (const period of allPeriods) {
        allRows.push({
          scheduleId:   sch.id,
          studentId:    student.id,
          studentName:  student.name,
          seatNumber:   student.seat_number ?? sch.seat_number ?? null,
          school:       student.school,
          grade:        student.grade,
          specialNotes: student.special_notes || '',
          period,
          allPeriods,   // ✅ 오늘 전체 교시
        })
      }
    }

    // 학생당 첫 번째 교시만 행으로 표시 (나머지는 allPeriods 컬럼에 표시)
    const studentMinPeriod = {}
    for (const row of allRows) {
      if (!studentMinPeriod[row.studentId] || row.period < studentMinPeriod[row.studentId].period)
        studentMinPeriod[row.studentId] = row
    }
    const todayRows = Object.values(studentMinPeriod)

    const { data: attData } = await supabase
      .from('attendance').select('*').eq('date', selectedDate)

    const attMap = {}
    if (attData) for (const a of attData) attMap[`${a.student_id}_${a.period}`] = a

    setRows(todayRows.map(row => ({ ...row, attendance: attMap[`${row.studentId}_${row.period}`] || null })))
    setLoading(false)
  }

  // ✅ 정렬 + 필터 적용
  const processedRows = (() => {
    let result = [...rows]

    // 교시 필터 (0=전체, N=N교시만)
    if (filterPeriod !== 0) {
      result = result.filter(r => r.allPeriods.includes(filterPeriod))
    }

    // 필터
    if (filterAttendance !== '전체') {
      result = result.filter(r => (r.attendance?.attendance_status || '등원예정') === filterAttendance)
    }
    if (filterAbsence !== '전체') {
      result = result.filter(r => (r.attendance?.absence_status || '-') === filterAbsence)
    }

    // 정렬
    result.sort((a, b) => {
      let valA, valB
      if (sortField === 'period')     { valA = a.period; valB = b.period }
      else if (sortField === 'name')  { valA = a.studentName; valB = b.studentName }
      else if (sortField === 'attendance') {
        valA = a.attendance?.attendance_status || '등원예정'
        valB = b.attendance?.attendance_status || '등원예정'
      }
      else if (sortField === 'seat') { valA = a.seatNumber || 999; valB = b.seatNumber || 999 }

      if (typeof valA === 'number') return sortDir === 'asc' ? valA - valB : valB - valA
      return sortDir === 'asc'
        ? String(valA).localeCompare(String(valB), 'ko')
        : String(valB).localeCompare(String(valA), 'ko')
    })

    return result
  })()

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
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
      note:              att?.note              ?? '',
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

  // 정렬 가능한 헤더 렌더러
  const SortTh = ({ field, label, center }) => (
    <th
      onClick={() => toggleSort(field)}
      style={{
        ...cell, background:'#F8FAFC', fontSize:'11px', fontWeight:700,
        color: sortField===field ? '#6366F1' : '#64748B',
        letterSpacing:'0.04em', textAlign: center ? 'center' : 'left',
        whiteSpace:'nowrap', cursor:'pointer', userSelect:'none',
      }}
    >
      <span style={{ display:'inline-flex', alignItems:'center', gap:'4px' }}>
        {label} <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
      </span>
    </th>
  )

  return (
    <Layout>
      <div style={{ padding:'28px 32px' }}>

        {/* ── 페이지 헤더 ── */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'16px', flexWrap:'wrap', gap:'16px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
            <div style={{ width:'46px', height:'46px', borderRadius:'14px', background:'#ECFDF5', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <ClipboardList size={22} style={{ color:'#059669' }} />
            </div>
            <div>
              <h1 style={{ fontSize:'22px', fontWeight:700, color:'#0F172A', margin:0 }}>등원 기록</h1>
              <p style={{ fontSize:'13px', color:'#94A3B8', marginTop:'3px' }}>{formatDateKr(selectedDate)}</p>
            </div>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' }}>
            {[
              { label:'등원 예정', value:stats.total,   icon:Users,        bg:'#EEF2FF', color:'#6366F1' },
              { label:'현재 있음', value:stats.present, icon:CheckCircle,  bg:'#ECFDF5', color:'#059669' },
              { label:'없음/예정', value:stats.absent,  icon:Clock,        bg:'#FEF2F2', color:'#EF4444' },
            ].map(({ label, value, icon:Icon, bg, color }) => (
              <div key={label} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 16px', borderRadius:'12px', background:bg, border:`1px solid ${color}22` }}>
                <Icon size={16} style={{ color }} />
                <div>
                  <p style={{ fontSize:'10px', color, fontWeight:600, margin:0 }}>{label}</p>
                  <p style={{ fontSize:'20px', fontWeight:700, color, margin:0, lineHeight:1.1 }}>{value}</p>
                </div>
              </div>
            ))}

            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
              style={{ border:'1.5px solid #E2E8F0', borderRadius:'10px', padding:'9px 12px', fontSize:'13px', outline:'none', color:'#0F172A', background:'#fff' }} />

            <button onClick={fetchAttendance}
              style={{ display:'flex', alignItems:'center', gap:'7px', padding:'9px 14px', borderRadius:'10px', border:'1.5px solid #E2E8F0', background:'#fff', fontSize:'13px', fontWeight:600, color:'#475569', cursor:'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='#6366F1'; e.currentTarget.style.color='#6366F1' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='#E2E8F0'; e.currentTarget.style.color='#475569' }}>
              <RefreshCw size={14} /> 새로고침
            </button>
          </div>
        </div>

        {/* ✅ 교시 필터 컨트롤 */}
        {rows.length > 0 && (() => {
          // 오늘 등장하는 모든 교시 수집
          const allP = [...new Set(rows.flatMap(r => r.allPeriods))].sort((a,b) => a-b)
          return (
            <div style={{ display:'flex', gap:'8px', marginBottom:'8px', flexWrap:'wrap', alignItems:'center' }}>
              <span style={{ fontSize:'12px', fontWeight:700, color:'#64748B' }}>교시 필터:</span>
              <button
                onClick={() => setFilterPeriod(0)}
                style={{
                  padding:'5px 12px', borderRadius:'999px', fontSize:'12px', fontWeight:600, cursor:'pointer',
                  border: filterPeriod===0 ? '1.5px solid #6366F1' : '1.5px solid #E2E8F0',
                  background: filterPeriod===0 ? '#EEF2FF' : '#fff',
                  color: filterPeriod===0 ? '#6366F1' : '#64748B',
                }}>전체 교시</button>
              {allP.map(p => (
                <button key={p} onClick={() => setFilterPeriod(filterPeriod===p ? 0 : p)}
                  style={{
                    padding:'5px 12px', borderRadius:'999px', fontSize:'12px', fontWeight:600, cursor:'pointer',
                    border: filterPeriod===p ? '1.5px solid #7C3AED' : '1.5px solid #E2E8F0',
                    background: filterPeriod===p ? '#F5F3FF' : '#fff',
                    color: filterPeriod===p ? '#7C3AED' : '#64748B',
                  }}>{p}교시</button>
              ))}
            </div>
          )
        })()}

        {/* ✅ 필터 컨트롤 */}
        <div style={{ display:'flex', gap:'8px', marginBottom:'14px', flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ fontSize:'12px', fontWeight:700, color:'#64748B' }}>등원현황:</span>
          {['전체','등원예정','등원'].map(opt => (
            <button key={opt} onClick={() => setFilterAttendance(opt)}
              style={{
                padding:'5px 12px', borderRadius:'999px', fontSize:'12px', fontWeight:600, cursor:'pointer',
                border: filterAttendance===opt ? '1.5px solid #6366F1' : '1.5px solid #E2E8F0',
                background: filterAttendance===opt ? '#EEF2FF' : '#fff',
                color: filterAttendance===opt ? '#6366F1' : '#64748B',
              }}>{opt}</button>
          ))}

          <span style={{ fontSize:'12px', fontWeight:700, color:'#64748B', marginLeft:'8px' }}>불참현황:</span>
          {['전체', '-','결석','하원','학원','식사'].map(opt => (
            <button key={opt} onClick={() => setFilterAbsence(opt)}
              style={{
                padding:'5px 12px', borderRadius:'999px', fontSize:'12px', fontWeight:600, cursor:'pointer',
                border: filterAbsence===opt ? '1.5px solid #EF4444' : '1.5px solid #E2E8F0',
                background: filterAbsence===opt ? '#FEF2F2' : '#fff',
                color: filterAbsence===opt ? '#EF4444' : '#64748B',
              }}>{opt}</button>
          ))}

          {(filterAttendance !== '전체' || filterAbsence !== '전체' || filterPeriod !== 0) && (
            <button onClick={() => { setFilterAttendance('전체'); setFilterAbsence('전체'); setFilterPeriod(0) }}
              style={{ padding:'5px 10px', borderRadius:'999px', fontSize:'12px', fontWeight:600, cursor:'pointer', border:'1.5px solid #E2E8F0', background:'#F8FAFC', color:'#94A3B8', display:'flex', alignItems:'center', gap:'4px' }}>
              <X size={11} /> 필터 해제
            </button>
          )}

          <span style={{ marginLeft:'auto', fontSize:'12px', color:'#94A3B8' }}>
            {processedRows.length}명 표시
          </span>
        </div>

        {/* ── 테이블 ── */}
        {loading ? (
          <div style={{ textAlign:'center', padding:'80px 0', color:'#94A3B8', fontSize:'14px' }}>불러오는 중...</div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign:'center', padding:'80px 0', background:'#fff', borderRadius:'16px', border:'1px solid #E2E8F0', color:'#94A3B8' }}>
            <p style={{ fontSize:'40px', marginBottom:'12px' }}>📭</p>
            <p style={{ fontWeight:600, color:'#64748B' }}>이 날은 등원 예정 학생이 없어요</p>
            <p style={{ fontSize:'13px', marginTop:'4px' }}>스케줄 관리에서 스케줄을 먼저 등록해주세요</p>
          </div>
        ) : (
          <div style={{ background:'#fff', borderRadius:'16px', border:'1px solid #E2E8F0', overflowX:'auto', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
              <thead>
                <tr>
                  <SortTh field="period" label="등원 교시" center />
                  {/* ✅ 오늘 전체 교시 컬럼 추가 */}
                  <th style={{ ...cell, background:'#F8FAFC', fontSize:'11px', fontWeight:700, color:'#64748B', letterSpacing:'0.04em', whiteSpace:'nowrap' }}>
                    오늘 전체 교시
                  </th>
                  <SortTh field="name"   label="이름" />
                  <SortTh field="seat"   label="좌석" center />
                  <SortTh field="attendance" label="등원 현황" />
                  <th style={{ ...cell, background:'#F8FAFC', fontSize:'11px', fontWeight:700, color:'#64748B', letterSpacing:'0.04em', textAlign:'left' }}>불참현황</th>
                  <th style={{ ...cell, background:'#F8FAFC', fontSize:'11px', fontWeight:700, color:'#64748B', letterSpacing:'0.04em', textAlign:'left' }}>결석사유</th>
                  <th style={{ ...cell, background:'#F8FAFC', fontSize:'11px', fontWeight:700, color:'#64748B', letterSpacing:'0.04em', textAlign:'left' }}>지각여부</th>
                  <th style={{ ...cell, background:'#F8FAFC', fontSize:'11px', fontWeight:700, color:'#64748B', letterSpacing:'0.04em', textAlign:'left' }}>지각사유/등원예정교시</th>
                  <th style={{ ...cell, background:'#F8FAFC', fontSize:'11px', fontWeight:700, color:'#64748B', letterSpacing:'0.04em', textAlign:'left' }}>비고</th>
                </tr>
              </thead>
              <tbody>
                {processedRows.map((row, idx) => {
                  const att       = row.attendance
                  const isPresent = att?.attendance_status==='등원' && att?.absence_status==='-'
                  const isAbsent  = att?.absence_status && att.absence_status!=='-'
                  const rowBg     = isPresent ? '#F0FDF4' : isAbsent ? '#FEF2F2' : (idx%2===0 ? '#fff' : '#FAFBFF')

                  return (
                    <tr key={`${row.studentId}_${row.period}`}
                      style={{ background:rowBg, transition:'background 0.15s' }}>

                      {/* 등원 교시 (대표 교시) */}
                      <td style={{ ...cell, textAlign:'center' }}>
                        <span style={{ display:'inline-block', padding:'3px 12px', borderRadius:'999px', background:'#EEF2FF', color:'#6366F1', fontSize:'11px', fontWeight:700 }}>
                          {row.period}교시
                        </span>
                      </td>

                      {/* ✅ 오늘 전체 교시 (번호만 표시) */}
                      <td style={{ ...cell, textAlign:'center' }}>
                        <div style={{ display:'flex', gap:'3px', justifyContent:'center', flexWrap:'wrap' }}>
                          {row.allPeriods.map(p => (
                            <span key={p} style={{
                              display:'inline-flex', alignItems:'center', justifyContent:'center',
                              width:'22px', height:'22px', borderRadius:'6px', fontSize:'11px', fontWeight:700,
                              background: p === row.period ? '#6366F1' : '#F1F5F9',
                              color:      p === row.period ? '#fff'    : '#475569',
                            }}>{p}</span>
                          ))}
                        </div>
                      </td>

                      {/* 이름 + 학년 + ✅ 특이사항 뱃지 */}
                      <td style={{ ...cell, whiteSpace:'nowrap' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                          <span style={{ fontWeight:700, color:'#0F172A' }}>{row.studentName}</span>
                          {row.grade && (
                            <span style={{
                              padding:'1px 7px', borderRadius:'999px', fontSize:'10px', fontWeight:700,
                              background: row.grade.startsWith('고') ? '#EEF2FF' : '#ECFDF5',
                              color:      row.grade.startsWith('고') ? '#4F46E5' : '#059669',
                            }}>{row.grade}</span>
                          )}
                          {/* ✅ 특이사항 있으면 클릭 가능한 뱃지 표시 */}
                          {row.specialNotes && (
                            <button
                              onClick={() => setNotesPopup({ name: row.studentName, notes: row.specialNotes })}
                              title="특이사항 보기"
                              style={{
                                display:'inline-flex', alignItems:'center', gap:'2px',
                                padding:'1px 6px', borderRadius:'999px', fontSize:'10px', fontWeight:700,
                                background:'#FFF7ED', color:'#D97706', border:'1px solid #FDE68A',
                                cursor:'pointer',
                              }}>⚠️</button>
                          )}
                        </div>
                      </td>

                      {/* 좌석번호 */}
                      <td style={{ ...cell, textAlign:'center' }}>
                        {row.seatNumber
                          ? <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:'28px', height:'28px', borderRadius:'8px', background:'#EEF2FF', color:'#6366F1', fontSize:'12px', fontWeight:700 }}>{row.seatNumber}</span>
                          : <span style={{ color:'#CBD5E1' }}>–</span>
                        }
                      </td>

                      {/* 등원 현황 */}
                      <td style={cell}>
                        <select value={att?.attendance_status || '등원예정'} onChange={e => upsertField(row, 'attendance_status', e.target.value)}
                          style={{
                            padding:'5px 10px', borderRadius:'8px', fontSize:'12px', fontWeight:600, cursor:'pointer', outline:'none',
                            border: att?.attendance_status==='등원' ? '1.5px solid #A5B4FC' : '1.5px solid #E2E8F0',
                            background: att?.attendance_status==='등원' ? '#EEF2FF' : '#F8FAFC',
                            color: att?.attendance_status==='등원' ? '#4F46E5' : '#64748B',
                          }}>
                          {ATTENDANCE_OPTIONS.map(o => <option key={o}>{o}</option>)}
                        </select>
                      </td>

                      {/* 결석 현황 */}
                      <td style={cell}>
                        <select value={att?.absence_status || '-'} onChange={e => upsertField(row, 'absence_status', e.target.value)}
                          style={{
                            padding:'5px 10px', borderRadius:'8px', fontSize:'12px', fontWeight:600, cursor:'pointer', outline:'none',
                            border: isAbsent ? '1.5px solid #FCA5A5' : '1.5px solid #E2E8F0',
                            background: isAbsent ? '#FEF2F2' : '#F8FAFC',
                            color: isAbsent ? '#EF4444' : '#64748B',
                          }}>
                          {ABSENCE_OPTIONS.map(o => <option key={o}>{o}</option>)}
                        </select>
                      </td>

                      {/* 결석 사유 */}
                      <td style={cell}>
                        <input type="text" value={textVal(row, 'absence_reason')}
                          onChange={e => handleTextChange(row.studentId, row.period, 'absence_reason', e.target.value)}
                          onBlur={e  => handleTextBlur(row, 'absence_reason', e.target.value)}
                          placeholder="사유 입력"
                          style={{ padding:'5px 10px', borderRadius:'8px', fontSize:'12px', border:'1.5px solid #E2E8F0', outline:'none', width:'100px', background:'#F8FAFC', color:'#374151' }}
                          onFocus={e => { e.target.style.borderColor='#6366F1'; e.target.style.background='#fff' }}
                          onBlur2={e => { e.target.style.borderColor='#E2E8F0'; e.target.style.background='#F8FAFC' }} />
                      </td>

                      {/* 지각 여부 */}
                      <td style={cell}>
                        <select value={att?.is_late ? '지각' : '정각'} onChange={e => upsertField(row, 'is_late', e.target.value==='지각')}
                          style={{
                            padding:'5px 10px', borderRadius:'8px', fontSize:'12px', fontWeight:600, cursor:'pointer', outline:'none',
                            border: att?.is_late ? '1.5px solid #FDE68A' : '1.5px solid #E2E8F0',
                            background: att?.is_late ? '#FFFBEB' : '#F8FAFC',
                            color: att?.is_late ? '#D97706' : '#64748B',
                          }}>
                          <option>정각</option><option>지각</option>
                        </select>
                      </td>

                      {/* 지각 사유 */}
                      <td style={cell}>
                        <input type="text" value={textVal(row, 'late_reason')}
                          onChange={e => handleTextChange(row.studentId, row.period, 'late_reason', e.target.value)}
                          onBlur={e  => handleTextBlur(row, 'late_reason', e.target.value)}
                          placeholder="사유 입력"
                          style={{ padding:'5px 10px', borderRadius:'8px', fontSize:'12px', border:'1.5px solid #E2E8F0', outline:'none', width:'100px', background:'#F8FAFC', color:'#374151' }}
                          onFocus={e => { e.target.style.borderColor='#6366F1'; e.target.style.background='#fff' }} />
                      </td>

                      {/* ✅ 비고 (자유 메모) */}
                      <td style={cell}>
                        <input type="text" value={textVal(row, 'note')}
                          onChange={e => handleTextChange(row.studentId, row.period, 'note', e.target.value)}
                          onBlur={e  => handleTextBlur(row, 'note', e.target.value)}
                          placeholder="메모 입력"
                          style={{ padding:'5px 10px', borderRadius:'8px', fontSize:'12px', border:'1.5px solid #E2E8F0', outline:'none', width:'140px', background:'#F8FAFC', color:'#374151' }}
                          onFocus={e => { e.target.style.borderColor='#6366F1'; e.target.style.background='#fff' }}
                          onBlurCapture={e => { e.target.style.borderColor='#E2E8F0'; e.target.style.background='#F8FAFC' }} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ✅ 특이사항 팝업 모달 */}
      {notesPopup && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50 }}
          onClick={() => setNotesPopup(null)}>
          <div style={{ background:'#fff', borderRadius:'20px', padding:'24px', maxWidth:'380px', width:'90%', boxShadow:'0 20px 60px rgba(0,0,0,0.15)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                <span style={{ fontSize:'22px' }}>⚠️</span>
                <div>
                  <p style={{ fontSize:'15px', fontWeight:700, color:'#0F172A', margin:0 }}>{notesPopup.name} 학생</p>
                  <p style={{ fontSize:'12px', color:'#94A3B8', margin:0 }}>특이사항</p>
                </div>
              </div>
              <button onClick={() => setNotesPopup(null)}
                style={{ width:'30px', height:'30px', borderRadius:'8px', border:'none', background:'#F1F5F9', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <X size={14} style={{ color:'#64748B' }} />
              </button>
            </div>
            <div style={{ background:'#FFFBEB', border:'1.5px solid #FDE68A', borderRadius:'12px', padding:'14px 16px', fontSize:'13px', color:'#92400E', lineHeight:1.7 }}>
              {notesPopup.notes}
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
