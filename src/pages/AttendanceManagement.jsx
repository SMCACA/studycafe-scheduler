import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import { createClient } from '@supabase/supabase-js'
import { ClipboardList, RefreshCw, Users, CheckCircle, Clock, ChevronUp, ChevronDown, X, UserPlus, Search } from 'lucide-react'

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
const ABSENCE_OPTIONS    = ['-','결석','하원','학원','식사','자리비움']

const cell = { border:'1px solid #E2E8F0', padding:'10px 14px', verticalAlign:'middle' }

// 정렬 방향 토글 헬퍼
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

  // 정렬 상태
  const [sortField, setSortField] = useState('period')
  const [sortDir,   setSortDir]   = useState('asc')

  // 필터 상태
  const [filterAttendance, setFilterAttendance] = useState('전체')
  const [filterAbsence,    setFilterAbsence]    = useState('전체')
  const [filterPeriod,     setFilterPeriod]     = useState(0)

  // 특이사항 팝업
  const [notesPopup, setNotesPopup] = useState(null)

  // 과거 날짜 여부
  const [isPastDate, setIsPastDate] = useState(false)

  // ── 예외 등원 관련 상태 ──────────────────────────────────────
  const [showExceptionModal, setShowExceptionModal] = useState(false)
  const [allStudents,        setAllStudents]        = useState([])
  const [exSearchQuery,      setExSearchQuery]      = useState('')
  const [exPeriod,           setExPeriod]           = useState(1)
  const [exSelectedStudent,  setExSelectedStudent]  = useState(null)
  const [addingException,    setAddingException]    = useState(false)
  const [loadingStudents,    setLoadingStudents]    = useState(false)

  useEffect(() => { fetchAttendance(); setLocalText({}); setFilterPeriod(0) }, [selectedDate])

  const fetchAttendance = async () => {
    setLoading(true)
    const today  = getToday()
    const past   = selectedDate < today
    setIsPastDate(past)
    const dow    = new Date(selectedDate + 'T00:00:00').getDay()
    const slotKey = DAY_SLOT_KEYS[dow]

    // 예외 여부 판단을 위해 그날 스케줄이 있는 학생 ID 목록 미리 조회
    const { data: schData } = await supabase
      .from('schedules')
      .select(`student_id, ${slotKey}`)

    const scheduledStudentIds = new Set()
    if (schData) {
      for (const s of schData) {
        const slots = s[slotKey]
        if (Array.isArray(slots) && slots.length > 0) scheduledStudentIds.add(s.student_id)
      }
    }

    // ── 과거 날짜: 실제 출결 기록 기반 표시 ────────────────────────────
    if (past) {
      const { data: attData } = await supabase
        .from('attendance')
        .select('*, students(id, name, seat_number, school, grade, special_notes, status, first_attendance_date)')
        .eq('date', selectedDate)

      if (!attData || attData.length === 0) {
        setRows([])
        setLoading(false)
        return
      }

      const studentMap = {}
      for (const att of attData) {
        if (!att.students) continue
        const sid = att.student_id
        if (!studentMap[sid]) {
          studentMap[sid] = {
            scheduleId:   null,
            studentId:    sid,
            studentName:  att.students.name,
            seatNumber:   att.students.seat_number ?? null,
            school:       att.students.school,
            grade:        att.students.grade,
            specialNotes: att.students.special_notes || '',
            allPeriods:   [],
            periodAttMap: {},
            // 스케줄에 없으면 예외 등원
            isException:  !scheduledStudentIds.has(sid),
          }
        }
        studentMap[sid].allPeriods.push(att.period)
        studentMap[sid].periodAttMap[att.period] = att
      }

      const pastRows = []
      for (const rowBase of Object.values(studentMap)) {
        rowBase.allPeriods.sort((a, b) => a - b)
        const minPeriod = rowBase.allPeriods[0]
        pastRows.push({
          ...rowBase,
          period:     minPeriod,
          attendance: rowBase.periodAttMap[minPeriod] || null,
        })
      }

      setRows(pastRows)
      setLoading(false)
      return
    }

    // ── 오늘/미래: 스케줄 기반 로직 ────────────────────────────────
    const { data: schedules, error } = await supabase
      .from('schedules')
      .select('*, students(id,name,seat_number,school,grade,special_notes,status,first_attendance_date)')

    if (error || !schedules) { setLoading(false); return }

    const allRows = []
    for (const sch of schedules) {
      const slots   = sch[slotKey]
      const student = sch.students
      if (!Array.isArray(slots) || slots.length === 0 || !student) continue
      if ((student.status || '재원생') !== '재원생') continue
      if (student.first_attendance_date && selectedDate < student.first_attendance_date) continue

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
          allPeriods,
          isException:  false,
        })
      }
    }

    const studentMinPeriod = {}
    for (const row of allRows) {
      if (!studentMinPeriod[row.studentId] || row.period < studentMinPeriod[row.studentId].period)
        studentMinPeriod[row.studentId] = row
    }
    const todayRows = Object.values(studentMinPeriod)
    const todayStudentIds = new Set(todayRows.map(r => r.studentId))

    const { data: attData } = await supabase
      .from('attendance').select('*').eq('date', selectedDate)

    const attMap = {}
    if (attData) for (const a of attData) attMap[`${a.student_id}_${a.period}`] = a

    // 정규 등원 학생 행
    const finalRows = todayRows.map(row => ({
      ...row,
      attendance: attMap[`${row.studentId}_${row.period}`] || null,
    }))

    // ── 예외 등원 학생 감지: 출결 기록은 있지만 스케줄에 없는 학생 ──
    const exceptionAtts = attData
      ? attData.filter(a => !todayStudentIds.has(a.student_id))
      : []

    if (exceptionAtts.length > 0) {
      const exStudentIds = [...new Set(exceptionAtts.map(a => a.student_id))]
      const { data: exStudents } = await supabase
        .from('students')
        .select('id, name, seat_number, school, grade, special_notes, status')
        .in('id', exStudentIds)

      const exStudentMap = {}
      if (exStudents) for (const s of exStudents) exStudentMap[s.id] = s

      // 예외 학생별 그룹핑
      const exGrouped = {}
      for (const att of exceptionAtts) {
        if (!exGrouped[att.student_id]) exGrouped[att.student_id] = []
        exGrouped[att.student_id].push(att)
      }

      for (const [sidStr, atts] of Object.entries(exGrouped)) {
        const sid = parseInt(sidStr)
        atts.sort((a, b) => a.period - b.period)
        const minPeriod = atts[0].period
        const student = exStudentMap[sid]

        finalRows.push({
          scheduleId:   null,
          studentId:    sid,
          studentName:  student?.name || '알 수 없음',
          seatNumber:   student?.seat_number || null,
          school:       student?.school,
          grade:        student?.grade,
          specialNotes: student?.special_notes || '',
          period:       minPeriod,
          allPeriods:   atts.map(a => a.period),
          attendance:   atts[0],
          isException:  true,
        })
      }
    }

    setRows(finalRows)
    setLoading(false)
  }

  // ── 예외 등원 모달 열기 ──────────────────────────────────────
  const openExceptionModal = async () => {
    setExSearchQuery('')
    setExPeriod(1)
    setExSelectedStudent(null)
    setShowExceptionModal(true)
    setLoadingStudents(true)

    const { data: students } = await supabase
      .from('students')
      .select('id, name, school, grade, seat_number, status')
      .eq('status', '재원생')
      .order('name')

    setAllStudents(students || [])
    setLoadingStudents(false)
  }

  // ── 예외 등원자 추가 ─────────────────────────────────────────
  const addExceptionStudent = async () => {
    if (!exSelectedStudent || addingException) return
    setAddingException(true)

    const payload = {
      date:               selectedDate,
      student_id:         exSelectedStudent.id,
      period:             exPeriod,
      attendance_status:  '등원예정',
      absence_status:     '-',
      absence_reason:     '',
      is_late:            false,
      late_reason:        '',
      note:               '',
    }

    const { data } = await supabase
      .from('attendance')
      .upsert(payload, { onConflict: 'date,student_id,period' })
      .select().single()

    if (data) {
      // 이미 같은 학생이 rows에 있으면 allPeriods만 업데이트
      const existingIdx = rows.findIndex(r => r.studentId === exSelectedStudent.id && r.isException)
      if (existingIdx >= 0) {
        setRows(prev => prev.map((r, i) =>
          i === existingIdx
            ? { ...r, allPeriods: [...new Set([...r.allPeriods, exPeriod])].sort((a,b)=>a-b) }
            : r
        ))
      } else {
        const newRow = {
          scheduleId:   null,
          studentId:    exSelectedStudent.id,
          studentName:  exSelectedStudent.name,
          seatNumber:   exSelectedStudent.seat_number || null,
          school:       exSelectedStudent.school,
          grade:        exSelectedStudent.grade,
          specialNotes: '',
          period:       exPeriod,
          allPeriods:   [exPeriod],
          attendance:   data,
          isException:  true,
        }
        setRows(prev => [...prev, newRow])
      }
    }

    setAddingException(false)
    setShowExceptionModal(false)
  }

  // 이미 등록된 학생 제외한 재원생 목록 (같은 날 이미 예외 등원 중인 학생도 선택 가능 - 다른 교시용)
  const alreadyInRows = new Set(rows.map(r => r.studentId))
  const filteredStudents = allStudents
    .filter(s => !alreadyInRows.has(s.id))
    .filter(s => exSearchQuery === '' || s.name.includes(exSearchQuery))

  // 정렬 + 필터 적용
  const processedRows = (() => {
    let result = [...rows]

    if (filterPeriod !== 0) {
      result = result.filter(r => r.allPeriods.includes(filterPeriod))
    }
    if (filterAttendance !== '전체') {
      result = result.filter(r => (r.attendance?.attendance_status || '등원예정') === filterAttendance)
    }
    if (filterAbsence !== '전체') {
      result = result.filter(r => (r.attendance?.absence_status || '-') === filterAbsence)
    }

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
      <style>{`
        .att-text-input::placeholder { color: #B8C4CC; font-weight: 400; }
        .ex-student-item { transition: background 0.12s; cursor: pointer; }
        .ex-student-item:hover { background: #F5F3FF !important; }
        .ex-student-item.selected { background: #EEF2FF !important; }
      `}</style>
      <div style={{ padding:'28px 32px' }}>

        {/* -- 페이지 헤더 -- */}
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

            {/* ── 예외 등원 추가 버튼 ── */}
            {!isPastDate && (
              <button onClick={openExceptionModal}
                style={{
                  display:'flex', alignItems:'center', gap:'7px', padding:'9px 14px',
                  borderRadius:'10px', border:'1.5px solid #F59E0B',
                  background:'#FFFBEB', fontSize:'13px', fontWeight:600, color:'#B45309', cursor:'pointer',
                  whiteSpace:'nowrap',
                }}
                onMouseEnter={e => { e.currentTarget.style.background='#FEF3C7'; e.currentTarget.style.borderColor='#D97706' }}
                onMouseLeave={e => { e.currentTarget.style.background='#FFFBEB'; e.currentTarget.style.borderColor='#F59E0B' }}>
                <UserPlus size={14} /> 예외 등원 추가
              </button>
            )}

            <button onClick={fetchAttendance}
              style={{ display:'flex', alignItems:'center', gap:'7px', padding:'9px 14px', borderRadius:'10px', border:'1.5px solid #E2E8F0', background:'#fff', fontSize:'13px', fontWeight:600, color:'#475569', cursor:'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='#6366F1'; e.currentTarget.style.color='#6366F1' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='#E2E8F0'; e.currentTarget.style.color='#475569' }}>
              <RefreshCw size={14} /> 새로고침
            </button>
          </div>
        </div>

        {/* 교시 필터 컨트롤 */}
        {rows.length > 0 && (() => {
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

        {/* 필터 컨트롤 */}
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
          {['전체', '-','결석','하원','학원','식사','자리비움'].map(opt => (
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

        {/* -- 테이블 -- */}
        {loading ? (
          <div style={{ textAlign:'center', padding:'80px 0', color:'#94A3B8', fontSize:'14px' }}>불러오는 중...</div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign:'center', padding:'80px 0', background:'#fff', borderRadius:'16px', border:'1px solid #E2E8F0', color:'#94A3B8' }}>
            <p style={{ fontSize:'40px', marginBottom:'12px' }}>📭</p>
            {isPastDate ? (
              <>
                <p style={{ fontWeight:600, color:'#64748B' }}>이 날은 기록된 출결 데이터가 없어요</p>
                <p style={{ fontSize:'13px', marginTop:'4px' }}>과거 날짜는 실제 출결 기록이 있어야 표시됩니다</p>
              </>
            ) : (
              <>
                <p style={{ fontWeight:600, color:'#64748B' }}>이 날은 등원 예정 학생이 없어요</p>
                <p style={{ fontSize:'13px', marginTop:'4px' }}>스케줄 관리에서 스케줄을 먼저 등록해주세요</p>
              </>
            )}
          </div>
        ) : (
          <div style={{ background:'#fff', borderRadius:'16px', border:'1px solid #E2E8F0', overflowX:'auto', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
              <thead>
                <tr>
                  <SortTh field="period" label="등원 교시" center />
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
                  const att        = row.attendance
                  const isPresent  = att?.attendance_status==='등원' && att?.absence_status==='-'
                  const isAbsent   = att?.absence_status && att.absence_status!=='-'
                  const isException = row.isException

                  // 예외 등원은 연한 주황 배경, 나머지는 기존 로직
                  const rowBg = isException
                    ? '#FFFBEB'
                    : (isPresent ? '#F0FDF4' : isAbsent ? '#FEF2F2' : (idx%2===0 ? '#fff' : '#FAFBFF'))

                  return (
                    <tr key={`${row.studentId}_${row.period}`}
                      style={{ background:rowBg, transition:'background 0.15s' }}>

                      {/* 등원 교시 (대표 교시) */}
                      <td style={{ ...cell, textAlign:'center' }}>
                        <span style={{
                          display:'inline-block', padding:'3px 12px', borderRadius:'999px',
                          background: isException ? '#FEF3C7' : '#EEF2FF',
                          color:      isException ? '#B45309'  : '#6366F1',
                          fontSize:'11px', fontWeight:700,
                        }}>
                          {row.period}교시
                        </span>
                      </td>

                      {/* 오늘 전체 교시 */}
                      <td style={{ ...cell, textAlign:'center' }}>
                        <div style={{ display:'flex', gap:'3px', justifyContent:'center', flexWrap:'wrap' }}>
                          {row.allPeriods.map(p => (
                            <span key={p} style={{
                              display:'inline-flex', alignItems:'center', justifyContent:'center',
                              width:'22px', height:'22px', borderRadius:'6px', fontSize:'11px', fontWeight:700,
                              background: p === row.period
                                ? (isException ? '#F59E0B' : '#6366F1')
                                : '#F1F5F9',
                              color: p === row.period ? '#fff' : '#475569',
                            }}>{p}</span>
                          ))}
                        </div>
                      </td>

                      {/* 이름 + 학년 + 예외 뱃지 + 특이사항 */}
                      <td style={{ ...cell, whiteSpace:'nowrap' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap' }}>
                          <span style={{ fontWeight:700, color:'#0F172A' }}>{row.studentName}</span>
                          {row.grade && (
                            <span style={{
                              padding:'1px 7px', borderRadius:'999px', fontSize:'10px', fontWeight:700,
                              background: row.grade.startsWith('고') ? '#EEF2FF' : '#ECFDF5',
                              color:      row.grade.startsWith('고') ? '#4F46E5' : '#059669',
                            }}>{row.grade}</span>
                          )}
                          {/* 예외 등원 뱃지 */}
                          {isException && (
                            <span style={{
                              padding:'2px 8px', borderRadius:'999px', fontSize:'10px', fontWeight:700,
                              background:'#FEF3C7', color:'#92400E',
                              border:'1px solid #FDE68A',
                              letterSpacing:'0.02em',
                            }}>예외 등원</span>
                          )}
                          {/* 특이사항 */}
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
                          className="att-text-input"
                          style={{ padding:'5px 10px', borderRadius:'8px', fontSize:'12px', fontWeight:600, border:'1.5px solid #E2E8F0', outline:'none', width:'100px', background:'#F8FAFC', color:'#0F172A' }}
                          onFocus={e => { e.target.style.borderColor='#6366F1'; e.target.style.background='#fff' }} />
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
                          className="att-text-input"
                          style={{ padding:'5px 10px', borderRadius:'8px', fontSize:'12px', fontWeight:600, border:'1.5px solid #E2E8F0', outline:'none', width:'100px', background:'#F8FAFC', color:'#0F172A' }}
                          onFocus={e => { e.target.style.borderColor='#6366F1'; e.target.style.background='#fff' }} />
                      </td>

                      {/* 비고 */}
                      <td style={cell}>
                        <input type="text" value={textVal(row, 'note')}
                          onChange={e => handleTextChange(row.studentId, row.period, 'note', e.target.value)}
                          onBlur={e  => handleTextBlur(row, 'note', e.target.value)}
                          placeholder="메모 입력"
                          className="att-text-input"
                          style={{ padding:'5px 10px', borderRadius:'8px', fontSize:'12px', fontWeight:600, border:'1.5px solid #E2E8F0', outline:'none', width:'140px', background:'#F8FAFC', color:'#0F172A' }}
                          onFocus={e => { e.target.style.borderColor='#6366F1'; e.target.style.background='#fff' }} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 예외 등원 추가 모달 ──────────────────────────────────── */}
      {showExceptionModal && (
        <div
          style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50 }}
          onClick={() => setShowExceptionModal(false)}
        >
          <div
            style={{ background:'#fff', borderRadius:'20px', padding:'28px', width:'440px', maxWidth:'95vw', maxHeight:'85vh', display:'flex', flexDirection:'column', boxShadow:'0 24px 64px rgba(0,0,0,0.18)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                <div style={{ width:'40px', height:'40px', borderRadius:'12px', background:'#FEF3C7', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <UserPlus size={18} style={{ color:'#B45309' }} />
                </div>
                <div>
                  <p style={{ fontSize:'16px', fontWeight:700, color:'#0F172A', margin:0 }}>예외 등원 추가</p>
                  <p style={{ fontSize:'12px', color:'#94A3B8', margin:0 }}>재원생 중 오늘 예외 등원할 학생을 선택하세요</p>
                </div>
              </div>
              <button onClick={() => setShowExceptionModal(false)}
                style={{ width:'32px', height:'32px', borderRadius:'8px', border:'none', background:'#F1F5F9', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <X size={15} style={{ color:'#64748B' }} />
              </button>
            </div>

            {/* 교시 선택 */}
            <div style={{ marginBottom:'16px' }}>
              <label style={{ fontSize:'12px', fontWeight:700, color:'#475569', display:'block', marginBottom:'6px' }}>
                등원 교시
              </label>
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <input
                  type="number" min={1} max={12} value={exPeriod}
                  onChange={e => setExPeriod(Math.max(1, Math.min(12, parseInt(e.target.value) || 1)))}
                  style={{
                    width:'80px', padding:'8px 12px', borderRadius:'10px', border:'1.5px solid #E2E8F0',
                    fontSize:'14px', fontWeight:700, color:'#0F172A', outline:'none', textAlign:'center',
                  }}
                  onFocus={e => e.target.style.borderColor='#F59E0B'}
                  onBlur={e  => e.target.style.borderColor='#E2E8F0'}
                />
                <span style={{ fontSize:'13px', color:'#64748B', fontWeight:600 }}>교시</span>
                <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
                  {[1,2,3,4,5,6,7,8].map(p => (
                    <button key={p} onClick={() => setExPeriod(p)}
                      style={{
                        width:'28px', height:'28px', borderRadius:'7px', fontSize:'12px', fontWeight:700,
                        border: exPeriod===p ? '1.5px solid #F59E0B' : '1.5px solid #E2E8F0',
                        background: exPeriod===p ? '#FEF3C7' : '#F8FAFC',
                        color: exPeriod===p ? '#B45309' : '#64748B',
                        cursor:'pointer',
                      }}>{p}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* 학생 검색 */}
            <div style={{ position:'relative', marginBottom:'10px' }}>
              <Search size={14} style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'#94A3B8' }} />
              <input
                type="text"
                placeholder="이름으로 검색"
                value={exSearchQuery}
                onChange={e => setExSearchQuery(e.target.value)}
                style={{
                  width:'100%', padding:'9px 12px 9px 34px', borderRadius:'10px', border:'1.5px solid #E2E8F0',
                  fontSize:'13px', color:'#0F172A', outline:'none', boxSizing:'border-box',
                }}
                onFocus={e => e.target.style.borderColor='#F59E0B'}
                onBlur={e  => e.target.style.borderColor='#E2E8F0'}
              />
            </div>

            {/* 학생 목록 */}
            <div style={{ flex:1, overflowY:'auto', border:'1.5px solid #E2E8F0', borderRadius:'12px', marginBottom:'16px' }}>
              {loadingStudents ? (
                <div style={{ padding:'32px', textAlign:'center', color:'#94A3B8', fontSize:'13px' }}>불러오는 중...</div>
              ) : filteredStudents.length === 0 ? (
                <div style={{ padding:'32px', textAlign:'center', color:'#94A3B8', fontSize:'13px' }}>
                  {exSearchQuery ? `"${exSearchQuery}" 검색 결과 없음` : '추가할 수 있는 학생이 없어요'}
                </div>
              ) : (
                filteredStudents.map(student => {
                  const isSelected = exSelectedStudent?.id === student.id
                  return (
                    <div
                      key={student.id}
                      className={`ex-student-item${isSelected ? ' selected' : ''}`}
                      onClick={() => setExSelectedStudent(isSelected ? null : student)}
                      style={{
                        display:'flex', alignItems:'center', justifyContent:'space-between',
                        padding:'11px 14px',
                        borderBottom:'1px solid #F1F5F9',
                        background: isSelected ? '#EEF2FF' : '#fff',
                      }}
                    >
                      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                        <div style={{
                          width:'32px', height:'32px', borderRadius:'9px',
                          background: isSelected ? '#6366F1' : '#F1F5F9',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:'13px', fontWeight:700,
                          color: isSelected ? '#fff' : '#64748B',
                          transition:'all 0.15s',
                        }}>
                          {student.name[0]}
                        </div>
                        <div>
                          <p style={{ fontSize:'14px', fontWeight:700, color:'#0F172A', margin:0 }}>{student.name}</p>
                          <p style={{ fontSize:'11px', color:'#94A3B8', margin:0 }}>
                            {[student.school, student.grade].filter(Boolean).join(' · ')}
                            {student.seat_number ? ` · ${student.seat_number}번 좌석` : ''}
                          </p>
                        </div>
                      </div>
                      {isSelected && (
                        <span style={{ fontSize:'11px', fontWeight:700, color:'#6366F1', background:'#EEF2FF', padding:'2px 10px', borderRadius:'999px' }}>선택됨</span>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {/* 선택된 학생 요약 + 확인 버튼 */}
            {exSelectedStudent && (
              <div style={{ background:'#FFFBEB', border:'1.5px solid #FDE68A', borderRadius:'10px', padding:'10px 14px', marginBottom:'12px', fontSize:'13px', color:'#92400E' }}>
                <strong>{exSelectedStudent.name}</strong> 학생을 <strong>{exPeriod}교시</strong> 예외 등원으로 추가합니다
              </div>
            )}

            <div style={{ display:'flex', gap:'8px' }}>
              <button onClick={() => setShowExceptionModal(false)}
                style={{ flex:1, padding:'11px', borderRadius:'10px', border:'1.5px solid #E2E8F0', background:'#F8FAFC', fontSize:'13px', fontWeight:600, color:'#64748B', cursor:'pointer' }}>
                취소
              </button>
              <button
                onClick={addExceptionStudent}
                disabled={!exSelectedStudent || addingException}
                style={{
                  flex:2, padding:'11px', borderRadius:'10px', border:'none',
                  background: exSelectedStudent ? '#F59E0B' : '#E2E8F0',
                  fontSize:'13px', fontWeight:700,
                  color: exSelectedStudent ? '#fff' : '#94A3B8',
                  cursor: exSelectedStudent ? 'pointer' : 'not-allowed',
                  transition:'background 0.15s',
                }}
                onMouseEnter={e => { if(exSelectedStudent) e.currentTarget.style.background='#D97706' }}
                onMouseLeave={e => { if(exSelectedStudent) e.currentTarget.style.background='#F59E0B' }}
              >
                {addingException ? '추가 중...' : '예외 등원 추가'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 특이사항 팝업 모달 */}
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
