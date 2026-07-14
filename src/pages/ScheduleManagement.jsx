import { useState, useEffect, useMemo } from 'react'
import Layout from '../components/Layout'
import { createClient } from '@supabase/supabase-js'
import { X, Trash2, Settings, CalendarDays, Users, Archive, Clock, ChevronUp, ChevronDown, Edit2, Plus, Save } from 'lucide-react'
import { loadTimeConfig, saveTimeConfig, DEFAULT_WEEKDAY_CONFIG, DEFAULT_WEEKEND_CONFIG } from '../lib/timeSlotConfig'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

const DAY_KEYS = [
  { key: 'mon_slots', label: '월', cfgKey: 'mon', type: 'weekday', color: '#6366F1', bg: '#EEF2FF', bgLight: '#F5F7FF' },
  { key: 'tue_slots', label: '화', cfgKey: 'tue', type: 'weekday', color: '#8B5CF6', bg: '#F5F3FF', bgLight: '#FAF9FF' },
  { key: 'wed_slots', label: '수', cfgKey: 'wed', type: 'weekday', color: '#0EA5E9', bg: '#EFF8FF', bgLight: '#F7FBFF' },
  { key: 'thu_slots', label: '목', cfgKey: 'thu', type: 'weekday', color: '#14B8A6', bg: '#F0FDFA', bgLight: '#F7FEFC' },
  { key: 'fri_slots', label: '금', cfgKey: 'fri', type: 'weekday', color: '#10B981', bg: '#ECFDF5', bgLight: '#F5FDF9' },
  { key: 'sat_slots', label: '토', cfgKey: 'sat', type: 'weekend', color: '#F59E0B', bg: '#FFF7ED', bgLight: '#FFFAF3' },
  { key: 'sun_slots', label: '일', cfgKey: 'sun', type: 'weekend', color: '#E11D48', bg: '#FFF1F2', bgLight: '#FFF7F8' },
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

// 첫등원 임박 뱃지 계산 (첫등원일 3일 전 ~ 당일까지 표시)
const getFirstAttendanceBadge = (dateStr) => {
  if (!dateStr) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0)
  const diffDays = Math.round((target - today) / 86400000)
  if (diffDays < 0 || diffDays > 3) return null
  return {
    diff: diffDays,
    text: diffDays === 0 ? '오늘 첫등원!' : `D-${diffDays} 첫등원 예정`,
  }
}

const EMPTY_FORM = {
  student_id:'', seat_number:'', membership_type:'풀',
  mon_slots:[], tue_slots:[], wed_slots:[],
  thu_slots:[], fri_slots:[], sat_slots:[], sun_slots:[],
}

const MEMBERSHIP_STYLE = {
  풀:   { bg:'#ECFDF5', color:'#059669', border:'#A7F3D0' },
  평일: { bg:'#EEF2FF', color:'#4F46E5', border:'#C7D2FE' },
  주말: { bg:'#FFF7ED', color:'#D97706', border:'#FDE68A' },
}

