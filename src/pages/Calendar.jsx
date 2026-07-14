import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import { createClient } from '@supabase/supabase-js'
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, X, Trash2, Edit2, Tag
} from 'lucide-react'
import { getHolidayName } from '../lib/koreanHolidays'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// -- 일정 카테고리 정의 ----
const CATEGORIES = [
  { value: 'vacation',  label: '방학',    color: '#F59E0B', bg: '#FFF7ED', border: '#FDE68A' },
  { value: 'academic',  label: '학사일정', color: '#6366F1', bg: '#EEF2FF', border: '#C7D2FE' },
  { value: 'exam',      label: '시험',    color: '#EF4444', bg: '#FEF2F2', border: '#FECACA' },
  { value: 'event',     label: '행사',    color: '#10B981', bg: '#ECFDF5', border: '#A7F3D0' },
  { value: 'holiday',   label: '공휴일',  color: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE' },
  { value: 'other',     label: '기타',    color: '#64748B', bg: '#F8FAFC', border: '#E2E8F0' },
]

const getCat = (value) => CATEGORIES.find(c => c.value === value) || CATEGORIES[5]

const EVENT_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308',
  '#10B981', '#06B6D4', '#6366F1', '#8B5CF6',
  '#EC4899', '#64748B',
]

const getEventColor = (evt) => evt.color || getCat(evt.category).color

const DAYS_KR = ['일', '월', '화', '수', '목', '금', '토']
const MONTHS_KR = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

// YYYY-MM-DD 파싱 (로컬 타임존)
const parseLocalDate = (str) => {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// 날짜를 YYYY-MM-DD 문자열로
const toDateStr = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// 해당 월의 첫날 ~ 마지막날 달력 그리드 생성
const buildCalendarGrid = (year, month) => {
  const firstDay = new Date(year, month, 1)
  const lastDay  = new Date(year, month + 1, 0)
  const startDow = firstDay.getDay() // 0=일
  const days = []

  // 이전 달 빈 칸
  for (let i = 0; i < startDow; i++) {
    const d = new Date(year, month, -startDow + i + 1)
    days.push({ date: d, currentMonth: false })
  }
  // 이번 달
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push({ date: new Date(year, month, d), currentMonth: true })
  }
  // 다음 달 빈 칸 (6줄 맞추기)
  const remain = 42 - days.length
  for (let d = 1; d <= remain; d++) {
    days.push({ date: new Date(year, month + 1, d), currentMonth: false })
  }
  return days
}

const EMPTY_FORM = {
  title: '', category: 'vacation', start_date: '', end_date: '', description: '', color: ''
}

