import { useState, useEffect, useMemo } from 'react'
import Layout from '../components/Layout'
import { createClient } from '@supabase/supabase-js'
import { X, Trash2, Settings, CalendarDays, Users, Archive, Clock, ChevronUp, ChevronDown, Edit2, Plus, Save, RotateCcw, Trash } from 'lucide-react'
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
  const [backupDaySlots,      setBackupDaySlots]      = useState({ ...DEFAULT_SLOT_CONFIG })
  // 좌석 정렬 상태
  const [sortField, setSortField] = useState('name')   // 'name' | 'seat'
  const [sortDir,   setSortDir]   = useState('asc')
  // -- 휴지통 상태 --
  const [trashSets,    setTrashSets]    = useState([])
  const [trashLoading, setTrashLoading] = useState(false)

  const dayConfig = useMemo(() =>
    DAY_KEYS.map(d => ({ ...d, slots: slotConfig[d.cfgKey] || 5 })), [slotConfig])

  const backupDayConfig = useMemo(() =>
    DAY_KEYS.map(d => ({ ...d, slots: backupDaySlots[d.cfgKey] || 5 })), [backupDaySlots])

  const totalSlots = useMemo(() =>
    dayConfig.reduce((sum, d) => sum + d.slots, 0), [dayConfig])

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data: sts }, { data: schs }, { data: bsets }, { data: tsets }, timeCfg] = await Promise.all([
      supabase.from('students').select('*').eq('status', '재원생').order('name'),
      supabase.from('schedules').select('*'),
      // 예비 스케줄: trashed_at이 null인 것만 (휴지통 아닌 것)
      supabase.from('schedule_sets').select('*').is('trashed_at', null).order('created_at', { ascending: false }),
      // 휴지통: trashed_at이 있는 것
      supabase.from('schedule_sets').select('*').not('trashed_at', 'is', null).order('trashed_at', { ascending: false }),
      loadTimeConfig(supabase),
    ])
    if (sts)     setStudents(sts)
    if (schs)    setSchedules(schs)
    if (bsets)   setBackupSets(bsets)

    // 60일 지난 휴지통 항목 자동 삭제
    const now = new Date()
    const cutoffDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
    const toAutoDelete = (tsets || []).filter(t => t.trashed_at && new Date(t.trashed_at) < cutoffDate)
    for (const old of toAutoDelete) {
      await supabase.from('schedule_set_items').delete().eq('set_id', old.id)
      await supabase.from('schedule_sets').delete().eq('id', old.id)
    }
    // 자동 삭제 후 남은 항목만 세팅
    setTrashSets((tsets || []).filter(t => !toAutoDelete.find(d => d.id === t.id)))

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
        .insert({ name: backupName.trim(), slots_config: slotConfig })
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

  // -- 예비 스케줄: 현재로 불러오기 (불러오기 전 현재 스케줄을 휴지통에 자동 저장) --
  const handleLoadBackup = async (setId, setName, slotsConfig) => {
    const slotMsg = slotsConfig ? '\n교시 수도 이 예비 스케줄의 설정으로 함께 변경됩니다.' : ''
    if (!window.confirm(`"${setName}" 예비 스케줄을 불러올까요?\n현재 스케줄이 이 내용으로 교체되며, 현재 스케줄은 자동으로 휴지통에 백업됩니다.${slotMsg}`)) return
    setBackupLoading(true)
    try {
      // ① 현재 스케줄을 휴지통에 스냅샷으로 저장 (복원 가능하도록)
      if (schedules.length > 0) {
        const snapName = `[자동백업] ${new Date().toLocaleDateString('ko-KR', { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' })} 불러오기 전`
        const { data: snapSet, error: snapErr } = await supabase
          .from('schedule_sets')
          .insert({
            name: snapName,
            slots_config: slotConfig,
            trashed_at: new Date().toISOString(),
          })
          .select().single()
        if (!snapErr && snapSet) {
          const snapItems = schedules.map(s => ({
            set_id:          snapSet.id,
            student_id:      s.student_id,
            seat_number:     s.seat_number,
            membership_type: s.membership_type,
            mon_slots: s.mon_slots || [], tue_slots: s.tue_slots || [],
            wed_slots: s.wed_slots || [], thu_slots: s.thu_slots || [],
            fri_slots: s.fri_slots || [], sat_slots: s.sat_slots || [],
            sun_slots: s.sun_slots || [],
          }))
          if (snapItems.length > 0) {
            await supabase.from('schedule_set_items').insert(snapItems)
          }
        }
      }

      // ② 예비 스케줄 아이템 불러오기
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

      // ③ 교시수도 함께 적용 (예비스케줄에 저장된 slots_config가 있을 때만)
      if (slotsConfig) {
        const newConfig = { ...DEFAULT_SLOT_CONFIG, ...slotsConfig }
        setSlotConfig(newConfig)
        setTempConfig(newConfig)
        localStorage.setItem('smc_slot_config', JSON.stringify(newConfig))
      }
      showToast(`"${setName}" 불러오기 완료 · 이전 스케줄은 휴지통에 저장됐어요 🗑️`)
      fetchAll()
    } catch (err) { showToast(`불러오기 실패: ${err.message}`, 'error') }
    finally { setBackupLoading(false) }
  }

  // -- 예비 스케줄: 휴지통으로 이동 --
  const handleDeleteBackup = async (setId, setName) => {
    if (!window.confirm(`"${setName}" 예비 스케줄을 휴지통으로 이동할까요?\n(60일 후 자동 삭제 · 그 전에 복원 가능)`)) return
    setBackupLoading(true)
    try {
      const { error } = await supabase
        .from('schedule_sets')
        .update({ trashed_at: new Date().toISOString() })
        .eq('id', setId)
      if (error) throw error
      showToast(`"${setName}" 휴지통으로 이동됐어요 🗑️`)
      fetchAll()
    } catch (err) { showToast('이동 실패: ' + err.message, 'error') }
    finally { setBackupLoading(false) }
  }

  // -- 휴지통: 복원 (예비 스케줄로 되돌리기) --
  const handleRestoreFromTrash = async (setId, setName) => {
    if (!window.confirm(`"${setName}"을 예비 스케줄로 복원할까요?`)) return
    setTrashLoading(true)
    try {
      const { error } = await supabase
        .from('schedule_sets')
        .update({ trashed_at: null })
        .eq('id', setId)
      if (error) throw error
      showToast(`"${setName}" 예비 스케줄로 복원됐어요 ✅`)
      fetchAll()
    } catch (err) { showToast('복원 실패: ' + err.message, 'error') }
    finally { setTrashLoading(false) }
  }

  // -- 휴지통: 영구 삭제 --
  const handlePermanentDelete = async (setId, setName) => {
    if (!window.confirm(`"${setName}"을 영구 삭제할까요?\n이 작업은 되돌릴 수 없어요.`)) return
    setTrashLoading(true)
    try {
      const { error: ie } = await supabase.from('schedule_set_items').delete().eq('set_id', setId)
      if (ie) throw ie
      const { error: se } = await supabase.from('schedule_sets').delete().eq('id', setId)
      if (se) throw se
      showToast(`"${setName}" 영구 삭제 완료`)
      fetchAll()
    } catch (err) { showToast('삭제 실패: ' + err.message, 'error') }
    finally { setTrashLoading(false) }
  }

  // -- 예비 스케줄: 직접 편집 열기 --
  const handleOpenBackupEdit = async (bset) => {
    setEditingBackupSet(bset)
    setBackupEditName(bset ? bset.name : '')
    setBackupEditLoading(true)
    setIsBackupEditOpen(true)

    // [버그 수정] 기존 백업의 slots_config가 있으면 그것을 사용, 없으면 현재 전역 설정 사용
    if (bset?.slots_config) {
      setBackupDaySlots({ ...DEFAULT_SLOT_CONFIG, ...bset.slots_config })
    } else {
      setBackupDaySlots({ ...slotConfig })
    }

    let initialItems = {}
    // 현재 재원생 기반으로 초기화
    // [버그 수정] 기존에 mon_slots 등을 항상 [] 로 초기화하던 것을 현재 스케줄 슬롯으로 채움
    for (const stu of students) {
      const existing = schedules.find(s => s.student_id === stu.id)
      initialItems[stu.id] = {
        seat_number:     existing?.seat_number || stu.seat_number || '',
        membership_type: existing?.membership_type || '풀',
        mon_slots: existing?.mon_slots || [],
        tue_slots: existing?.tue_slots || [],
        wed_slots: existing?.wed_slots || [],
        thu_slots: existing?.thu_slots || [],
        fri_slots: existing?.fri_slots || [],
        sat_slots: existing?.sat_slots || [],
        sun_slots: existing?.sun_slots || [],
      }
    }

    if (bset) {
      // 기존 예비 스케줄 아이템 불러오기
      // [버그 수정] error도 함께 받아서 실패 시 토스트 표시
      const { data: items, error: fetchErr } = await supabase
        .from('schedule_set_items').select('*').eq('set_id', bset.id)
      if (fetchErr) {
        showToast('예비 스케줄 데이터 로드 실패: ' + fetchErr.message, 'error')
      } else if (items && items.length > 0) {
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
        // 기존 세트 이름 + 교시수 업데이트
        const { error } = await supabase
          .from('schedule_sets')
          .update({ name: backupEditName.trim(), slots_config: backupDaySlots })
          .eq('id', editingBackupSet.id)
        if (error) throw error
        setId = editingBackupSet.id
        // 기존 아이템 전부 삭제 후 재삽입
        await supabase.from('schedule_set_items').delete().eq('set_id', setId)
      } else {
        // 새 세트 생성 (교시수 포함)
        const { data: newSet, error } = await supabase
          .from('schedule_sets')
          .insert({ name: backupEditName.trim(), slots_config: backupDaySlots })
          .select().single()
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
            { key:'trash',   label:'🗑️ 휴지통', count: trashSets.length },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              padding:'8px 20px', borderRadius:'10px', fontSize:'13px', fontWeight:600,
              cursor:'pointer', border:'none', transition:'all 0.15s',
              background: activeTab === tab.key ? '#fff'     : 'transparent',
              color:       activeTab === tab.key ? '#6366F1' : '#64748B',
              boxShadow:   activeTab === tab.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              display:'flex', alignItems:'center', gap:'6px',
            }}>
              {tab.label}
              {tab.count != null && tab.count > 0 && (
                <span style={{
                  padding:'1px 7px', borderRadius:'999px', fontSize:'11px', fontWeight:700,
                  background: activeTab === tab.key ? '#EEF2FF' : '#E2E8F0',
                  color: activeTab === tab.key ? '#6366F1' : '#94A3B8',
                }}>{tab.count}</span>
              )}
            </button>
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
                            {/* 스케줄 좌석번호 우선, 없으면 학생 좌석번호 자동 반영 */}
                            {(schedule?.seat_number || student.seat_number)
                              ? <span style={{
                                  display:'inline-flex', alignItems:'center', justifyContent:'center',
                                  width:'26px', height:'26px', borderRadius:'8px',
                                  background:'#EEF2FF', color:'#6366F1', fontSize:'12px', fontWeight:700,
                                }}>{schedule?.seat_number || student.seat_number}</span>
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
                        onClick={() => handleLoadBackup(bset.id, bset.name, bset.slots_config)}
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
                      ><Trash2 size={13} /> 휴지통</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --
            휴지통 탭
        -- */}
        {activeTab === 'trash' && (
          <div>
            {/* 안내 배너 */}
            <div style={{
              display:'flex', alignItems:'center', gap:'12px',
              padding:'14px 18px', borderRadius:'14px', marginBottom:'20px',
              background:'#FFF7ED', border:'1px solid #FED7AA',
            }}>
              <span style={{ fontSize:'20px' }}>🗑️</span>
              <div>
                <p style={{ fontSize:'13px', fontWeight:700, color:'#92400E', margin:0 }}>
                  스케줄 휴지통
                </p>
                <p style={{ fontSize:'12px', color:'#B45309', margin:'3px 0 0' }}>
                  예비 스케줄을 삭제하거나 "불러오기"를 쓸 때 여기에 자동 저장돼요.
                  복원하면 <strong>예비 스케줄 관리</strong>로 되돌아가요.
                  휴지통에 들어온 날로부터 <strong>60일 후 자동 삭제</strong>됩니다.
                </p>
              </div>
            </div>

            {trashSets.length === 0 ? (
              <div style={{
                textAlign:'center', padding:'64px',
                background:'#fff', borderRadius:'16px', border:'1px solid #E2E8F0',
              }}>
                <p style={{ fontSize:'40px', marginBottom:'12px' }}>🗑️</p>
                <p style={{ fontWeight:600, color:'#64748B', fontSize:'15px' }}>휴지통이 비어있어요</p>
                <p style={{ fontSize:'13px', color:'#94A3B8', marginTop:'4px' }}>
                  예비 스케줄을 삭제하거나 불러오기를 하면 자동으로 저장돼요
                </p>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                {trashSets.map(tset => {
                  // 남은 일수 계산
                  const trashedAt = new Date(tset.trashed_at)
                  const expireAt  = new Date(trashedAt.getTime() + 60 * 24 * 60 * 60 * 1000)
                  const daysLeft  = Math.ceil((expireAt - new Date()) / (24 * 60 * 60 * 1000))
                  const isWarning = daysLeft <= 7

                  return (
                    <div key={tset.id} style={{
                      display:'flex', alignItems:'center', justifyContent:'space-between',
                      padding:'18px 22px', borderRadius:'14px',
                      background:'#fff', border:`1.5px solid ${isWarning ? '#FED7AA' : '#E2E8F0'}`,
                      boxShadow:'0 1px 4px rgba(0,0,0,0.04)',
                    }}>
                      <div>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
                          <p style={{ fontSize:'15px', fontWeight:700, color:'#0F172A', margin:0 }}>{tset.name}</p>
                          {isWarning && (
                            <span style={{
                              padding:'2px 8px', borderRadius:'999px', fontSize:'10px', fontWeight:700,
                              background:'#FFEDD5', color:'#C2410C', border:'1px solid #FED7AA',
                            }}>⚠️ {daysLeft}일 후 삭제</span>
                          )}
                        </div>
                        <p style={{ fontSize:'12px', color:'#94A3B8', margin:0 }}>
                          삭제일: {trashedAt.toLocaleDateString('ko-KR', {
                            year:'numeric', month:'long', day:'numeric',
                            hour:'2-digit', minute:'2-digit',
                          })}
                          {' · '}
                          <span style={{ color: isWarning ? '#C2410C' : '#94A3B8' }}>
                            {daysLeft > 0 ? `${daysLeft}일 후 자동 삭제` : '오늘 삭제됩니다'}
                          </span>
                        </p>
                      </div>
                      <div style={{ display:'flex', gap:'8px' }}>
                        <button
                          onClick={() => handleRestoreFromTrash(tset.id, tset.name)}
                          disabled={trashLoading}
                          style={{
                            display:'flex', alignItems:'center', gap:'6px',
                            padding:'8px 14px', borderRadius:'10px',
                            border:'1.5px solid #A7F3D0', background:'#ECFDF5',
                            color:'#059669', fontSize:'12px', fontWeight:700,
                            cursor: trashLoading ? 'not-allowed' : 'pointer',
                            opacity: trashLoading ? 0.6 : 1,
                          }}
                        ><RotateCcw size={13} /> 복원</button>
                        <button
                          onClick={() => handlePermanentDelete(tset.id, tset.name)}
                          disabled={trashLoading}
                          style={{
                            display:'flex', alignItems:'center', gap:'6px',
                            padding:'8px 14px', borderRadius:'10px',
                            border:'1.5px solid #FECACA', background:'#FEF2F2',
                            color:'#EF4444', fontSize:'12px', fontWeight:700,
                            cursor: trashLoading ? 'not-allowed' : 'pointer',
                            opacity: trashLoading ? 0.6 : 1,
                          }}
                        ><Trash size={13} /> 영구삭제</button>
                      </div>
                    </div>
                  )
                })}
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

      {/* -- 모달: 예비 스케줄 직접 편집 (전체화면 테이블) -- */}
      {isBackupEditOpen && (
        <div style={{
          position:'fixed', inset:0,
          display:'flex', flexDirection:'column', zIndex:60, overflow:'hidden',
          background:'#0F172A',
        }}>
          {/* 헤더 */}
          <div style={{
            background:'linear-gradient(135deg,#1E1B4B,#312E81)',
            padding:'0 24px', display:'flex', alignItems:'center', gap:'16px',
            height:'58px', flexShrink:0,
            boxShadow:'0 4px 16px rgba(0,0,0,0.3)',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', flex:1, minWidth:0 }}>
              <div style={{
                width:'32px', height:'32px', borderRadius:'8px', flexShrink:0,
                background:'rgba(165,180,252,0.2)',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                <Edit2 size={16} style={{ color:'#A5B4FC' }} />
              </div>
              <div style={{ minWidth:0 }}>
                <p style={{ fontSize:'10px', color:'#818CF8', margin:0, fontWeight:700, letterSpacing:'0.08em' }}>
                  예비 스케줄 직접 편집
                </p>
                <input
                  value={backupEditName}
                  onChange={e => setBackupEditName(e.target.value)}
                  placeholder="예비 스케줄 이름을 입력하세요 (필수)"
                  style={{
                    fontSize:'15px', fontWeight:700, color:'#fff',
                    border:'none', outline:'none', background:'transparent',
                    borderBottom:'1.5px solid rgba(165,180,252,0.4)',
                    width:'320px', padding:'1px 0',
                  }}
                />
              </div>
              <span style={{ fontSize:'12px', color:'#64748B', flexShrink:0, marginLeft:'8px' }}>
                재원생 {students.length}명
              </span>
            </div>
            <div style={{ display:'flex', gap:'8px', flexShrink:0 }}>
              <button onClick={() => setIsBackupEditOpen(false)} style={{
                padding:'8px 16px', borderRadius:'8px',
                border:'1px solid rgba(255,255,255,0.15)', background:'rgba(255,255,255,0.08)',
                color:'#94A3B8', fontSize:'13px', fontWeight:600, cursor:'pointer',
              }}>취소</button>
              <button onClick={handleSaveBackupEdit} disabled={backupEditLoading} style={{
                display:'flex', alignItems:'center', gap:'6px',
                padding:'8px 20px', borderRadius:'8px', border:'none',
                background: backupEditLoading ? '#4F46E5' : 'linear-gradient(135deg,#7C3AED,#6366F1)',
                color:'#fff', fontSize:'13px', fontWeight:700, cursor: backupEditLoading ? 'not-allowed' : 'pointer',
                boxShadow:'0 4px 14px rgba(99,102,241,0.4)',
                opacity: backupEditLoading ? 0.7 : 1,
              }}>
                <Save size={13} /> {backupEditLoading ? '저장 중...' : '저장 완료'}
              </button>
            </div>
          </div>

          {/* 안내 배너 */}
          <div style={{
            padding:'8px 24px', background:'#1E293B',
            borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0,
          }}>
            <p style={{ fontSize:'12px', color:'#64748B', margin:0 }}>
              각 학생의 요일별 교시 버튼을 눌러 스케줄을 설정하세요. 파란색 = 선택됨. 저장 후 "불러오기"로 현재 스케줄에 적용할 수 있어요.
            </p>
          </div>

          {/* 테이블 본문 */}
          {backupEditLoading ? (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#475569', fontSize:'14px' }}>
              불러오는 중...
            </div>
          ) : (
            <div style={{ flex:1, overflowY:'auto', overflowX:'auto' }}>
              <table style={{ borderCollapse:'separate', borderSpacing:0, minWidth:'100%' }}>

                {/* 고정 헤더 행 */}
                <thead style={{ position:'sticky', top:0, zIndex:20 }}>
                  <tr>
                    <th style={{
                      position:'sticky', left:0, zIndex:30,
                      background:'#1E293B', color:'#64748B',
                      fontSize:'11px', fontWeight:700, letterSpacing:'0.06em',
                      padding:'10px 20px', textAlign:'left', whiteSpace:'nowrap',
                      borderRight:'1px solid rgba(255,255,255,0.08)',
                      borderBottom:'1px solid rgba(255,255,255,0.08)',
                      width:'160px', minWidth:'160px',
                    }}>학생</th>
                    <th style={{
                      background:'#1E293B', color:'#64748B',
                      fontSize:'11px', fontWeight:700,
                      padding:'10px 12px', textAlign:'center', whiteSpace:'nowrap',
                      borderRight:'1px solid rgba(255,255,255,0.08)',
                      borderBottom:'1px solid rgba(255,255,255,0.08)',
                      width:'100px', minWidth:'100px',
                    }}>재원구분</th>
                    {backupDayConfig.map(day => (
                      <th key={day.key} style={{
                        background:'#1E293B',
                        fontSize:'11px', fontWeight:700,
                        padding:'10px 16px', textAlign:'center', whiteSpace:'nowrap',
                        borderRight:'1px solid rgba(255,255,255,0.05)',
                        borderBottom:'1px solid rgba(255,255,255,0.04)',
                        minWidth:'130px',
                        color: day.color,
                      }}>
                        {day.label}요일
                      </th>
                    ))}
                  </tr>
                  {/* 교시 수 설정 행 */}
                  <tr>
                    <th style={{
                      position:'sticky', left:0, zIndex:30,
                      background:'#162032', padding:'6px 20px', textAlign:'left',
                      borderRight:'1px solid rgba(255,255,255,0.08)',
                      borderBottom:'1px solid rgba(255,255,255,0.1)',
                    }}>
                      <span style={{ fontSize:'10px', color:'#334155', fontWeight:700, letterSpacing:'0.05em' }}>교시 수</span>
                    </th>
                    <th style={{
                      background:'#162032',
                      borderRight:'1px solid rgba(255,255,255,0.08)',
                      borderBottom:'1px solid rgba(255,255,255,0.1)',
                    }}></th>
                    {backupDayConfig.map(day => (
                      <th key={day.key+'_ctrl'} style={{
                        background:'#162032',
                        padding:'5px 12px', textAlign:'center',
                        borderRight:'1px solid rgba(255,255,255,0.04)',
                        borderBottom:'1px solid rgba(255,255,255,0.1)',
                      }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'6px' }}>
                          <button
                            onClick={() => setBackupDaySlots(p => ({ ...p, [day.cfgKey]: Math.max(1, (p[day.cfgKey]||5)-1) }))}
                            style={{
                              width:'20px', height:'20px', borderRadius:'4px', border:'none',
                              background:'rgba(255,255,255,0.08)', color:'#94A3B8',
                              fontSize:'14px', cursor:'pointer', li