export default function ScheduleManagement() {
  const [students,            setStudents]            = useState([])
  const [schedules,           setSchedules]           = useState([])
  const [loading,             setLoading]             = useState(false)
  const [isModalOpen,         setIsModalOpen]         = useState(false)
  const [editingSchedule,     setEditingSchedule]     = useState(null)
  const [selectedStudent,     setSelectedStudent]     = useState(null)
  const [form,                setForm]                = useState({ ...EMPTY_FORM })
  const [isConfigOpen,        setIsConfigOpen]        = useState(false)
  const [slotConfig,          setSlotConfig]          = useState(loadSlotConfig)
  const [tempConfig,          setTempConfig]          = useState(loadSlotConfig)
  const [toast,               setToast]               = useState(null)
  // -- 시간 설정 상태 (평일/주말 분리) --
  const [isTimeConfigOpen,    setIsTimeConfigOpen]    = useState(false)
  const [timeConfig,          setTimeConfig]          = useState({ weekday: {...DEFAULT_WEEKDAY_CONFIG}, weekend: {...DEFAULT_WEEKEND_CONFIG} })
  const [tempTimeConfig,      setTempTimeConfig]      = useState({ weekday: {...DEFAULT_WEEKDAY_CONFIG}, weekend: {...DEFAULT_WEEKEND_CONFIG} })
  const [timeTabMode,         setTimeTabMode]         = useState('weekday')  // 평일/주말 탭
  // -- 예비 스케줄 상태 --
  const [activeTab,           setActiveTab]           = useState('current')
  const [backupSets,          setBackupSets]          = useState([])
  const [backupLoading,       setBackupLoading]       = useState(false)
  const [backupName,          setBackupName]          = useState('')
  const [showBackupNameInput, setShowBackupNameInput] = useState(false)
  // -- 예비 스케줄 직접 편집 상태 --
  const [isBackupEditOpen,    setIsBackupEditOpen]    = useState(false)
  const [editingBackupSet,    setEditingBackupSet]    = useState(null)   // null = 새 작성
  const [backupEditName,      setBackupEditName]      = useState('')
  const [backupEditItems,     setBackupEditItems]     = useState({})     // { studentId: { membership_type, mon_slots, ... } }
  const [backupEditLoading,   setBackupEditLoading]   = useState(false)
  // 좌석 정렬 상태
  const [sortField, setSortField] = useState('name')   // 'name' | 'seat'
  const [sortDir,   setSortDir]   = useState('asc')

  const dayConfig = useMemo(() =>
    DAY_KEYS.map(d => ({ ...d, slots: slotConfig[d.cfgKey] || 5 })), [slotConfig])

  const totalSlots = useMemo(() =>
    dayConfig.reduce((sum, d) => sum + d.slots, 0), [dayConfig])

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data: sts }, { data: schs }, { data: bsets }, timeCfg] = await Promise.all([
      supabase.from('students').select('*').eq('status', '재원생').order('name'),
      supabase.from('schedules').select('*'),
      supabase.from('schedule_sets').select('*').order('created_at', { ascending: false }),
      loadTimeConfig(supabase),
    ])
    if (sts)     setStudents(sts)
    if (schs)    setSchedules(schs)
    if (bsets)   setBackupSets(bsets)
    if (timeCfg) {
      setTimeConfig(timeCfg)
      setTempTimeConfig({
        weekday: { ...timeCfg.weekday },
        weekend: { ...timeCfg.weekend },
      })
    }
    setLoading(false)
  }

  const showToast = (msg, type='success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  const getSchedule = id => schedules.find(s => s.student_id === id) || null

  // 정렬 토글 함수
  const toggleSortSched = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  // 정렬된 학생 목록 (이름 or 좌석 기준)
  const displayStudents = useMemo(() => {
    return [...students].sort((a, b) => {
      if (sortField === 'seat') {
        const sa = schedules.find(s => s.student_id === a.id)
        const sb = schedules.find(s => s.student_id === b.id)
        const va = sa?.seat_number ?? 9999
        const vb = sb?.seat_number ?? 9999
        return sortDir === 'asc' ? va - vb : vb - va
      }
      return sortDir === 'asc'
        ? (a.name || '').localeCompare(b.name || '', 'ko')
        : (b.name || '').localeCompare(a.name || '', 'ko')
    })
  }, [students, schedules, sortField, sortDir])

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

  // -- 시간 설정 핸들러 (평일/주말 분리) --
  const openTimeConfig = () => {
    setTempTimeConfig({
      weekday: { ...timeConfig.weekday },
      weekend: { ...timeConfig.weekend },
    })
    setTimeTabMode('weekday')   // 열 때마다 평일 탭으로 초기화
    setIsTimeConfigOpen(true)
  }

  const saveTimeConfigHandler = async () => {
    try {
      await saveTimeConfig(supabase, tempTimeConfig)
      setTimeConfig({
        weekday: { ...tempTimeConfig.weekday },
        weekend: { ...tempTimeConfig.weekend },
      })
      setIsTimeConfigOpen(false)
      showToast('시간 설정이 저장됐어요 🕐')
    } catch (err) {
      showToast('저장 실패: ' + err.message, 'error')
    }
  }

  const maxSlots = useMemo(() => Math.max(...Object.values(slotConfig)), [slotConfig])

  const adjustSlot = (cfgKey, delta) => {
    setTempConfig(c => ({ ...c, [cfgKey]: Math.min(20, Math.max(1, (c[cfgKey]||5)+delta)) }))
  }

  // -- 예비 스케줄: 현재 스케줄 저장 --
  const handleSaveBackup = async () => {
    if (!backupName.trim()) { showToast('이름을 입력해주세요', 'error'); return }
    setBackupLoading(true)
    try {
      const { data: setData, error } = await supabase
        .from('schedule_sets')
        .insert({ name: backupName.trim() })
        .select().single()
      if (error) throw error

      const items = schedules.map(s => ({
        set_id:          setData.id,
        student_id:      s.student_id,
        seat_number:     s.seat_number,
        membership_type: s.membership_type,
        mon_slots: s.mon_slots || [], tue_slots: s.tue_slots || [],
        wed_slots: s.wed_slots || [], thu_slots: s.thu_slots || [],
        fri_slots: s.fri_slots || [], sat_slots: s.sat_slots || [],
        sun_slots: s.sun_slots || [],
      }))
      if (items.length > 0) {
        const { error: ie } = await supabase.from('schedule_set_items').insert(items)
        if (ie) throw ie
      }
      showToast(`"${backupName}" 예비 스케줄로 저장됐어요 💾`)
      setBackupName('')
      setShowBackupNameInput(false)
      fetchAll()
    } catch (err) { showToast(`저장 실패: ${err.message}`, 'error') }
    finally { setBackupLoading(false) }
  }

  // -- 예비 스케줄: 현재로 불러오기 --
  const handleLoadBackup = async (setId, setName) => {
    if (!window.confirm(`"${setName}" 예비 스케줄을 불러올까요?\n현재 스케줄이 이 내용으로 교체됩니다.\n\n현재 스케줄을 먼저 저장해두지 않으셨다면 취소 후 저장 먼저 해주세요.`)) return
    setBackupLoading(true)
    try {
      const { data: items, error } = await supabase
        .from('schedule_set_items').select('*').eq('set_id', setId)
      if (error) throw error
      for (const item of items) {
        const existing = schedules.find(s => s.student_id === item.student_id)
        const payload = {
          student_id:      item.student_id,
          seat_number:     item.seat_number,
          membership_type: item.membership_type,
          mon_slots: item.mon_slots || [], tue_slots: item.tue_slots || [],
          wed_slots: item.wed_slots || [], thu_slots: item.thu_slots || [],
          fri_slots: item.fri_slots || [], sat_slots: item.sat_slots || [],
          sun_slots: item.sun_slots || [],
        }
        if (existing) {
          await supabase.from('schedules').update(payload).eq('id', existing.id)
        } else {
          await supabase.from('schedules').insert(payload)
        }
      }
      showToast(`"${setName}" 예비 스케줄을 불러왔어요 `)
      fetchAll()
    } catch (err) { showToast(`불러오기 실패: ${err.message}`, 'error') }
    finally { setBackupLoading(false) }
  }

  // -- 예비 스케줄: 삭제 --
  const handleDeleteBackup = async (setId, setName) => {
    if (!window.confirm(`"${setName}" 예비 스케줄을 삭제할까요?`)) return
    const { error } = await supabase.from('schedule_sets').delete().eq('id', setId)
    if (error) showToast('삭제 실패: ' + error.message, 'error')
    else { showToast(`"${setName}" 삭제 완료`); fetchAll() }
  }

  // -- 예비 스케줄: 직접 편집 열기 --
  const handleOpenBackupEdit = async (bset) => {
    setEditingBackupSet(bset)
    setBackupEditName(bset ? bset.name : '')
    setBackupEditLoading(true)
    setIsBackupEditOpen(true)

    let initialItems = {}
    // 현재 재원생 기반으로 초기화 (빈 슬롯)
    for (const stu of students) {
      const existing = schedules.find(s => s.student_id === stu.id)
      initialItems[stu.id] = {
        seat_number:     existing?.seat_number || stu.seat_number || '',
        membership_type: existing?.membership_type || '풀',
        mon_slots: [], tue_slots: [], wed_slots: [],
        thu_slots: [], fri_slots: [], sat_slots: [], sun_slots: [],
      }
    }

    if (bset) {
      // 기존 예비 스케줄 아이템 불러오기
      const { data: items } = await supabase
        .from('schedule_set_items').select('*').eq('set_id', bset.id)
      if (items) {
        for (const item of items) {
          initialItems[item.student_id] = {
            seat_number:     item.seat_number || '',
            membership_type: item.membership_type || '풀',
            mon_slots: item.mon_slots || [], tue_slots: item.tue_slots || [],
            wed_slots: item.wed_slots || [], thu_slots: item.thu_slots || [],
            fri_slots: item.fri_slots || [], sat_slots: item.sat_slots || [],
            sun_slots: item.sun_slots || [],
          }
        }
      }
    }

    setBackupEditItems(initialItems)
    setBackupEditLoading(false)
  }

  // -- 예비 스케줄: 직접 편집 - 슬롯 토글 --
  const toggleBackupSlot = (studentId, dayKey, n) => {
    setBackupEditItems(prev => {
      const cur = prev[studentId]?.[dayKey] || []
      const next = cur.includes(n) ? cur.filter(s => s !== n) : [...cur, n].sort((a,b) => a-b)
      return { ...prev, [studentId]: { ...(prev[studentId] || {}), [dayKey]: next } }
    })
  }

  const toggleBackupAllDay = (studentId, dayKey, totalSlots) => {
    setBackupEditItems(prev => {
      const cur = prev[studentId]?.[dayKey] || []
      const all = Array.from({ length: totalSlots }, (_, i) => i + 1)
      const next = cur.length === totalSlots ? [] : all
      return { ...prev, [studentId]: { ...(prev[studentId] || {}), [dayKey]: next } }
    })
  }

  // -- 예비 스케줄: 직접 편집 저장 --
  const handleSaveBackupEdit = async () => {
    if (!backupEditName.trim()) { showToast('예비 스케줄 이름을 입력해주세요', 'error'); return }
    setBackupEditLoading(true)
    try {
      let setId
      if (editingBackupSet) {
        // 기존 세트 이름 업데이트
        const { error } = await supabase
          .from('schedule_sets').update({ name: backupEditName.trim() }).eq('id', editingBackupSet.id)
        if (error) throw error
        setId = editingBackupSet.id
        // 기존 아이템 전부 삭제 후 재삽입
        await supabase.from('schedule_set_items').delete().eq('set_id', setId)
      } else {
        // 새 세트 생성
        const { data: newSet, error } = await supabase
          .from('schedule_sets').insert({ name: backupEditName.trim() }).select().single()
        if (error) throw error
        setId = newSet.id
      }

      const items = students.map(stu => {
        const item = backupEditItems[stu.id] || {}
        return {
          set_id:          setId,
          student_id:      stu.id,
          seat_number:     item.seat_number || stu.seat_number || null,
          membership_type: item.membership_type || '풀',
          mon_slots: item.mon_slots || [], tue_slots: item.tue_slots || [],
          wed_slots: item.wed_slots || [], thu_slots: item.thu_slots || [],
          fri_slots: item.fri_slots || [], sat_slots: item.sat_slots || [],
          sun_slots: item.sun_slots || [],
        }
      })

      if (items.length > 0) {
        const { error: ie } = await supabase.from('schedule_set_items').insert(items)
        if (ie) throw ie
      }

      showToast(`"${backupEditName}" 예비 스케줄 저장 완료 💾`)
      setIsBackupEditOpen(false)
      fetchAll()
    } catch (err) { showToast(`저장 실패: ${err.message}`, 'error') }
    finally { setBackupEditLoading(false) }
  }

  const cellBorder = '1px solid #E2E8F0'

  return (
    <Layout>
      <div style={{ padding:'28px 32px' }}>

        {/* -- 탭 버튼 -- */}
        <div style={{ display:'flex', gap:'4px', marginBottom:'20px', background:'#F1F5F9', borderRadius:'14px', padding:'4px', width:'fit-content' }}>
          {[
            { key:'current', label:'📋 현재 스케줄' },
            { key:'backup',  label:'💾 예비 스케줄 관리' },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              padding:'8px 20px', borderRadius:'10px', fontSize:'13px', fontWeight:600,
              cursor:'pointer', border:'none', transition:'all 0.15s',
              background: activeTab === tab.key ? '#fff'     : 'transparent',
              color:       activeTab === tab.key ? '#6366F1' : '#64748B',
              boxShadow:   activeTab === tab.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}>{tab.label}</button>
          ))}
        </div>

        {/* --
            현재 스케줄 탭
        -- */}
        {activeTab === 'current' && (<>

          {/* -- 페이지 헤더 -- */}
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
              <div style={{ display:'flex', gap:'8px' }}>
                <button
                  onClick={openTimeConfig}
                  style={{
                    display:'flex', alignItems:'center', gap:'8px',
                    padding:'10px 18px', borderRadius:'12px',
                    background:'#fff', border:'1px solid #E2E8F0',
                    fontSize:'13px', fontWeight:600, color:'#475569', cursor:'pointer',
                    transition:'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor='#F59E0B'; e.currentTarget.style.color='#D97706' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor='#E2E8F0'; e.currentTarget.style.color='#475569' }}
                >
                  <Clock size={15} /> 시간 설정
                </button>
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
          </div>

          {/* -- 범례 -- */}
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
            <span style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', color:'#64748B' }}>
              <span style={{
                padding:'2px 7px', borderRadius:'999px', fontSize:'10px', fontWeight:800,
                background:'#FFEDD5', color:'#C2410C', border:'1px solid #FED7AA',
              }}>🔥 D-3</span>
              첫등원 3일 전부터 표시
            </span>
            <span style={{ marginLeft:'auto', fontSize:'12px', color:'#6366F1', fontWeight:600 }}>
              💡 행 클릭 → 스케줄 편집
            </span>
          </div>

          {/* -- 메인 테이블 -- */}
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
                <thead>
                  <tr>
                    {[
                      { label:'구분',  w:60,  left:0,   field: null  },
                      { label:'좌석',  w:48,  left:60,  field:'seat' },
                      { label:'이름',  w:80,  left:108, field:'name' },
                      { label:'학년',  w:56,  left:188, field: null  },
                    ].map(({ label, w, left, field }) => (
                      <th key={label} rowSpan={2}
                        onClick={field ? () => toggleSortSched(field) : undefined}
                        style={{
                          position:'sticky', left:`${left}px`, zIndex:20,
                          background:'#F8FAFC', minWidth:`${w}px`, width:`${w}px`,
                          border:cellBorder, padding:'10px 8px',
                          fontSize:'11px', fontWeight:700,
                          color: field && sortField===field ? '#6366F1' : '#64748B',
                          letterSpacing:'0.04em', textAlign:'center',
                          boxShadow: left === 188 ? '4px 0 8px rgba(0,0,0,0.06)' : 'none',
                          cursor: field ? 'pointer' : 'default',
                          userSelect: field ? 'none' : 'auto',
                        }}>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:'3px', justifyContent:'center' }}>
                          {label}
                          {field && (
                            sortField === field
                              ? (sortDir === 'asc'
                                  ? <ChevronUp  size={10} style={{ color:'#6366F1' }} />
                                  : <ChevronDown size={10} style={{ color:'#6366F1' }} />)
                              : <span style={{ color:'#CBD5E1', fontSize:'9px' }}>↕</span>
                          )}
                        </span>
                      </th>
                    ))}
                    {dayConfig.map(day => (
                      <th key={day.key} colSpan={day.slots} style={{
                        border:cellBorder, borderRight:`3px solid ${day.color}`,
                        padding:'8px 4px',
                        textAlign:'center', fontSize:'12px', fontWeight:700,
                        background: day.bg,
                        color:      day.color,
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
                  <tr>
                    {dayConfig.map(day =>
                      Array.from({ length: day.slots }, (_, i) => {
                        const isLastOfDay = i === day.slots - 1
                        return (
                          <th key={`${day.key}-${i}`} style={{
                            border:cellBorder,
                            borderRight: isLastOfDay ? `3px solid ${day.color}` : cellBorder,
                            padding:'5px 2px',
                            textAlign:'center', width:'28px',
                            fontSize:'10px', fontWeight:500, color:'#94A3B8',
                            background: day.bgLight,
                          }}>
                            {i + 1}
                          </th>
                        )
                      })
                    )}
                  </tr>
                </thead>
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
                    displayStudents.map((student, rowIdx) => {
                      const schedule = getSchedule(student.id)
                      const ddayBadge = getFirstAttendanceBadge(student.first_attendance_date)
                      const rowBg = ddayBadge
                        ? (ddayBadge.diff === 0 ? '#FFFBEB' : '#FFF7ED')
                        : (rowIdx % 2 === 0 ? '#fff' : '#FAFBFF')
                      return (
                        <tr
                          key={student.id}
                          onClick={() => handleRowClick(student)}
                          style={{ cursor:'pointer' }}
                          onMouseEnter={e => { e.currentTarget.style.background='#F0F4FF' }}
                          onMouseLeave={e => { e.currentTarget.style.background=rowBg }}
                        >
                          {/* 구분 (멤버십 배지) */}
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
                          {/* 좌석 */}
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
                          {/* 이름 */}
                          <td style={{
                            position:'sticky', left:108, zIndex:10,
                            background:rowBg, border:cellBorder,
                            padding:'8px 10px', fontWeight:700, color:'#0F172A',
                            whiteSpace:'nowrap', fontSize:'13px',
                          }}>
                            <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                              {student.name}
                              {ddayBadge && (
                                <span title="첫등원 임박" style={{
                                  display:'inline-flex', alignItems:'center', gap:'3px',
                                  padding:'2px 7px', borderRadius:'999px',
                                  fontSize:'10px', fontWeight:800, whiteSpace:'nowrap',
                                  background: ddayBadge.diff === 0 ? '#FEF08A' : '#FFEDD5',
                                  color:      ddayBadge.diff === 0 ? '#854D0E' : '#C2410C',
                                  border: `1px solid ${ddayBadge.diff === 0 ? '#FDE047' : '#FED7AA'}`,
                                  animation: 'ddayPulse 1.4s ease-in-out infinite',
                                }}>
                                  🔥 {ddayBadge.text}
                                </span>
                              )}
                            </div>
                          </td>
                          {/* 학년 */}
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
                                    border:cellBorder, borderRight:`3px solid ${day.color}`,
                                    textAlign:'center',
                                    background:'#1E293B', height:'36px',
                                  }}>
                                    <span style={{ fontSize:'9px', color:'#475569', fontWeight:600, letterSpacing:'0.05em' }}>✕</span>
                                  </td>
                                )
                              }
                              return Array.from({ length: day.slots }, (_, i) => {
                                const n = i + 1
                                const isLastOfDay = i === day.slots - 1
                                const active = (schedule[day.key] || []).includes(n)
                                return (
                                  <td key={`${day.key}-${n}`} style={{
                                    border:cellBorder,
                                    borderRight: isLastOfDay ? `3px solid ${day.color}` : cellBorder,
                                    textAlign:'center', width:'28px', height:'36px',
                                    background: active ? day.bg : 'transparent',
                                    verticalAlign:'middle',
                                  }}>
                                    {active && (
                                      <span style={{
                                        display:'inline-flex', alignItems:'center', justifyContent:'center',
                                        width:'18px', height:'18px', borderRadius:'50%',
                                        background: day.color,
                                        fontSize:'9px', fontWeight:900, color:'#fff',
                                      }}>●</span>
                                    )}
                                  </td>
                                )
                              })
                            })
                          ) : (
                            dayConfig.flatMap(day =>
                              Array.from({ length: day.slots }, (_, i) => {
                                const isLastOfDay = i === day.slots - 1
                                return (
                                  <td key={`${day.key}-e-${i}`} style={{
                                    border:cellBorder,
                                    borderRight: isLastOfDay ? `3px solid ${day.color}` : cellBorder,
                                    width:'28px', height:'36px',
                                    background: day.bgLight,
                                  }} />
                                )
                              })
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
        </>)}

        {/* --
            예비 스케줄 탭
        -- */}
        {activeTab === 'backup' && (
          <div>
            {/* 저장 방법 선택 카드 2개 */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px', marginBottom:'20px' }}>
              {/* 방법 1: 현재 스케줄 그대로 저장 */}
              <div style={{
                background:'#fff', borderRadius:'16px', border:'1px solid #E2E8F0',
                padding:'20px', boxShadow:'0 1px 4px rgba(0,0,0,0.04)',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
                  <Archive size={18} style={{ color:'#6366F1' }} />
                  <h3 style={{ fontSize:'14px', fontWeight:700, color:'#0F172A', margin:0 }}>현재 스케줄 그대로 저장</h3>
                </div>
                <p style={{ fontSize:'12px', color:'#64748B', marginBottom:'14px', lineHeight:1.6 }}>
                  지금 등록된 모든 학생 스케줄을 스냅샷으로 저장합니다.
                </p>
                {showBackupNameInput ? (
                  <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                    <input
                      value={backupName}
                      onChange={e => setBackupName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveBackup() }}
                      placeholder="예) 2025년 여름방학 스케줄"
                      autoFocus
                      style={{
                        width:'100%', padding:'9px 12px', borderRadius:'10px', boxSizing:'border-box',
                        border:'1.5px solid #6366F1', outline:'none', fontSize:'13px',
                        boxShadow:'0 0 0 3px rgba(99,102,241,0.1)',
                      }}
                    />
                    <div style={{ display:'flex', gap:'6px' }}>
                      <button onClick={handleSaveBackup} disabled={backupLoading} style={{
                        flex:1, padding:'9px', borderRadius:'9px', border:'none',
                        background:'linear-gradient(135deg,#6366F1,#7C3AED)',
                        color:'#fff', fontSize:'12px', fontWeight:700, cursor:'pointer',
                        opacity: backupLoading ? 0.6 : 1,
                      }}>{backupLoading ? '저장 중…' : '저장'}</button>
                      <button onClick={() => { setShowBackupNameInput(false); setBackupName('') }} style={{
                        padding:'9px 12px', borderRadius:'9px', border:'1.5px solid #E2E8F0',
                        background:'#fff', fontSize:'12px', color:'#64748B', cursor:'pointer',
                      }}>취소</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowBackupNameInput(true)} style={{
                    display:'flex', alignItems:'center', gap:'8px',
                    padding:'9px 16px', borderRadius:'10px', width:'100%', justifyContent:'center',
                    border:'1.5px solid #6366F1', background:'#EEF2FF',
                    color:'#6366F1', fontSize:'13px', fontWeight:700, cursor:'pointer',
                  }}>
                    <Archive size={14} /> 현재 스케줄 저장
                  </button>
                )}
              </div>

              {/* 방법 2: 새로 직접 작성 */}
              <div style={{
                background:'#fff', borderRadius:'16px', border:'2px dashed #C7D2FE',
                padding:'20px', boxShadow:'0 1px 4px rgba(0,0,0,0.04)',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
                  <Edit2 size={18} style={{ color:'#7C3AED' }} />
                  <h3 style={{ fontSize:'14px', fontWeight:700, color:'#0F172A', margin:0 }}>요일·교시별 직접 작성</h3>
                </div>
                <p style={{ fontSize:'12px', color:'#64748B', marginBottom:'14px', lineHeight:1.6 }}>
                  재원생별로 요일·교시를 <strong style={{ color:'#7C3AED' }}>자유롭게 설정</strong>해서 새 예비 스케줄을 만듭니다.
                </p>
                <button
                  onClick={() => handleOpenBackupEdit(null)}
                  style={{
                    display:'flex', alignItems:'center', gap:'8px',
                    padding:'9px 16px', borderRadius:'10px', width:'100%', justifyContent:'center',
                    border:'none', background:'linear-gradient(135deg,#7C3AED,#6366F1)',
                    color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer',
                    boxShadow:'0 4px 12px rgba(124,58,237,0.3)',
                  }}
                >
                  <Plus size={14} /> 직접 작성하기
                </button>
              </div>
            </div>

            {/* 저장된 목록 */}
            <h3 style={{ fontSize:'15px', fontWeight:700, color:'#0F172A', marginBottom:'14px' }}>
              📁 저장된 예비 스케줄 ({backupSets.length}개)
            </h3>

            {backupSets.length === 0 ? (
              <div style={{
                textAlign:'center', padding:'64px',
                background:'#fff', borderRadius:'16px', border:'1px solid #E2E8F0',
              }}>
                <p style={{ fontSize:'40px', marginBottom:'12px' }}>💾</p>
                <p style={{ fontWeight:600, color:'#64748B', fontSize:'15px' }}>저장된 예비 스케줄이 없어요</p>
                <p style={{ fontSize:'13px', color:'#94A3B8', marginTop:'4px' }}>위에서 현재 스케줄을 먼저 저장해보세요</p>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                {backupSets.map(bset => (
                  <div key={bset.id} style={{
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'18px 22px', borderRadius:'14px',
                    background:'#fff', border:'1.5px solid #E2E8F0',
                    boxShadow:'0 1px 4px rgba(0,0,0,0.04)',
                  }}>
                    <div>
                      <p style={{ fontSize:'15px', fontWeight:700, color:'#0F172A', margin:0 }}>{bset.name}</p>
                      <p style={{ fontSize:'12px', color:'#94A3B8', margin:'4px 0 0' }}>
                        저장일: {new Date(bset.created_at).toLocaleDateString('ko-KR', {
                          year:'numeric', month:'long', day:'numeric',
                          hour:'2-digit', minute:'2-digit',
                        })}
                      </p>
                    </div>
                    <div style={{ display:'flex', gap:'8px' }}>
                      <button
                        onClick={() => handleOpenBackupEdit(bset)}
                        disabled={backupLoading}
                        style={{
                          display:'flex', alignItems:'center', gap:'6px',
                          padding:'8px 14px', borderRadius:'10px',
                          border:'1.5px solid #C7D2FE', background:'#EEF2FF',
                          color:'#6366F1', fontSize:'12px', fontWeight:700,
                          cursor: backupLoading ? 'not-allowed' : 'pointer',
                          opacity: backupLoading ? 0.6 : 1,
                        }}
                      ><Edit2 size={13} /> 편집</button>
                      <button
                        onClick={() => handleLoadBackup(bset.id, bset.name)}
                        disabled={backupLoading}
                        style={{
                          display:'flex', alignItems:'center', gap:'6px',
                          padding:'8px 14px', borderRadius:'10px',
                          border:'1.5px solid #059669', background:'#ECFDF5',
                          color:'#059669', fontSize:'12px', fontWeight:700,
                          cursor: backupLoading ? 'not-allowed' : 'pointer',
                          opacity: backupLoading ? 0.6 : 1,
                        }}
                      >⬆️ 불러오기</button>
                      <button
                        onClick={() => handleDeleteBackup(bset.id, bset.name)}
                        disabled={backupLoading}
                        style={{
                          display:'flex', alignItems:'center', gap:'6px',
                          padding:'8px 14px', borderRadius:'10px',
                          border:'1.5px solid #FECACA', background:'#FEF2F2',
                          color:'#EF4444', fontSize:'12px', fontWeight:700,
                          cursor: backupLoading ? 'not-allowed' : 'pointer',
                          opacity: backupLoading ? 0.6 : 1,
                        }}
                      >🗑️ 삭제</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* --
          모달: 스케줄 추가/수정
      -- */}
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
              <div style={{ background:'#F8FAFF', borderRadius:'14px', padding:'16px', border:'1px solid #E0E7FF' }}>
                <p style={{ fontSize:'11px', fontWeight:700, color:'#6366F1', marginBottom:'12px', letterSpacing:'0.04em' }}>
                  👤 학생 정보
                </p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                  {[
                    { label:'이름',        val:selectedStudent.name,          big:true },
                    { label:'학년',        val:selectedStudent.grade || '–' },
                    { label:'학교',        val:selectedStudent.school || '–' },
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
                        border:'1px solid #E2E8F0',
                        borderLeft: avail ? `4px solid ${day.color}` : '4px solid #E2E8F0',
                        background: avail ? day.bgLight : '#F8FAFC',
                        opacity: avail ? 1 : 0.45, transition:'opacity 0.15s',
                      }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
                          <span style={{
                            fontSize:'13px', fontWeight:700,
                            color: !avail ? '#94A3B8' : day.color,
                          }}>
                            {day.label}요일
                            <span style={{ fontSize:'11px', fontWeight:400, color:'#94A3B8', marginLeft:'6px' }}>({day.slots}교시)</span>
                          </span>
                          {avail && (
                            <button type="button"
                              onClick={() => toggleAllDay(day.key, day.slots)}
                              style={{ fontSize:'11px', color:day.color, background:'none', border:'none', cursor:'pointer', fontWeight:600 }}
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
                                  background: checked ? day.color : '#F8FAFC',
                                  color: checked ? '#fff' : '#94A3B8',
                                  boxShadow: checked ? `0 3px 8px ${day.color}4D` : 'none',
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

      {/* --
          모달: 교시 시간 설정 (평일/주말 탭 분리)
      -- */}
      {isTimeConfigOpen && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(15,23,42,0.55)',
          display:'flex', alignItems:'center', justifyContent:'center',
          zIndex:50, padding:'16px',
        }}>
          <div style={{
            background:'#fff', borderRadius:'24px', width:'100%', maxWidth:'420px',
            boxShadow:'0 20px 60px rgba(0,0,0,0.15)', maxHeight:'90vh', overflow:'hidden',
            display:'flex', flexDirection:'column',
          }}>
            {/* 모달 헤더 */}
            <div style={{
              padding:'20px 24px 16px', borderBottom:'1px solid #F1F5F9',
              display:'flex', justifyContent:'space-between', alignItems:'center',
              flexShrink:0,
            }}>
              <div>
                <h2 style={{ fontSize:'16px', fontWeight:700, color:'#0F172A', margin:0 }}>🕐 교시 시간 설정</h2>
                <p style={{ fontSize:'12px', color:'#94A3B8', marginTop:'2px' }}>
                  평일과 주말의 교시별 시간을 각각 설정하세요
                </p>
              </div>
              <button onClick={() => setIsTimeConfigOpen(false)} style={{
                width:'32px', height:'32px', borderRadius:'10px', border:'none',
                background:'#F1F5F9', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                <X size={16} style={{ color:'#64748B' }} />
              </button>
            </div>

            {/* 평일 / 주말 탭 */}
            <div style={{ padding:'16px 24px 0', flexShrink:0 }}>
              <div style={{ display:'flex', gap:'8px' }}>
                {[
                  { key:'weekday', emoji:'🌞', label:'평일 (월~금)' },
                  { key:'weekend', emoji:'🌅', label:'주말 (토~일)' },
                ].map(tab => {
                  const isActive = timeTabMode === tab.key
                  return (
                    <button key={tab.key} onClick={() => setTimeTabMode(tab.key)} style={{
                      flex:1, padding:'10px 8px', borderRadius:'12px',
                      fontSize:'13px', fontWeight:700, cursor:'pointer', textAlign:'center',
                      border: isActive ? '2px solid #F59E0B' : '2px solid #E2E8F0',
                      background: isActive ? '#FFFBEB' : '#F8FAFC',
                      color: isActive ? '#92400E' : '#64748B',
                      transition:'all 0.15s',
                    }}>
                      <span style={{ display:'block', fontSize:'18px', marginBottom:'2px' }}>{tab.emoji}</span>
                      {tab.label}
                    </button>
                  )
                })}
              </div>

              {/* 탭 안내 문구 */}
              <div style={{
                marginTop:'10px', padding:'8px 12px', borderRadius:'10px',
                background: timeTabMode === 'weekday' ? '#EEF2FF' : '#FFF7ED',
                fontSize:'11px',
                color: timeTabMode === 'weekday' ? '#4338CA' : '#B45309',
              }}>
                {timeTabMode === 'weekday'
                  ? '💡 평일(월~금) 교시별 시작 시간을 입력하세요'
                  : '💡 주말(토~일) 교시별 시작 시간을 입력하세요'
                }
              </div>
            </div>

            {/* 교시별 시간 입력 */}
            <div style={{ padding:'12px 24px 16px', overflowY:'auto', flex:1 }}>
              <p style={{ fontSize:'11px', color:'#94A3B8', marginBottom:'10px' }}>
                ※ 교시 수는 <strong>교시 설정</strong>에서 조정할 수 있어요 (현재 최대 {maxSlots}교시)
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {Array.from({ length: maxSlots }, (_, i) => i + 1).map(period => (
                  <div key={period} style={{
                    display:'flex', alignItems:'center', gap:'12px',
                    padding:'10px 14px', borderRadius:'12px',
                    background:'#F8FAFC', border:'1px solid #E2E8F0',
                  }}>
                    <span style={{
                      fontSize:'14px', fontWeight:700,
                      color: timeTabMode === 'weekday' ? '#4338CA' : '#D97706',
                      width:'52px', flexShrink:0,
                    }}>{period}교시</span>
                    <input
                      type="text"
                      value={tempTimeConfig[timeTabMode]?.[period] || ''}
                      onChange={e => setTempTimeConfig(c => ({
                        ...c,
                        [timeTabMode]: { ...c[timeTabMode], [period]: e.target.value }
                      }))}
                      placeholder={
                        timeTabMode === 'weekday'
                          ? (DEFAULT_WEEKDAY_CONFIG[period] || `${period}교시 시간`)
                          : (DEFAULT_WEEKEND_CONFIG[period] || `${period}교시 시간`)
                      }
                      style={{
                        flex:1, padding:'7px 12px', borderRadius:'8px',
                        border:'1.5px solid #E2E8F0', fontSize:'13px', outline:'none',
                        color:'#0F172A', background:'#fff',
                      }}
                      onFocus={e => { e.target.style.borderColor = timeTabMode === 'weekday' ? '#6366F1' : '#F59E0B' }}
                      onBlur={e => { e.target.style.borderColor = '#E2E8F0' }}
                    />
                  </div>
                ))}
              </div>

              <div style={{
                marginTop:'14px', padding:'10px 14px', borderRadius:'12px',
                background:'#FFFBEB', border:'1px solid #FDE68A',
              }}>
                <p style={{ fontSize:'11px', color:'#92400E', margin:0 }}>
                  💡 저장 후 알림톡 메시지와 시간표 이미지에 바로 반영됩니다
                </p>
              </div>
            </div>

            {/* 하단 버튼 */}
            <div style={{ padding:'0 24px 24px', display:'flex', gap:'10px', flexShrink:0 }}>
              <button onClick={() => setIsTimeConfigOpen(false)} style={{
                flex:1, padding:'11px', borderRadius:'12px', border:'1.5px solid #E2E8F0',
                background:'#fff', fontSize:'14px', fontWeight:600, color:'#64748B', cursor:'pointer',
              }}>취소</button>
              <button onClick={saveTimeConfigHandler} style={{
                flex:1, padding:'11px', borderRadius:'12px', border:'none',
                background:'linear-gradient(135deg,#F59E0B,#D97706)',
                fontSize:'14px', fontWeight:700, color:'#fff', cursor:'pointer',
              }}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* --
          모달: 교시 수 설정
      -- */}
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
                      color: day.color,
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

      {/* --
          모달: 예비 스케줄 직접 편집 (전체화면)
      -- */}
      {isBackupEditOpen && (
        <div style={{
          position:'fixed', inset:0, background:'#F8FAFC',
          display:'flex', flexDirection:'column', zIndex:60, overflow:'hidden',
        }}>
          {/* 상단 헤더 */}
          <div style={{
            background:'#fff', borderBottom:'1px solid #E2E8F0',
            padding:'16px 24px', display:'flex', alignItems:'center', gap:'16px', flexShrink:0,
            boxShadow:'0 2px 8px rgba(0,0,0,0.05)',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:'12px', flex:1, minWidth:0 }}>
              <div style={{ width:'38px', height:'38px', borderRadius:'10px', background:'linear-gradient(135deg,#7C3AED,#6366F1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Edit2 size={18} style={{ color:'#fff' }} />
              </div>
              <div style={{ minWidth:0 }}>
                <p style={{ fontSize:'11px', color:'#94A3B8', margin:0, fontWeight:600 }}>예비 스케줄 직접 편집</p>
                <input
                  value={backupEditName}
                  onChange={e => setBackupEditName(e.target.value)}
                  placeholder="예비 스케줄 이름 입력 (필수)"
                  style={{
                    fontSize:'17px', fontWeight:700, color:'#0F172A',
                    border:'none', outline:'none', background:'transparent',
                    width:'340px', padding:0,
                  }}
                />
              </div>
            </div>
            <p style={{ fontSize:'12px', color:'#94A3B8', margin:0, flexShrink:0 }}>
              재원생 {students.length}명
            </p>
            <div style={{ display:'flex', gap:'8px', flexShrink:0 }}>
              <button
                onClick={() => setIsBackupEditOpen(false)}
                style={{
                  padding:'9px 18px', borderRadius:'10px', border:'1.5px solid #E2E8F0',
                  background:'#fff', color:'#64748B', fontSize:'13px', fontWeight:600, cursor:'pointer',
                }}
              >취소</button>
              <button
                onClick={handleSaveBackupEdit}
                disabled={backupEditLoading}
                style={{
                  display:'flex', alignItems:'center', gap:'8px',
                  padding:'9px 20px', borderRadius:'10px', border:'none',
                  background:'linear-gradient(135deg,#7C3AED,#6366F1)',
                  color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer',
                  opacity: backupEditLoading ? 0.6 : 1,
                  boxShadow:'0 4px 12px rgba(124,58,237,0.3)',
                }}
              >
                <Save size={14} /> {backupEditLoading ? '저장 중…' : '저장 완료'}
              </button>
            </div>
          </div>

          {/* 안내 배너 */}
          <div style={{ padding:'10px 24px', background:'#EEF2FF', borderBottom:'1px solid #C7D2FE', flexShrink:0 }}>
            <p style={{ fontSize:'12px', color:'#4338CA', margin:0 }}>
              💡 재원생별로 요일·교시를 선택하세요. 저장 후 "불러오기"로 현재 스케줄에 적용할 수 있어요.
            </p>
          </div>

          {/* 학생 목록 */}
          {backupEditLoading ? (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#94A3B8', fontSize:'14px' }}>
              불러오는 중...
            </div>
          ) : (
            <div style={{ flex:1, overflowY:'auto', padding:'16px 24px', display:'flex', flexDirection:'column', gap:'12px' }}>
              {students.length === 0 ? (
                <div style={{ textAlign:'center', padding:'80px', color:'#94A3B8' }}>
                  <p style={{ fontSize:'32px', marginBottom:'8px' }}>👤</p>
                  <p>등록된 재원생이 없어요</p>
                </div>
              ) : students.map(stu => {
                const item = backupEditItems[stu.id] || {}
                const memType = item.membership_type || '풀'
                return (
                  <div key={stu.id} style={{
                    background:'#fff', borderRadius:'16px', border:'1px solid #E2E8F0',
                    boxShadow:'0 1px 4px rgba(0,0,0,0.04)', overflow:'hidden',
                  }}>
                    {/* 학생 헤더 */}
                    <div style={{
                      display:'flex', alignItems:'center', gap:'14px',
                      padding:'13px 20px', background:'#F8FAFF', borderBottom:'1px solid #E2E8F0',
                    }}>
                      <div style={{
                        width:'34px', height:'34px', borderRadius:'9px', flexShrink:0,
                        background:'linear-gradient(135deg,#6366F1,#7C3AED)',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        color:'#fff', fontSize:'13px', fontWeight:700,
                      }}>{stu.name.slice(0,1)}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                          <span style={{ fontSize:'15px', fontWeight:700, color:'#0F172A' }}>{stu.name}</span>
                          {stu.grade && (
                            <span style={{
                              padding:'2px 8px', borderRadius:'999px', fontSize:'11px', fontWeight:700,
                              background: stu.grade.startsWith('고') ? '#EEF2FF' : '#ECFDF5',
                              color:      stu.grade.startsWith('고') ? '#4F46E5' : '#059669',
                            }}>{stu.grade}</span>
                          )}
                        </div>
                        <p style={{ fontSize:'11px', color:'#94A3B8', margin:'2px 0 0' }}>
                          좌석: {item.seat_number || stu.seat_number || '미지정'}
                        </p>
                      </div>
                      {/* 재원 구분 */}
                      <div style={{ display:'flex', gap:'4px', flexShrink:0 }}>
                        {['평일','주말','풀'].map(type => (
                          <button key={type} type="button"
                            onClick={() => setBackupEditItems(prev => ({
                              ...prev,
                              [stu.id]: { ...(prev[stu.id] || {}), membership_type: type }
                            }))}
                            style={{
                              padding:'5px 12px', borderRadius:'8px', fontSize:'12px', fontWeight:700, cursor:'pointer',
                              border:'none', transition:'all 0.12s',
                              background: memType === type ? '#6366F1' : '#F1F5F9',
                              color:      memType === type ? '#fff'    : '#64748B',
                            }}
                          >{type}</button>
                        ))}
                      </div>
                    </div>

                    {/* 요일별 교시 선택 */}
                    <div style={{ padding:'14px 20px', display:'flex', flexDirection:'column', gap:'8px' }}>
                      {dayConfig.map(day => {
                        const avail = isDayAvailable(memType, day.type)
                        const cur   = item[day.key] || []
                        return (
                          <div key={day.key} style={{
                            display:'flex', alignItems:'center', gap:'12px',
                            opacity: avail ? 1 : 0.3,
                          }}>
                            <div style={{ width:'84px', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                              <span style={{ fontSize:'13px', fontWeight:700, color: avail ? day.color : '#94A3B8' }}>
                                {day.label}요일
                              </span>
                              {avail && (
                                <button type="button"
                                  onClick={() => toggleBackupAllDay(stu.id, day.key, day.slots)}
                                  style={{ fontSize:'10px', color:'#94A3B8', background:'none', border:'none', cursor:'pointer', fontWeight:600, padding:0 }}
                                >
                                  {cur.length === day.slots ? '해제' : '전체'}
                                </button>
                              )}
                            </div>
                            <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
                              {Array.from({ length: day.slots }, (_, i) => {
                                const n = i + 1
                                const checked = cur.includes(n)
                                return (
                                  <button key={n} type="button"
                                    onClick={() => avail && toggleBackupSlot(stu.id, day.key, n)}
                                    disabled={!avail}
                                    style={{
                                      width:'32px', height:'32px', borderRadius:'8px',
                                      border: checked ? 'none' : '1.5px solid #E2E8F0',
                                      cursor: avail ? 'pointer' : 'not-allowed',
                                      fontSize:'12px', fontWeight:700, transition:'all 0.1s',
                                      background: checked ? day.color : '#F8FAFC',
                                      color:      checked ? '#fff'    : '#94A3B8',
                                      boxShadow: checked ? `0 2px 6px ${day.color}4D` : 'none',
                                    }}
                                  >{n}</button>
                                )
                              })}
                            </div>
                            {avail && cur.length > 0 && (
                              <span style={{ fontSize:'11px', color:day.color, fontWeight:700, flexShrink:0 }}>
                                {cur.length}교시
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* -- 토스트 -- */}
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
