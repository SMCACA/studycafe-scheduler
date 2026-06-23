import { useState, useEffect, useMemo, useCallback } from 'react'
import Layout from '../components/Layout'
import { createClient } from '@supabase/supabase-js'
import {
  Star, AlertTriangle, Plus, Trash2, Award,
  ChevronLeft, ChevronRight, Calendar, Loader, Settings, X,
} from 'lucide-react'
import { addPoint } from '../lib/addPoint'                             // ✅ RLS 우회해서 점수 저장 (서버 경유)
import { fetchRecentPoints, fetchMonthPoints, deletePoint } from '../lib/pointsApi' // ✅ RLS 우회해서 조회·삭제 (서버 경유)
import { fetchReasons, addReason, deleteReason } from '../lib/pointReasonsApi'       // ✅ 사유 목록도 서버(공용 저장소)에서 가져옴
// ℹ️ 알림톡(카카오 메시지) 발송은 "상벌점 알림톡" 메뉴에서 따로 처리해요.
//    이 페이지(상벌점 관리)는 점수 데이터를 저장·조회·삭제하는 역할만 담당합니다.

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

/* ── 오늘 날짜를 yyyy-MM-dd 문자열로 ── */
const todayStr = () => {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/* ── 해당 월의 1일 / 말일을 yyyy-MM-dd로 ── */
const monthRange = (monthDate) => {
  const y = monthDate.getFullYear()
  const m = monthDate.getMonth()
  const pad = n => String(n).padStart(2, '0')
  const first = `${y}-${pad(m + 1)}-01`
  const lastDay = new Date(y, m + 1, 0).getDate()
  const last = `${y}-${pad(m + 1)}-${pad(lastDay)}`
  return { first, last }
}

const inputStyle = {
  width: '100%', padding: '10px 14px',
  borderRadius: '10px', border: '1.5px solid #E2E8F0',
  fontSize: '13px', outline: 'none', background: '#F8FAFC', color: '#0F172A',
  boxSizing: 'border-box',
}

const typeBadge = (type) =>
  type === '상점'
    ? { bg: '#FFFBEB', color: '#D97706', border: '#FDE68A' }
    : { bg: '#FFF1F2', color: '#E11D48', border: '#FECDD3' }

/* ── 사유 드롭다운 템플릿은 이제 Supabase(공용 저장소)에 저장돼요.
      예전에는 브라우저별 localStorage에 저장돼서 사람마다 다르게 보였는데,
      이제는 모두가 같은 목록을 보게 돼요. ── */

export default function StudentPoints() {
  const [students,  setStudents]  = useState([])
  const [activeTab, setActiveTab] = useState('register') // 'register' | 'monthly'
  const [toast,     setToast]     = useState(null)

  /* ── 점수 등록 폼 상태 ── */
  const [selectedId,  setSelectedId]  = useState('')
  const [type,        setType]        = useState('상점')
  const [points,      setPoints]      = useState('')
  const [reason,      setReason]      = useState('')
  const [recordDate,  setRecordDate]  = useState(todayStr())
  const [saving,      setSaving]      = useState(false)
  const [recent,      setRecent]      = useState([])
  const [recentLoading, setRecentLoading] = useState(false)

  /* ── 사유 드롭다운 관리 상태 ── */
  const [reasonTemplates,    setReasonTemplates]    = useState([])
  const [reasonsLoading,     setReasonsLoading]      = useState(true)   // ✅ 사유 목록 불러오는 중 표시
  const [showReasonManager,  setShowReasonManager]  = useState(false)
  const [newReasonText,      setNewReasonText]      = useState('')
  const [newReasonPoints,    setNewReasonPoints]    = useState('')

  /* ── 월별 조회 상태 ── */
  const [selectedMonth,    setSelectedMonth]    = useState(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [monthRecords,     setMonthRecords]     = useState([])
  const [monthLoading,     setMonthLoading]     = useState(false)
  const [monthStudentFilter, setMonthStudentFilter] = useState('전체')

  const showToast = (msg, t = 'success') => {
    setToast({ msg, t })
    setTimeout(() => setToast(null), 2200)
  }

  /* ── 학생 목록 (재원생만) ── */
  const fetchStudents = useCallback(async () => {
    const { data } = await supabase
      .from('students').select('*').eq('status', '재원생').order('name')
    if (data) setStudents(data)
  }, [])

  /* ── 최근 등록 내역 ── */
  const fetchRecent = useCallback(async () => {
    setRecentLoading(true)
    try {
      const data = await fetchRecentPoints(8)
      setRecent(data)
    } catch (err) {
      showToast('최근 내역 불러오기 실패: ' + err.message, 'error')
    }
    setRecentLoading(false)
  }, [])

  /* ── 월별 기록 ── */
  const fetchMonthRecords = useCallback(async (monthDate) => {
    setMonthLoading(true)
    const { first, last } = monthRange(monthDate)
    try {
      const data = await fetchMonthPoints(first, last)
      setMonthRecords(data)
    } catch (err) {
      showToast('월별 기록 불러오기 실패: ' + err.message, 'error')
    }
    setMonthLoading(false)
  }, [])

  useEffect(() => { fetchStudents(); fetchRecent() }, [fetchStudents, fetchRecent])
  useEffect(() => {
    if (activeTab === 'monthly') fetchMonthRecords(selectedMonth)
  }, [activeTab, selectedMonth, fetchMonthRecords])

  /* ── 사유 템플릿 불러오기 (최초 1회, 서버 공용 저장소에서) ── */
  const loadReasonTemplates = useCallback(async () => {
    setReasonsLoading(true)
    try {
      const list = await fetchReasons()
      setReasonTemplates(list)
    } catch (err) {
      showToast('사유 목록 불러오기 실패: ' + err.message, 'error')
    }
    setReasonsLoading(false)
  }, [])

  useEffect(() => { loadReasonTemplates() }, [loadReasonTemplates])

  /* ── 현재 선택된 구분(상점/벌점)에 해당하는 사유 목록 ── */
  const filteredReasons = useMemo(
    () => reasonTemplates.filter(r => r.type === type),
    [reasonTemplates, type]
  )

  /* ── 새 사유 추가 (사유 + 점수를 함께 등록, 서버 공용 저장소에 저장) ── */
  const handleAddReason = async () => {
    const title = newReasonText.trim()
    const pts   = Number(newReasonPoints)
    if (!title) return
    if (!pts || pts <= 0) {
      showToast('이 사유에 부여할 점수를 입력해주세요', 'error')
      return
    }
    if (filteredReasons.some(r => r.title === title)) {
      showToast('이미 등록된 사유예요', 'error')
      return
    }
    try {
      await addReason({ type, title, points: pts })
    } catch (err) {
      showToast('사유 등록 실패: ' + err.message, 'error')
      return
    }
    await loadReasonTemplates()  // ✅ 등록 후 전체 목록을 다시 불러와서 모두 같은 목록을 보게 함
    setReason(title)
    setPoints(String(pts))   // ✅ 사유를 등록하는 즉시 연계된 점수도 자동 반영
    setNewReasonText('')
    setNewReasonPoints('')
    showToast('새 사유를 등록했어요 ✏️')
  }

  /* ── 사유 삭제 (서버 공용 저장소에서) ── */
  const handleDeleteReason = async (id, title) => {
    try {
      await deleteReason(id)
    } catch (err) {
      showToast('사유 삭제 실패: ' + err.message, 'error')
      return
    }
    await loadReasonTemplates()
    if (reason === title) setReason('')
  }

  const selectedStudent = students.find(s => s.id === selectedId)
  const canSave = selectedId && reason.trim() && Number(points) > 0

  /* ── 사유 선택 시 매칭된 점수를 자동으로 부여 ── */
  const handleReasonSelect = (title) => {
    setReason(title)
    const matched = filteredReasons.find(r => r.title === title)
    if (matched) setPoints(String(matched.points))
  }

  /* ── 등록 ── */
  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)

    // ⚠️ 브라우저에서 곧바로 supabase.insert()를 부르면 보안 정책(RLS) 때문에
    //    "new row violates row-level security policy" 오류가 나요.
    //    그래서 서버(api/add-point.js)를 거쳐서 저장해요.
    try {
      await addPoint({
        studentId:  selectedId,
        type,
        points:     Number(points),
        reason:     reason.trim(),
        recordDate: recordDate,
      })
    } catch (err) {
      setSaving(false)
      showToast('등록 실패: ' + err.message, 'error')
      return
    }

    setSaving(false)
    showToast(`${selectedStudent?.name} 학생 ${type} 등록 완료! ${type === '상점' ? '⭐' : '⚠️'}`)

    setPoints(''); setReason('')
    fetchRecent()
    if (activeTab === 'monthly') fetchMonthRecords(selectedMonth)
  }

  /* ── 삭제 (등록 실수 정정용) ── */
  const handleDelete = async (id) => {
    if (!window.confirm('이 기록을 삭제할까요?')) return
    try {
      await deletePoint(id)
    } catch (err) {
      showToast('삭제 실패: ' + err.message, 'error')
      return
    }
    showToast('기록을 삭제했어요 🗑️')
    fetchRecent()
    fetchMonthRecords(selectedMonth)
  }

  /* ── 월별 학생별 합산 ── */
  const monthlySummary = useMemo(() => {
    const map = {}
    monthRecords.forEach(r => {
      const sid = r.student_id
      if (!map[sid]) {
        map[sid] = {
          id: sid,
          name: r.students?.name || '알 수 없음',
          seat: r.students?.seat_number,
          plus: 0, minus: 0,
        }
      }
      if (r.type === '상점') map[sid].plus += r.points
      else map[sid].minus += r.points
    })
    return Object.values(map)
      .map(v => ({ ...v, total: v.plus - v.minus }))
      .sort((a, b) => b.total - a.total)
  }, [monthRecords])

  const filteredMonthRecords = useMemo(() => {
    if (monthStudentFilter === '전체') return monthRecords
    return monthRecords.filter(r => r.students?.name === monthStudentFilter)
  }, [monthRecords, monthStudentFilter])

  const monthLabel = selectedMonth.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })
  const isCurrentMonth = (() => {
    const now = new Date()
    return now.getFullYear() === selectedMonth.getFullYear() && now.getMonth() === selectedMonth.getMonth()
  })()

  const moveMonth = (delta) => {
    setSelectedMonth(d => new Date(d.getFullYear(), d.getMonth() + delta, 1))
  }

  return (
    <Layout>
      <div style={{ padding: '28px 32px' }}>

        {/* ── 토스트 ── */}
        {toast && (
          <div style={{
            position: 'fixed', top: '76px', right: '28px', zIndex: 999,
            padding: '12px 20px', borderRadius: '12px',
            background: toast.t === 'error' ? '#FEF2F2' : '#ECFDF5',
            color: toast.t === 'error' ? '#DC2626' : '#059669',
            border: `1px solid ${toast.t === 'error' ? '#FECACA' : '#A7F3D0'}`,
            fontSize: '13px', fontWeight: 600,
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          }}>{toast.msg}</div>
        )}

        {/* ── 헤더 ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
          <div style={{
            width: '46px', height: '46px', borderRadius: '14px',
            background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Award size={22} style={{ color: '#D97706' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0F172A', margin: 0 }}>상벌점 관리</h1>
            <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '3px' }}>
              학생별 상점 · 벌점을 등록하고 월별로 조회해요
            </p>
          </div>
        </div>

        {/* ── 탭 ── */}
        <div style={{
          display: 'flex', gap: '4px', marginBottom: '20px',
          background: '#F1F5F9', borderRadius: '14px', padding: '4px', width: 'fit-content',
        }}>
          {[
            { key: 'register', label: '✏️ 점수 등록' },
            { key: 'monthly',  label: '📅 월별 조회' },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              padding: '8px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', border: 'none', transition: 'all 0.15s',
              background: activeTab === tab.key ? '#fff'     : 'transparent',
              color:       activeTab === tab.key ? '#6366F1' : '#64748B',
              boxShadow:   activeTab === tab.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}>{tab.label}</button>
          ))}
        </div>

        {/* ════════════════════════════════════════
            점수 등록 탭
        ════════════════════════════════════════ */}
        {activeTab === 'register' && (
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>

            {/* 좌측: 등록 폼 */}
            <div style={{
              flex: '0 0 380px', background: '#fff', borderRadius: '16px',
              border: '1px solid #E2E8F0', padding: '22px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#374151', marginBottom: '14px' }}>
                새 기록 등록
              </p>

              {/* 학생 선택 */}
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '6px' }}>
                학생 선택
              </label>
              <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
                style={{ ...inputStyle, marginBottom: '14px' }}>
                <option value="">학생을 선택해주세요</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.seat_number ? ` (좌석 ${s.seat_number})` : ''}
                  </option>
                ))}
              </select>

              {/* 상점/벌점 토글 */}
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '6px' }}>
                구분
              </label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                {['상점', '벌점'].map(tp => (
                  <button key={tp} onClick={() => { setType(tp); setReason(''); setPoints('') }} style={{
                    flex: 1, padding: '10px 0', borderRadius: '10px',
                    border: type === tp ? 'none' : '1.5px solid #E2E8F0',
                    background: type === tp
                      ? (tp === '상점' ? 'linear-gradient(135deg,#F59E0B,#D97706)' : 'linear-gradient(135deg,#F43F5E,#E11D48)')
                      : '#fff',
                    color: type === tp ? '#fff' : '#64748B',
                    fontSize: '13px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  }}>
                    {tp === '상점' ? <Star size={14} /> : <AlertTriangle size={14} />}
                    {tp === '상점' ? '상점 (+)' : '벌점 (-)'}
                  </button>
                ))}
              </div>

              {/* 사유 선택 (드롭다운) — 사유를 고르면 매칭된 점수가 자동으로 채워져요 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>
                  사유
                </label>
                <button onClick={() => setShowReasonManager(v => !v)} style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  fontSize: '11px', fontWeight: 600,
                  color: showReasonManager ? '#6366F1' : '#94A3B8',
                }}>
                  <Settings size={12} /> 사유 관리
                </button>
              </div>
              <select value={reason} onChange={e => handleReasonSelect(e.target.value)}
                style={{ ...inputStyle, marginBottom: showReasonManager ? '10px' : '6px' }}>
                <option value="">사유를 선택해주세요</option>
                {filteredReasons.map(r => (
                  <option key={r.id} value={r.title}>
                    {r.title} ({type === '상점' ? '+' : '-'}{r.points}점)
                  </option>
                ))}
              </select>
              {!showReasonManager && (
                <p style={{ fontSize: '11px', color: '#94A3B8', margin: '0 0 14px' }}>
                  💡 사유를 고르면 점수가 자동으로 채워져요 (필요하면 아래에서 직접 고쳐도 돼요)
                </p>
              )}

              {/* 사유 관리 패널 (등록 / 삭제) — 사유와 점수를 함께 등록해요 */}
              {showReasonManager && (() => {
                const b = typeBadge(type)
                return (
                  <div style={{
                    background: '#F8FAFC', border: '1px solid #E2E8F0',
                    borderRadius: '10px', padding: '12px', marginBottom: '14px',
                  }}>
                    <p style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '8px' }}>
                      {type} 사유 목록 · 클릭하면 삭제돼요
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                      {filteredReasons.length === 0 ? (
                        <span style={{ fontSize: '12px', color: '#CBD5E1' }}>
                          {reasonsLoading ? '불러오는 중...' : '등록된 사유가 없어요'}
                        </span>
                      ) : (
                        filteredReasons.map(r => (
                          <span key={r.id} onClick={() => handleDeleteReason(r.id, r.title)} style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            padding: '4px 9px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
                            cursor: 'pointer', background: b.bg, color: b.color, border: `1px solid ${b.border}`,
                          }}>
                            {r.title} ({type === '상점' ? '+' : '-'}{r.points}) <X size={11} />
                          </span>
                        ))
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        placeholder={`새 ${type} 사유 입력`}
                        value={newReasonText}
                        onChange={e => setNewReasonText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddReason() } }}
                        style={{ ...inputStyle, padding: '8px 10px', fontSize: '12px', flex: 2 }}
                      />
                      <input
                        type="number" min="1" placeholder="점수"
                        value={newReasonPoints}
                        onChange={e => setNewReasonPoints(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddReason() } }}
                        style={{ ...inputStyle, padding: '8px 10px', fontSize: '12px', flex: 1, width: 'auto' }}
                      />
                      <button onClick={handleAddReason} style={{
                        padding: '8px 14px', borderRadius: '10px', border: 'none',
                        background: '#6366F1', color: '#fff', fontSize: '12px', fontWeight: 700,
                        cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px',
                      }}>
                        <Plus size={12} /> 추가
                      </button>
                    </div>
                    <p style={{ fontSize: '10px', color: '#CBD5E1', margin: '8px 0 0' }}>
                      사유와 점수를 함께 입력하면, 다음부터 이 사유를 고를 때 점수가 자동으로 매칭돼요
                    </p>
                  </div>
                )
              })()}

              {/* 점수 입력 (사유 선택 시 자동 채워짐 · 직접 수정 가능) */}
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '6px' }}>
                점수
              </label>
              <input type="number" min="1" placeholder="예: 5" value={points}
                onChange={e => setPoints(e.target.value)}
                style={{ ...inputStyle, marginBottom: '14px' }} />


              {/* 날짜 입력 */}
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '6px' }}>
                날짜
              </label>
              <input type="date" value={recordDate}
                onChange={e => setRecordDate(e.target.value)}
                style={{ ...inputStyle, marginBottom: '18px' }} />

              <button onClick={handleSave} disabled={!canSave || saving} style={{
                width: '100%', padding: '12px 0', borderRadius: '12px', border: 'none',
                background: !canSave ? '#E2E8F0' : 'linear-gradient(135deg,#6366F1,#4F46E5)',
                color: !canSave ? '#94A3B8' : '#fff',
                fontSize: '14px', fontWeight: 700,
                cursor: !canSave || saving ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                transition: 'all 0.15s',
              }}>
                {saving ? <><Loader size={15} /> 등록 중...</> : <><Plus size={15} /> 등록하기</>}
              </button>
            </div>

            {/* 우측: 최근 등록 내역 */}
            <div style={{
              flex: 1, background: '#fff', borderRadius: '16px',
              border: '1px solid #E2E8F0', padding: '22px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#374151', marginBottom: '14px' }}>
                최근 등록 내역
              </p>

              {recentLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#94A3B8', fontSize: '13px' }}>불러오는 중...</div>
              ) : recent.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#94A3B8', fontSize: '13px' }}>아직 등록된 기록이 없어요</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {recent.map(r => {
                    const b = typeBadge(r.type)
                    return (
                      <div key={r.id} style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '10px 14px', borderRadius: '12px',
                        background: '#F8FAFC', border: '1px solid #F1F5F9',
                      }}>
                        <span style={{
                          padding: '3px 9px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
                          background: b.bg, color: b.color, border: `1px solid ${b.border}`, whiteSpace: 'nowrap',
                        }}>
                          {r.type === '상점' ? '+' : '-'}{r.points}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>
                          {r.students?.name || '알 수 없음'}
                        </span>
                        <span style={{ fontSize: '12px', color: '#64748B', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {r.reason}
                        </span>
                        <span style={{ fontSize: '11px', color: '#94A3B8', whiteSpace: 'nowrap' }}>{r.record_date}</span>
                        <button onClick={() => handleDelete(r.id)} style={{
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          color: '#CBD5E1', display: 'flex', alignItems: 'center',
                        }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════
            월별 조회 탭
        ════════════════════════════════════════ */}
        {activeTab === 'monthly' && (
          <div>

            {/* 월 선택 네비게이션 */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px',
              background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px',
              padding: '10px 16px', width: 'fit-content',
            }}>
              <button onClick={() => moveMonth(-1)} style={{
                width: '30px', height: '30px', borderRadius: '8px', border: '1px solid #E2E8F0',
                background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><ChevronLeft size={16} /></button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '140px', justifyContent: 'center' }}>
                <Calendar size={16} style={{ color: '#6366F1' }} />
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>{monthLabel}</span>
                {isCurrentMonth && (
                  <span style={{
                    fontSize: '10px', fontWeight: 700, color: '#6366F1',
                    background: '#EEF2FF', padding: '2px 7px', borderRadius: '999px',
                  }}>이번 달</span>
                )}
              </div>

              <button onClick={() => moveMonth(1)} style={{
                width: '30px', height: '30px', borderRadius: '8px', border: '1px solid #E2E8F0',
                background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><ChevronRight size={16} /></button>
            </div>

            {monthLoading ? (
              <div style={{ textAlign: 'center', padding: '64px 0', color: '#94A3B8', fontSize: '14px' }}>불러오는 중...</div>
            ) : (
              <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>

                {/* 학생별 합산 요약 */}
                <div style={{
                  flex: '0 0 360px', background: '#fff', borderRadius: '16px',
                  border: '1px solid #E2E8F0', overflow: 'hidden',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}>
                  <div style={{ padding: '16px 18px', borderBottom: '1px solid #F1F5F9' }}>
                    <p style={{ fontSize: '14px', fontWeight: 700, color: '#374151', margin: 0 }}>학생별 합산 점수</p>
                  </div>
                  {monthlySummary.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: '#94A3B8', fontSize: '13px' }}>
                      {monthLabel}에 등록된 기록이 없어요
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: '#F8FAFC' }}>
                          <th style={{ padding: '8px 12px', textAlign: 'left',  color: '#64748B', fontWeight: 600 }}>이름</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right', color: '#D97706', fontWeight: 600 }}>상점</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right', color: '#E11D48', fontWeight: 600 }}>벌점</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right', color: '#374151', fontWeight: 700 }}>총점</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlySummary.map(s => (
                          <tr key={s.id} style={{ borderTop: '1px solid #F1F5F9', cursor: 'pointer' }}
                            onClick={() => setMonthStudentFilter(monthStudentFilter === s.name ? '전체' : s.name)}>
                            <td style={{ padding: '9px 12px', fontWeight: 700, color: '#0F172A' }}>{s.name}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'right', color: '#D97706' }}>+{s.plus}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'right', color: '#E11D48' }}>-{s.minus}</td>
                            <td style={{
                              padding: '9px 12px', textAlign: 'right', fontWeight: 800,
                              color: s.total > 0 ? '#059669' : s.total < 0 ? '#E11D48' : '#64748B',
                            }}>{s.total > 0 ? `+${s.total}` : s.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {monthStudentFilter !== '전체' && (
                    <div style={{ padding: '10px 18px', borderTop: '1px solid #F1F5F9' }}>
                      <button onClick={() => setMonthStudentFilter('전체')} style={{
                        fontSize: '12px', color: '#6366F1', background: 'transparent',
                        border: 'none', cursor: 'pointer', fontWeight: 600,
                      }}>전체 보기로 돌아가기 ✕</button>
                    </div>
                  )}
                </div>

                {/* 상세 기록 목록 */}
                <div style={{
                  flex: 1, background: '#fff', borderRadius: '16px',
                  border: '1px solid #E2E8F0', padding: '18px 18px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: '#374151', marginBottom: '14px' }}>
                    {monthStudentFilter === '전체' ? `${monthLabel} 전체 기록` : `${monthStudentFilter} 학생의 ${monthLabel} 기록`}
                  </p>
                  {filteredMonthRecords.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: '#94A3B8', fontSize: '13px' }}>기록이 없어요</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {filteredMonthRecords.map(r => {
                        const b = typeBadge(r.type)
                        return (
                          <div key={r.id} style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '10px 14px', borderRadius: '12px',
                            background: '#F8FAFC', border: '1px solid #F1F5F9',
                          }}>
                            <span style={{ fontSize: '11px', color: '#94A3B8', whiteSpace: 'nowrap', width: '78px' }}>{r.record_date}</span>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>
                              {r.students?.name || '알 수 없음'}
                            </span>
                            <span style={{
                              padding: '3px 9px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
                              background: b.bg, color: b.color, border: `1px solid ${b.border}`, whiteSpace: 'nowrap',
                            }}>
                              {r.type === '상점' ? '+' : '-'}{r.points}
                            </span>
                            <span style={{ fontSize: '12px', color: '#64748B', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {r.reason}
                            </span>
                            <button onClick={() => handleDelete(r.id)} style={{
                              background: 'transparent', border: 'none', cursor: 'pointer',
                              color: '#CBD5E1', display: 'flex', alignItems: 'center',
                            }}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}