export default function Calendar() {
  const today = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [events,   setEvents]   = useState([])
  const [loading,  setLoading]  = useState(false)
  const [modalOpen,   setModalOpen]   = useState(false)
  const [editingEvt,  setEditingEvt]  = useState(null)
  const [form,        setForm]        = useState({ ...EMPTY_FORM })
  const [selectedDay, setSelectedDay] = useState(null) // 날짜 클릭 시 상세
  const [toast,       setToast]       = useState(null)
  const [catFilter,   setCatFilter]   = useState('all')

  const grid = buildCalendarGrid(year, month)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  // Supabase에서 일정 불러오기
  const fetchEvents = useCallback(async () => {
    setLoading(true)
    const firstOfMonth = toDateStr(new Date(year, month, 1))
    const lastOfMonth  = toDateStr(new Date(year, month + 1, 0))
    // 해당 월에 걸쳐있는 일정 모두 불러오기
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .lte('start_date', lastOfMonth)
      .gte('end_date',   firstOfMonth)
      .order('start_date')
    if (!error && data) setEvents(data)
    setLoading(false)
  }, [year, month])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
    setSelectedDay(null)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
    setSelectedDay(null)
  }
  const goToday = () => {
    setYear(today.getFullYear()); setMonth(today.getMonth())
    setSelectedDay(null)
  }

  // 특정 날짜에 해당하는 이벤트 목록
  const eventsOnDate = (dateStr) =>
    events.filter(e => e.start_date <= dateStr && e.end_date >= dateStr)

  // 모달 열기 (신규)
  const openNew = (dateStr = '') => {
    setEditingEvt(null)
    setForm({ ...EMPTY_FORM, start_date: dateStr, end_date: dateStr })
    setModalOpen(true)
  }

  // 모달 열기 (수정)
  const openEdit = (evt) => {
    setEditingEvt(evt)
    setForm({
      title:       evt.title || '',
      category:    evt.category || 'vacation',
      start_date:  evt.start_date || '',
      end_date:    evt.end_date   || '',
      description: evt.description || '',
      color:       evt.color || '',
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.title.trim())      { showToast('일정 제목을 입력해주세요', 'error'); return }
    if (!form.start_date)        { showToast('시작일을 입력해주세요',   'error'); return }
    if (!form.end_date)          { showToast('종료일을 입력해주세요',   'error'); return }
    if (form.end_date < form.start_date) { showToast('종료일이 시작일보다 앞서요', 'error'); return }

    const payload = {
      title:       form.title.trim(),
      category:    form.category,
      start_date:  form.start_date,
      end_date:    form.end_date,
      description: form.description.trim(),
      color:       form.color || null,
    }

    let error
    if (editingEvt) {
      ;({ error } = await supabase.from('calendar_events').update(payload).eq('id', editingEvt.id))
      if (!error) showToast('일정이 수정됐어요 ✏️')
    } else {
      ;({ error } = await supabase.from('calendar_events').insert(payload))
      if (!error) showToast('일정이 등록됐어요 📅')
    }

    if (error) { showToast('저장 중 오류가 발생했어요', 'error'); return }
    setModalOpen(false)
    fetchEvents()
  }

  const handleDelete = async (id) => {
    if (!window.confirm('이 일정을 삭제할까요?')) return
    const { error } = await supabase.from('calendar_events').delete().eq('id', id)
    if (error) { showToast('삭제 중 오류가 발생했어요', 'error'); return }
    showToast('일정이 삭제됐어요 🗑️')
    setSelectedDay(null)
    fetchEvents()
  }

  // 필터된 이벤트
  const filteredEvents = catFilter === 'all'
    ? events
    : events.filter(e => e.category === catFilter)

  // 이번 달 이벤트만 (사이드 리스트용)
  const firstOfMonth = toDateStr(new Date(year, month, 1))
  const lastOfMonth  = toDateStr(new Date(year, month + 1, 0))
  const monthEvents = filteredEvents
    .filter(e => e.start_date <= lastOfMonth && e.end_date >= firstOfMonth)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))

  const todayStr = toDateStr(today)

  return (
    <Layout>
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

        {/* 왼쪽: 달력 영역 */}
        <div style={{ flex: 1, padding: '28px 24px', overflowY: 'auto', minWidth: 0 }}>

          {/* 헤더 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '46px', height: '46px', borderRadius: '14px', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CalendarDays size={22} style={{ color: '#6366F1' }} />
              </div>
              <div>
                <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0F172A', margin: 0 }}>학사 캘린더</h1>
                <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '3px' }}>방학 · 학사일정 · 시험 등을 등록하세요</p>
              </div>
            </div>
            <button
              onClick={() => openNew(todayStr)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 18px', borderRadius: '12px', border: 'none',
                background: 'linear-gradient(135deg,#6366F1,#7C3AED)',
                color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(99,102,241,0.3)',
              }}
            >
              <Plus size={15} /> 일정 추가
            </button>
          </div>

          {/* 카테고리 필터 */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <button
              onClick={() => setCatFilter('all')}
              style={{
                padding: '5px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                border: catFilter === 'all' ? '1.5px solid #6366F1' : '1.5px solid #E2E8F0',
                background: catFilter === 'all' ? '#EEF2FF' : '#fff',
                color: catFilter === 'all' ? '#6366F1' : '#64748B',
              }}
            >전체</button>
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setCatFilter(catFilter === cat.value ? 'all' : cat.value)}
                style={{
                  padding: '5px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  border: catFilter === cat.value ? `1.5px solid ${cat.color}` : '1.5px solid #E2E8F0',
                  background: catFilter === cat.value ? cat.bg : '#fff',
                  color: catFilter === cat.value ? cat.color : '#64748B',
                }}
              >{cat.label}</button>
            ))}
          </div>

          {/* 월 이동 */}
          <div style={{
            background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: '1px solid #F1F5F9',
            }}>
              <button onClick={prevMonth} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1.5px solid #E2E8F0', background: '#F8FAFC', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ChevronLeft size={16} style={{ color: '#64748B' }} />
              </button>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A' }}>{year}년 {MONTHS_KR[month]}</span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={goToday} style={{ padding: '6px 12px', borderRadius: '8px', border: '1.5px solid #E2E8F0', background: '#F8FAFC', fontSize: '12px', fontWeight: 600, color: '#64748B', cursor: 'pointer' }}>오늘</button>
                <button onClick={nextMonth} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1.5px solid #E2E8F0', background: '#F8FAFC', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ChevronRight size={16} style={{ color: '#64748B' }} />
                </button>
              </div>
            </div>

            {/* 요일 헤더 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '1px solid #F1F5F9' }}>
              {DAYS_KR.map((d, i) => (
                <div key={d} style={{
                  textAlign: 'center', padding: '10px 4px', fontSize: '11px', fontWeight: 700,
                  letterSpacing: '0.04em',
                  color: i === 0 ? '#EF4444' : i === 6 ? '#3B82F6' : '#64748B',
                }}>{d}</div>
              ))}
            </div>

            {/* 날짜 그리드 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
              {grid.map((cell, idx) => {
                const ds = toDateStr(cell.date)
                const dow = cell.date.getDay()
                const isToday  = ds === todayStr
                const isSelected = selectedDay === ds
                const dayEvents = eventsOnDate(ds).filter(e => catFilter === 'all' || e.category === catFilter)

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedDay(isSelected ? null : ds)}
                    style={{
                      minHeight: '88px', padding: '6px 6px 4px', cursor: 'pointer',
                      borderRight: (idx + 1) % 7 === 0 ? 'none' : '1px solid #F1F5F9',
                      borderBottom: idx < 35 ? '1px solid #F1F5F9' : 'none',
                      background: isSelected ? '#EEF2FF' : 'transparent',
                      transition: 'background 0.1s',
                      opacity: cell.currentMonth ? 1 : 0.38,
                    }}
                  >
                    {/* 날짜 숫자 */}
                    {(() => {
                      const holiday = getHolidayName(ds)
                      const isHoliday = !!holiday
                      const numColor = isToday ? '#fff' : (isHoliday || dow === 0) ? '#EF4444' : dow === 6 ? '#3B82F6' : '#0F172A'
                      return (
                        <div style={{ marginBottom: '2px' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: holiday ? '2px' : '4px' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: '26px', height: '26px', borderRadius: '50%',
                              fontSize: '13px', fontWeight: isToday ? 800 : 500,
                              background: isToday ? '#6366F1' : 'transparent',
                              color: numColor,
                            }}>
                              {cell.date.getDate()}
                            </span>
                          </div>
                          {holiday && (
                            <div style={{
                              fontSize: '9px', fontWeight: 700, color: '#EF4444',
                              background: '#FEF2F2', borderRadius: '3px',
                              padding: '1px 4px', textAlign: 'center',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                              marginBottom: '2px',
                            }}>
                              {holiday}
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    {/* 이벤트 바 (최대 2개 표시, 나머지 +N) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {dayEvents.slice(0, 2).map(evt => {
                        const cat = getCat(evt.category)
                        // 이벤트 시작일이 오늘인지 또는 월의 첫날인지 (바 시작 표시)
                        const isStart = evt.start_date === ds || ds === firstOfMonth
                        const isEnd   = evt.end_date   === ds || ds === lastOfMonth
                        return (
                          <div
                            key={evt.id}
                            title={evt.title}
                            style={{
                              background: getEventColor(evt),
                              color: '#fff',
                              fontSize: '10px', fontWeight: 600,
                              padding: '2px 5px',
                              borderRadius: isStart
                                ? (isEnd ? '4px' : '4px 0 0 4px')
                                : (isEnd ? '0 4px 4px 0' : '0'),
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                              marginLeft: isStart ? '0' : '-6px',
                              marginRight: isEnd   ? '0' : '-6px',
                              paddingLeft: isStart ? '5px' : '0',
                              paddingRight: isEnd  ? '5px' : '0',
                            }}
                          >
                            {isStart ? evt.title : ''}
                          </div>
                        )
                      })}
                      {dayEvents.length > 2 && (
                        <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, paddingLeft: '4px' }}>
                          +{dayEvents.length - 2}개
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 선택된 날 상세 */}
          {selectedDay && (() => {
            const dayEvts = eventsOnDate(selectedDay)
            const d = parseLocalDate(selectedDay)
            const dow = d.getDay()
            return (
              <div style={{
                marginTop: '16px', background: '#fff', borderRadius: '16px',
                border: '1px solid #E2E8F0', padding: '20px 24px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                      {d.getFullYear()}년 {d.getMonth() + 1}월 {d.getDate()}일 ({DAYS_KR[dow]})
                    </h3>
                    {getHolidayName(selectedDay) && (
                      <span style={{
                        display: 'inline-block', marginTop: '4px',
                        fontSize: '12px', fontWeight: 700, color: '#EF4444',
                        background: '#FEF2F2', padding: '2px 8px', borderRadius: '6px',
                        border: '1px solid #FECACA',
                      }}>
                        {getHolidayName(selectedDay)}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => openNew(selectedDay)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '5px',
                        padding: '7px 14px', borderRadius: '10px', border: 'none',
                        background: '#EEF2FF', color: '#6366F1', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                      }}
                    ><Plus size={13} /> 이 날 일정 추가</button>
                    <button onClick={() => setSelectedDay(null)} style={{ width: '30px', height: '30px', borderRadius: '8px', border: '1.5px solid #E2E8F0', background: '#F8FAFC', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <X size={14} style={{ color: '#94A3B8' }} />
                    </button>
                  </div>
                </div>
                {dayEvts.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#94A3B8', textAlign: 'center', padding: '20px 0' }}>이 날은 등록된 일정이 없어요</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {dayEvts.map(evt => {
                      const cat = getCat(evt.category)
                      return (
                        <div key={evt.id} style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          padding: '12px 16px', borderRadius: '12px',
                          background: cat.bg, border: `1px solid ${evt.color || cat.border}`,
                        }}>
                          <div style={{ width: '4px', height: '36px', borderRadius: '2px', background: getEventColor(evt), flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{evt.title}</span>
                              <span style={{
                                padding: '2px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 700,
                                background: getEventColor(evt), color: '#fff',
                              }}>{cat.label}</span>
                            </div>
                            <p style={{ fontSize: '12px', color: '#64748B', margin: '3px 0 0' }}>
                              {evt.start_date === evt.end_date
                                ? evt.start_date
                                : `${evt.start_date} ~ ${evt.end_date}`}
                            </p>
                            {evt.description && (
                              <p style={{ fontSize: '12px', color: '#94A3B8', margin: '4px 0 0' }}>{evt.description}</p>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                            <button onClick={() => openEdit(evt)} style={{ width: '30px', height: '30px', borderRadius: '8px', border: '1.5px solid #E2E8F0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Edit2 size={13} style={{ color: '#64748B' }} />
                            </button>
                            <button onClick={() => handleDelete(evt.id)} style={{ width: '30px', height: '30px', borderRadius: '8px', border: '1.5px solid #FECACA', background: '#FEF2F2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Trash2 size={13} style={{ color: '#EF4444' }} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })()}
        </div>

        {/* 오른쪽: 이번 달 일정 목록 */}
        <div style={{
          width: '300px', flexShrink: 0, borderLeft: '1px solid #E2E8F0',
          background: '#F8FAFC', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{ padding: '20px 18px 14px', borderBottom: '1px solid #E2E8F0', flexShrink: 0 }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
              {year}년 {MONTHS_KR[month]} 일정
            </h3>
            <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '3px' }}>
              {monthEvents.length}개의 일정
            </p>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            {/* 이번 달 공휴일 */}
            {(() => {
              const monthHolidays = []
              const daysInMonth = new Date(year, month + 1, 0).getDate()
              for (let d = 1; d <= daysInMonth; d++) {
                const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
                const name = getHolidayName(ds)
                if (name) monthHolidays.push({ date: ds, name })
              }
              if (monthHolidays.length === 0) return null
              return (
                <div style={{ marginBottom: '12px', padding: '10px', background: '#FEF2F2', borderRadius: '10px', border: '1px solid #FECACA' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: '#DC2626', marginBottom: '6px', letterSpacing: '0.04em' }}>
                    이번 달 공휴일 ({monthHolidays.length}일)
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {monthHolidays.map(h => (
                      <div key={h.date} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#EF4444', fontWeight: 700, minWidth: '36px' }}>
                          {h.date.slice(5).replace('-', '/')}
                        </span>
                        <span style={{ fontSize: '11px', color: '#7F1D1D' }}>{h.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
            {loading ? (
              <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: '13px', padding: '40px 0' }}>불러오는 중...</p>
            ) : monthEvents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <p style={{ fontSize: '32px', marginBottom: '8px' }}>📭</p>
                <p style={{ fontSize: '13px', color: '#94A3B8' }}>이번 달 일정이 없어요</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {monthEvents.map(evt => {
                  const cat = getCat(evt.category)
                  const isMultiDay = evt.start_date !== evt.end_date
                  return (
                    <div
                      key={evt.id}
                      onClick={() => { openEdit(evt) }}
                      style={{
                        padding: '12px 14px', borderRadius: '12px', cursor: 'pointer',
                        background: '#fff', border: `1.5px solid ${evt.color || cat.border}`,
                        transition: 'box-shadow 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)' }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: getEventColor(evt), flexShrink: 0 }} />
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {evt.title}
                        </span>
                        <span style={{
                          padding: '1px 6px', borderRadius: '999px', fontSize: '10px', fontWeight: 700,
                          background: cat.bg, color: cat.color, flexShrink: 0,
                        }}>{cat.label}</span>
                      </div>
                      <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0, paddingLeft: '14px' }}>
                        {isMultiDay ? `${evt.start_date} ~ ${evt.end_date}` : evt.start_date}
                      </p>
                      {evt.description && (
                        <p style={{ fontSize: '11px', color: '#64748B', margin: '4px 0 0', paddingLeft: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {evt.description}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {modalOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}
          onClick={() => setModalOpen(false)}
        >
          <div
            style={{ background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '460px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                {editingEvt ? '일정 수정' : '새 일정 추가'}
              </h2>
              <button onClick={() => setModalOpen(false)} style={{ width: '32px', height: '32px', borderRadius: '10px', border: 'none', background: '#F1F5F9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} style={{ color: '#64748B' }} />
              </button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* 제목 */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '6px' }}>일정 제목 *</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="예) 여름방학, 1학기 기말고사..."
                  autoFocus
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #E2E8F0', fontSize: '14px', outline: 'none', boxSizing: 'border-box', color: '#0F172A' }}
                  onFocus={e => { e.target.style.borderColor = '#6366F1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' }}
                  onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none' }}
                />
              </div>

              {/* 카테고리 */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '8px' }}>
                  <Tag size={12} style={{ display: 'inline', marginRight: '4px' }} />카테고리
                </label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {CATEGORIES.map(cat => {
                    const active = form.category === cat.value
                    return (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, category: cat.value }))}
                        style={{
                          padding: '6px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                          border: active ? `2px solid ${cat.color}` : '1.5px solid #E2E8F0',
                          background: active ? cat.bg : '#F8FAFC',
                          color: active ? cat.color : '#64748B',
                          transition: 'all 0.12s',
                        }}
                      >{cat.label}</button>
                    )
                  })}
                </div>
              </div>

              {/* 표시 색상 선택 */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '8px' }}>
                  표시 색상 (선택) — 카테고리와 별도로 색상을 지정해 구분하세요
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {EVENT_COLORS.map(c => {
                    const active = form.color === c
                    return (
                      <button key={c} type="button"
                        onClick={() => setForm(f => ({ ...f, color: f.color === c ? '' : c }))}
                        style={{
                          width: '32px', height: '32px', borderRadius: '50%',
                          background: c, cursor: 'pointer',
                          border: active ? '3px solid #0F172A' : '2px solid #fff',
                          boxShadow: active
                            ? `0 0 0 2px ${c}, 0 3px 10px ${c}80`
                            : '0 1px 4px rgba(0,0,0,0.2)',
                          transition: 'all 0.12s',
                          transform: active ? 'scale(1.2)' : 'scale(1)',
                        }}
                        title={c}
                      />
                    )
                  })}
                  {form.color && (
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, color: '' }))}
                      style={{
                        padding: '5px 12px', borderRadius: '8px',
                        border: '1px solid #E2E8F0', background: '#F8FAFC',
                        color: '#64748B', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                      }}>초기화</button>
                  )}
                </div>
                {form.color && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                    <div style={{ width: '14px', height: '14px', borderRadius: '4px', background: form.color, flexShrink: 0 }} />
                    <span style={{ fontSize: '11px', color: '#64748B' }}>이 색상으로 캘린더에 표시됩니다</span>
                  </div>
                )}
              </div>

              {/* 날짜 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '6px' }}>시작일 *</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={e => {
                      const v = e.target.value
                      setForm(f => ({ ...f, start_date: v, end_date: f.end_date < v ? v : f.end_date }))
                    }}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #E2E8F0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', color: '#0F172A' }}
                    onFocus={e => { e.target.style.borderColor = '#6366F1' }}
                    onBlur={e => { e.target.style.borderColor = '#E2E8F0' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '6px' }}>종료일 *</label>
                  <input
                    type="date"
                    value={form.end_date}
                    min={form.start_date}
                    onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #E2E8F0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', color: '#0F172A' }}
                    onFocus={e => { e.target.style.borderColor = '#6366F1' }}
                    onBlur={e => { e.target.style.borderColor = '#E2E8F0' }}
                  />
                </div>
              </div>

              {/* 설명 */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '6px' }}>설명 (선택)</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="추가 메모를 입력하세요"
                  rows={3}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #E2E8F0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', resize: 'vertical', color: '#0F172A', fontFamily: 'inherit' }}
                  onFocus={e => { e.target.style.borderColor = '#6366F1' }}
                  onBlur={e => { e.target.style.borderColor = '#E2E8F0' }}
                />
              </div>
            </div>

            {/* 하단 버튼 */}
            <div style={{ padding: '0 24px 24px', display: 'flex', gap: '10px' }}>
              {editingEvt && (
                <button
                  onClick={() => handleDelete(editingEvt.id)}
                  style={{ padding: '11px 16px', borderRadius: '12px', border: '1.5px solid #FECACA', background: '#FEF2F2', color: '#EF4444', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Trash2 size={14} /> 삭제
                </button>
              )}
              <button onClick={() => setModalOpen(false)} style={{ flex: 1, padding: '11px', borderRadius: '12px', border: '1.5px solid #E2E8F0', background: '#fff', fontSize: '14px', fontWeight: 600, color: '#64748B', cursor: 'pointer' }}>취소</button>
              <button onClick={handleSave} style={{ flex: 2, padding: '11px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#6366F1,#7C3AED)', fontSize: '14px', fontWeight: 700, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 14px rgba(99,102,241,0.3)' }}>
                {editingEvt ? '수정 완료' : '등록 완료'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 토스트 */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 100,
          padding: '12px 18px', borderRadius: '14px',
          background: toast.type === 'error' ? '#EF4444' : '#10B981',
          color: '#fff', fontSize: '13px', fontWeight: 600,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        }}>
          {toast.msg}
        </div>
      )}
    </Layout>
  )
}
