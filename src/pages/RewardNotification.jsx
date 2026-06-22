import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import { createClient } from '@supabase/supabase-js'
import {
  Star, AlertTriangle, Plus, MessageSquare,
  ChevronDown, Copy, CheckCheck, Settings, X, Loader,
} from 'lucide-react'
import { sendMeritNotification } from '../lib/sendMeritNotification' // ✅ 승인된 템플릿 변수 매핑
import { getMonthlyPointTotals } from '../lib/pointsSummary'           // ✅ 이번 달 누적 상점/벌점 계산
import { addPoint } from '../lib/addPoint'                             // ✅ RLS 우회해서 점수 저장 (서버 경유)

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// ================================================================
// ✅ [전면 수정] 솔라피에 승인받은 카카오 알림톡 템플릿 "그대로"를
//    이 페이지에서 만들어 보내도록 구조를 바꿨어요.
//
//    예전에는 사장님이 자유롭게 작성한 문구(제목+내용)를 보냈는데,
//    승인된 카카오 템플릿은 "정해진 문장 + 빈칸(#{변수})" 구조라서
//    자유 문구를 끼워넣을 수가 없어요. (마치 관공서 서식처럼, 빈칸에
//    이름/사유/점수만 채워 넣을 수 있고 문장 자체는 못 바꿔요)
//
//    그래서 "사유"와 "점수"만 입력받고, 나머지 고정 문장은
//    승인된 템플릿과 한 글자도 다르지 않게 그대로 적어뒀어요.
// ================================================================

/* ── 사유 빠른 선택 목록 저장 (StudentPoints.jsx의 "점수 등록" 탭과 같은 저장소를 같이 써요) ── */
const REASON_STORAGE_KEY = 'smc_point_reasons'
const DEFAULT_REASONS = [
  { id: 'r1', type: '상점', title: '성실한 출석',    points: 5 },
  { id: 'r2', type: '상점', title: '시험 성적 향상', points: 10 },
  { id: 'r3', type: '벌점', title: '무단 결석',       points: 5 },
  { id: 'r4', type: '벌점', title: '규정 위반',       points: 5 },
]

/* ── 오늘 날짜를 yyyy-MM-dd 문자열로 ── */
const todayStr = () => {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/* ── 승인된 카카오 템플릿 문장 그대로 (변수만 갈아끼워요) ── */
function buildApprovedMessage(type, { studentName, reason, points, month, totalPenalty, totalReward }) {
  if (type === '상점') {
    return `[SMC 스터디카페 상점 안내]
안녕하세요 SMC 관리형 스터디카페입니다.
${studentName} 학생의 ${reason}로 인하여 ${points}점이 부여되었습니다.

훌륭한 자기주도 학습 태도에 칭찬과 감사를 드립니다.
앞으로도 좋은 학습 태도 유지해주세요!

상점은 벌점을 상쇄하거나 상품으로 전환될 수 있습니다.

문의사항은 010-6748-2577으로 연락 주세요`
  }
  return `[SMC 스터디카페 벌점 안내]
안녕하세요 SMC 관리형 스터디카페입니다.
${studentName} 학생의 ${reason}로 인하여 ${points}점이 부여되었습니다.
현재 학생의 ${month}월 누적 벌점 ${totalPenalty}점, 누적 상점 ${totalReward}점 입니다.

상벌점 합산 20점이 되면 학부모님께 연락이 가며, 30점이 되면 강제 퇴원 조치됩니다.

문의사항은 010-6748-2577으로 연락 주세요`
}

/* ── 스타일 상수 (컴포넌트 바깥에 선언 → ESLint 오류 없음) ── */
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

/* ════════════════════════════════════════
   메인 컴포넌트
════════════════════════════════════════ */
export default function RewardNotification() {
  const [students,   setStudents]   = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [loading,    setLoading]    = useState(false)
  const [recipient,  setRecipient]  = useState('parent') // 'parent' | 'student' | 'both'

  /* ── 구분 / 사유 / 점수 ── */
  const [type,   setType]   = useState('상점')
  const [reason, setReason] = useState('')
  const [score,  setScore]  = useState('')

  /* ── 사유 빠른 선택 관리 ── */
  const [reasonTemplates,   setReasonTemplates]   = useState([])
  const [showReasonManager, setShowReasonManager] = useState(false)
  const [newReasonText,     setNewReasonText]     = useState('')
  const [newReasonPoints,   setNewReasonPoints]   = useState('')

  /* ── 이번 달 누적 벌점/상점 (벌점 발송 시에만 필요) ── */
  const [monthlyTotals, setMonthlyTotals] = useState(null)
  const [totalsLoading, setTotalsLoading] = useState(false)

  const [copied,  setCopied]  = useState(false)
  const [sending, setSending] = useState(false)

  /* ─ 학생 목록 불러오기 (재원생만) ─ */
  const fetchStudents = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('students')
      .select('*')
      .eq('status', '재원생')
      .order('name')
    if (data) setStudents(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchStudents() }, [fetchStudents])

  /* ─ 사유 빠른 선택 목록 불러오기 ─ */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REASON_STORAGE_KEY)
      const list = saved ? JSON.parse(saved) : DEFAULT_REASONS
      setReasonTemplates(list.map(r => ({ ...r, points: Number(r.points) > 0 ? Number(r.points) : 1 })))
    } catch {
      setReasonTemplates(DEFAULT_REASONS)
    }
  }, [])

  const saveReasonTemplates = (list) => {
    localStorage.setItem(REASON_STORAGE_KEY, JSON.stringify(list))
    setReasonTemplates(list)
  }

  const filteredReasons = reasonTemplates.filter(r => r.type === type)

  const handleTypeChange = (tp) => {
    setType(tp)
    setReason('')
    setScore('')
  }

  const handleReasonSelect = (title) => {
    setReason(title)
    const matched = filteredReasons.find(r => r.title === title)
    if (matched) setScore(String(matched.points))
  }

  const handleAddReason = () => {
    const title = newReasonText.trim()
    const pts = Number(newReasonPoints)
    if (!title) return
    if (!pts || pts <= 0) { alert('이 사유에 부여할 점수를 입력해주세요'); return }
    if (filteredReasons.some(r => r.title === title)) { alert('이미 등록된 사유예요'); return }
    const updated = [...reasonTemplates, { id: Date.now().toString(), type, title, points: pts }]
    saveReasonTemplates(updated)
    setReason(title)
    setScore(String(pts))
    setNewReasonText('')
    setNewReasonPoints('')
  }

  const handleDeleteReason = (id, title) => {
    saveReasonTemplates(reasonTemplates.filter(r => r.id !== id))
    if (reason === title) setReason('')
  }

  const selectedStudent = students.find(s => s.id === selectedId)

  /* ─ 벌점일 때만 이번 달 누적 합계를 자동으로 불러와요 ─ */
  useEffect(() => {
    if (!selectedId || type !== '벌점') { setMonthlyTotals(null); return }
    let active = true
    setTotalsLoading(true)
    getMonthlyPointTotals(selectedId, new Date())
      .then(totals => { if (active) setMonthlyTotals(totals) })
      .catch(() => { if (active) setMonthlyTotals({ totalReward: 0, totalPenalty: 0 }) })
      .finally(() => { if (active) setTotalsLoading(false) })
    return () => { active = false }
  }, [selectedId, type])

  /* ─ 이번 건(score)까지 포함한 미리보기용 누적 합계 ─ */
  const previewTotals = (type === '벌점' && monthlyTotals)
    ? { totalPenalty: monthlyTotals.totalPenalty + Number(score || 0), totalReward: monthlyTotals.totalReward }
    : null

  const canSend = !!(
    selectedStudent && reason.trim() && Number(score) > 0 &&
    (type === '상점' || (!totalsLoading && previewTotals))
  )

  /* ─ 승인된 템플릿 그대로의 미리보기 텍스트 ─ */
  const getPreviewText = () => {
    if (!selectedStudent || !reason.trim() || !score) return ''
    if (type === '상점') {
      return buildApprovedMessage('상점', { studentName: selectedStudent.name, reason: reason.trim(), points: score })
    }
    if (!previewTotals) return ''
    return buildApprovedMessage('벌점', {
      studentName: selectedStudent.name,
      reason: reason.trim(),
      points: score,
      month: new Date().getMonth() + 1,
      totalPenalty: previewTotals.totalPenalty,
      totalReward: previewTotals.totalReward,
    })
  }

  const handleCopy = () => {
    const text = getPreviewText()
    if (!text) return
    navigator.clipboard.writeText(text)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
      .catch(() => alert('복사 실패 – 브라우저 권한을 확인해주세요'))
  }

  // ✅ [2026-06-23 수정] "학부모 + 학생 둘 다" 보낼 수 있게 구조 변경
  //
  //    비유: 영수증(상벌점 기록)은 한 건의 사건에 대해 딱 1장만 끊고,
  //          그 영수증 "사본"을 학부모/학생 두 사람에게 나눠주는 것과 같아요.
  //
  //    예전에는 "발송 버튼 1번 = 점수 기록 1번 + 발송 1번"이 한 묶음이라,
  //    학부모께 보내고 학생에게도 보내려고 버튼을 두 번 누르면
  //    점수(student_points)도 2번 기록되는 중복 문제가 있었어요.
  //
  //    이제는 ① 점수 기록은 무조건 "딱 1번만" 하고,
  //          ② 그 점수를 가지고 선택된 수신자(학부모/학생/둘 다)에게
  //             알림톡만 각각 따로 보내도록 분리했어요.
  const handleSend = async () => {
    if (!canSend) return

    // ── 수신자 목록 만들기 (recipient 값에 따라 1명 또는 2명) ──
    const candidates = [
      { value: 'parent',  label: `${selectedStudent.parent_name || '학부모님'} (학부모)`, phone: selectedStudent.parent_phone },
      { value: 'student', label: `${selectedStudent.name} (학생 본인)`,                    phone: selectedStudent.student_phone },
    ]
    const targets = candidates.filter(c =>
      recipient === 'both' ? true : c.value === recipient
    )
    const sendList   = targets.filter(t => t.phone)      // 번호가 있는 사람만 실제 발송
    const missingList = targets.filter(t => !t.phone)     // 번호가 없어서 못 보내는 사람

    if (sendList.length === 0) {
      const who = missingList.map(m => m.label).join(', ')
      alert(`❌ 전화번호가 없습니다! (${who})\n\n학생 관리 페이지에서 번호를 먼저 등록해주세요.`)
      return
    }

    const icon = type === '상점' ? '⭐' : '⚠️'
    let confirmMsg =
      `📱 알림톡을 발송할까요?\n\n` +
      `수신자: ${sendList.map(t => `${t.label} (${t.phone})`).join('\n      ')}\n` +
      `학생: ${selectedStudent.name}\n` +
      `내용: ${icon} ${type} - ${reason.trim()} (${score}점)`
    if (missingList.length > 0) {
      confirmMsg += `\n\n⚠️ ${missingList.map(m => m.label).join(', ')}는 전화번호가 없어 발송에서 제외돼요.`
    }
    const confirmed = window.confirm(confirmMsg)
    if (!confirmed) return

    setSending(true)
    try {
      // ① 점수 테이블에 "딱 1번만" 기록 (점수 등록 탭에서 등록한 것과 동일하게 저장돼요)
      //    ⚠️ 브라우저에서 곧바로 insert하면 보안 정책(RLS) 때문에 막혀서,
      //       서버(api/add-point.js)를 거쳐서 저장해요.
      //    ── 수신자가 1명이든 2명이든 이 블록은 한 번만 실행돼요 ──
      try {
        await addPoint({
          studentId:  selectedId,
          type,
          points:     Number(score),
          reason:     reason.trim(),
          recordDate: todayStr(),
        })
      } catch (err) {
        alert('❌ 점수 기록 실패\n\n' + err.message)
        return
      }

      // ② 방금 기록한 것까지 포함해서 다시 정확하게 누적 합계 계산 (벌점일 때만, 공통으로 1번만 계산)
      const apiType = type === '상점' ? 'reward' : 'penalty'
      const basePayload = {
        studentName: selectedStudent.name,
        reason: reason.trim(),
        points: Number(score),
        fallbackText: getPreviewText(), // 알림톡 실패 시 SMS로 가는 대체 문구도 승인된 문장과 동일하게
      }
      if (apiType === 'penalty') {
        const { totalReward, totalPenalty } = await getMonthlyPointTotals(selectedId, new Date())
        basePayload.month = new Date().getMonth() + 1
        basePayload.totalPenalty = totalPenalty
        basePayload.totalReward = totalReward
      }

      // ③ 수신자 각각에게 알림톡 발송 (점수 기록과는 분리돼 있어서 여기서 몇 번을 보내도 점수는 중복되지 않아요)
      const results = await Promise.all(
        sendList.map(async (t) => {
          try {
            const result = await sendMeritNotification(apiType, { ...basePayload, to: t.phone })
            return { ...t, success: !!result.success, error: result.error }
          } catch (err) {
            return { ...t, success: false, error: err.message }
          }
        })
      )

      const succeeded = results.filter(r => r.success)
      const failed    = results.filter(r => !r.success)

      if (failed.length === 0) {
        alert(`✅ 발송 완료!\n\n${succeeded.map(r => r.label).join(', ')}께 ${type} 알림톡이 전송되었습니다.`)
      } else if (succeeded.length === 0) {
        alert(`⚠️ 점수는 기록됐지만 알림톡 발송에 모두 실패했어요\n\n${failed.map(r => `${r.label}: ${r.error || '알 수 없는 오류'}`).join('\n')}`)
      } else {
        alert(
          `⚠️ 일부만 발송됐어요 (점수는 정상 기록됨)\n\n` +
          `성공: ${succeeded.map(r => r.label).join(', ')}\n` +
          `실패: ${failed.map(r => `${r.label} (${r.error || '알 수 없는 오류'})`).join(', ')}`
        )
      }

      setReason('')
      setScore('')
      if (type === '벌점') {
        getMonthlyPointTotals(selectedId, new Date()).then(setMonthlyTotals)
      }
    } catch (err) {
      alert(`❌ 발송 실패\n\n${err.message}`)
    } finally {
      setSending(false)
    }
  }

  /* ════════════════════════════════════════
     렌더링 (화면 그리기)
  ════════════════════════════════════════ */
  return (
    <Layout>
      <div style={{ padding: '28px 32px', maxWidth: '800px' }}>

        {/* ── 페이지 헤더 ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px' }}>
          <div style={{
            width: '46px', height: '46px', borderRadius: '14px',
            background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Star size={22} style={{ color: '#D97706' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0F172A', margin: 0 }}>상벌점 알림톡</h1>
            <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '3px' }}>
              학생 상벌점 내용을 학부모님께 알림톡으로 전달해요 (승인된 카카오 템플릿 그대로 발송돼요)
            </p>
          </div>
        </div>

        {/* ── STEP 1: 학생 선택 ── */}
        <StepCard step="1" title="학생 선택" style={{ marginBottom: '16px' }}>
          {loading ? (
            <p style={{ fontSize: '13px', color: '#94A3B8' }}>학생 목록 불러오는 중...</p>
          ) : (
            <div style={{ position: 'relative' }}>
              <select
                value={selectedId}
                onChange={e => setSelectedId(e.target.value)}
                style={{
                  width: '100%', padding: '11px 40px 11px 14px',
                  borderRadius: '12px', border: '1.5px solid #E2E8F0',
                  fontSize: '14px', outline: 'none', background: '#F8FAFC',
                  color: selectedId ? '#0F172A' : '#94A3B8',
                  appearance: 'none', cursor: 'pointer',
                }}
                onFocus={e => { e.target.style.borderColor = '#6366F1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' }}
                onBlur={e  => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none' }}
              >
                <option value="">── 학생을 선택하세요 ──</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.school || '–'} {s.grade || ''}
                    {s.seat_number ? ` · 좌석 ${s.seat_number}번` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} style={{
                position: 'absolute', right: '12px', top: '50%',
                transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none',
              }} />
            </div>
          )}
          {selectedStudent?.parent_phone && (
            <p style={{ marginTop: '8px', fontSize: '12px', color: '#64748B' }}>
              📞 학부모 연락처: <strong>{selectedStudent.parent_phone}</strong>
            </p>
          )}
          {/* ✅ 수신 대상 선택 (학생 선택 후 표시) */}
          {selectedStudent && (
            <div style={{ marginTop: '12px' }}>
              <p style={{ fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '8px' }}>
                📤 수신 대상
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[
                  { value: 'parent',  label: '👨‍👩‍👧 학부모', phone: selectedStudent.parent_phone },
                  { value: 'student', label: '🧑‍🎓 학생 본인', phone: selectedStudent.student_phone },
                  { value: 'both',    label: '👨‍👩‍👧🧑‍🎓 둘 다', phone: null },
                ].map(({ value, label, phone }) => (
                  <button
                    key={value}
                    onClick={() => setRecipient(value)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                      padding: '10px 16px', borderRadius: '12px', cursor: 'pointer',
                      border: recipient === value ? '2px solid #6366F1' : '1.5px solid #E2E8F0',
                      background: recipient === value ? '#EEF2FF' : '#FAFBFF',
                      transition: 'all 0.15s', minWidth: '140px',
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 700, color: recipient === value ? '#4F46E5' : '#374151' }}>
                      {label}
                    </span>
                    <span style={{ fontSize: '11px', color: phone ? '#64748B' : (value === 'both' ? '#94A3B8' : '#EF4444'), marginTop: '2px' }}>
                      {value === 'both'
                        ? `학부모+학생 각각 발송`
                        : (phone || '번호 없음')}
                    </span>
                  </button>
                ))}
              </div>
              {/* ✅ '둘 다' 선택 시, 점수는 1번만 기록되고 알림톡만 두 사람에게 따로 발송된다는 점을 안내 */}
              {recipient === 'both' && (
                <p style={{ marginTop: '8px', fontSize: '11px', color: '#6366F1' }}>
                  💡 상벌점은 1건만 기록되고, 학부모/학생 두 분께 알림톡만 각각 발송돼요 (중복 등록 걱정 없어요)
                </p>
              )}
            </div>
          )}
        </StepCard>

        {/* ── STEP 2: 구분 · 사유 ── */}
        <StepCard step="2" title="구분 · 사유" style={{ marginBottom: '16px' }}>
          {/* 상점/벌점 토글 */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            {['상점', '벌점'].map(tp => (
              <button key={tp} onClick={() => handleTypeChange(tp)} style={{
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

          {/* 사유 입력 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>
              사유 <span style={{ color: '#94A3B8', fontWeight: 400 }}>· 승인된 템플릿의 #{'{사유}'} 자리에 그대로 들어가요</span>
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

          <input
            placeholder="사유를 입력해주세요 (예: 성실한 출석)"
            value={reason}
            onChange={e => setReason(e.target.value)}
            style={{ ...inputStyle, marginBottom: '8px' }}
          />

          {/* 빠른 선택 칩 (StudentPoints.jsx 점수 등록 탭과 같은 목록을 같이 써요) */}
          {filteredReasons.length > 0 && !showReasonManager && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
              {filteredReasons.map(r => {
                const b = typeBadge(type)
                const active = reason === r.title
                return (
                  <button key={r.id} onClick={() => handleReasonSelect(r.title)} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    padding: '5px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
                    cursor: 'pointer', border: `1px solid ${b.border}`,
                    background: active ? b.color : b.bg,
                    color: active ? '#fff' : b.color,
                  }}>
                    {r.title} ({type === '상점' ? '+' : '-'}{r.points})
                  </button>
                )
              })}
            </div>
          )}
          {!showReasonManager && (
            <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0 }}>
              💡 자주 쓰는 사유를 클릭하면 사유와 점수가 자동으로 채워져요
            </p>
          )}

          {/* 사유 관리 패널 (등록 / 삭제) */}
          {showReasonManager && (
            <div style={{
              background: '#F8FAFC', border: '1px solid #E2E8F0',
              borderRadius: '10px', padding: '12px', marginTop: '4px',
            }}>
              <p style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '8px' }}>
                {type} 사유 목록 · 클릭하면 삭제돼요
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                {filteredReasons.length === 0 ? (
                  <span style={{ fontSize: '12px', color: '#CBD5E1' }}>등록된 사유가 없어요</span>
                ) : (
                  filteredReasons.map(r => {
                    const b = typeBadge(type)
                    return (
                      <span key={r.id} onClick={() => handleDeleteReason(r.id, r.title)} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '4px 9px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
                        cursor: 'pointer', background: b.bg, color: b.color, border: `1px solid ${b.border}`,
                      }}>
                        {r.title} ({type === '상점' ? '+' : '-'}{r.points}) <X size={11} />
                      </span>
                    )
                  })
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
            </div>
          )}
        </StepCard>

        {/* ── STEP 3: 점수 입력 ── */}
        <StepCard step="3" title="점수 입력 (필수)" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: type === '벌점' ? '12px' : 0 }}>
            <div style={{ position: 'relative', width: '160px' }}>
              <input
                type="number" min="1" placeholder="예: 5"
                value={score}
                onChange={e => setScore(e.target.value)}
                style={{ ...inputStyle, paddingRight: '40px' }}
              />
              <span style={{
                position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                fontSize: '13px', color: '#94A3B8', pointerEvents: 'none',
              }}>점</span>
            </div>
            <p style={{ fontSize: '13px', color: '#94A3B8' }}>승인된 알림톡 문장 안에 그대로 들어가는 점수예요</p>
          </div>

          {/* 벌점일 때만: 이번 달 누적 합계 (승인된 템플릿에 꼭 들어가는 정보예요) */}
          {type === '벌점' && selectedStudent && (
            <div style={{
              fontSize: '12px', color: '#9F1239', background: '#FFF1F2',
              border: '1px solid #FECDD3', borderRadius: '10px', padding: '10px 14px',
            }}>
              {totalsLoading ? (
                '이번 달 누적 점수를 불러오는 중...'
              ) : monthlyTotals ? (
                <>
                  📊 이번 달 현재까지: 벌점 <strong>{monthlyTotals.totalPenalty}점</strong> · 상점 <strong>{monthlyTotals.totalReward}점</strong>
                  {Number(score) > 0 && (
                    <> → 이번 건({score}점) 포함하면 누적 벌점 <strong>{monthlyTotals.totalPenalty + Number(score)}점</strong></>
                  )}
                </>
              ) : null}
            </div>
          )}
        </StepCard>

        {/* ── STEP 4: 미리보기 + 발송 ── */}
        {canSend ? (
          <div style={{
            background: '#fff', borderRadius: '20px',
            border: '1px solid #E2E8F0', overflow: 'hidden',
            boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
          }}>
            {/* 미리보기 헤더 */}
            <div style={{
              background: type === '상점'
                ? 'linear-gradient(135deg,#F59E0B 0%,#D97706 100%)'
                : 'linear-gradient(135deg,#F43F5E 0%,#E11D48 100%)',
              padding: '20px 28px',
            }}>
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', marginBottom: '6px' }}>
                PREVIEW · 승인된 카카오 템플릿 그대로예요
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {type === '상점'
                  ? <Star size={22} style={{ color: '#fff' }} />
                  : <AlertTriangle size={22} style={{ color: '#fff' }} />}
                <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: 800, margin: 0 }}>
                  {selectedStudent.name} · {reason.trim()}
                </h2>
              </div>
            </div>

            {/* 미리보기 본문 */}
            <div style={{ padding: '20px 28px' }}>
              <pre style={{
                whiteSpace: 'pre-wrap', fontSize: '13px', lineHeight: '1.7',
                color: '#334155', fontFamily: 'inherit', margin: 0,
                background: '#F8FAFC', borderRadius: '12px', padding: '16px',
                border: '1px solid #F1F5F9',
              }}>
                {getPreviewText()}
              </pre>
            </div>

            {/* 하단 액션 버튼 */}
            <div style={{
              display: 'flex', justifyContent: 'flex-end', gap: '10px',
              padding: '16px 28px', borderTop: '1px solid #F1F5F9', background: '#FAFBFF',
            }}>
              <button
                onClick={handleCopy}
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  padding: '10px 18px', borderRadius: '12px',
                  border: `1.5px solid ${copied ? '#A7F3D0' : '#E2E8F0'}`,
                  background: copied ? '#ECFDF5' : '#fff',
                  color: copied ? '#059669' : '#475569',
                  fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {copied ? <CheckCheck size={15} /> : <Copy size={15} />}
                {copied ? '복사됨!' : '문자 텍스트 복사'}
              </button>

              <button
                onClick={handleSend}
                disabled={sending}
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  padding: '10px 20px', borderRadius: '12px', border: 'none',
                  background: sending
                    ? 'linear-gradient(135deg,#FCA5A5,#FDA4AF)'
                    : type === '상점'
                      ? 'linear-gradient(135deg,#F59E0B,#D97706)'
                      : 'linear-gradient(135deg,#F43F5E,#E11D48)',
                  color: '#fff', fontSize: '13px', fontWeight: 700,
                  cursor: sending ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  transition: 'all 0.2s',
                }}
              >
                {sending
                  ? <><Loader size={15} /> 발송 중...</>
                  : <><MessageSquare size={15} /> 알림톡 발송</>
                }
              </button>
            </div>
          </div>
        ) : (
          /* 아직 입력이 끝나지 않은 상태 */
          <div style={{
            textAlign: 'center', padding: '48px 0',
            background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0',
          }}>
            <p style={{ fontSize: '36px', marginBottom: '10px' }}>
              {!selectedStudent ? '👆' : (totalsLoading ? '⏳' : '✏️')}
            </p>
            <p style={{ color: '#64748B', fontWeight: 600, fontSize: '14px' }}>
              {!selectedStudent
                ? '위에서 학생을 선택해주세요'
                : totalsLoading
                  ? '이번 달 누적 점수를 불러오는 중이에요'
                  : '사유와 점수를 입력하면 알림톡 미리보기가 나타나요'}
            </p>
          </div>
        )}

      </div>
    </Layout>
  )
}

/* ════════════════════════════════════════
   StepCard 재사용 컴포넌트
   (숫자 동그라미 + 제목이 있는 카드)
════════════════════════════════════════ */
function StepCard({ step, title, children, style }) {
  return (
    <div style={{
      background: '#fff', borderRadius: '16px', padding: '20px',
      border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      ...style,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <span style={{
          width: '24px', height: '24px', borderRadius: '50%',
          background: '#6366F1', color: '#fff',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '12px', fontWeight: 800, flexShrink: 0,
        }}>{step}</span>
        <p style={{ fontSize: '13px', fontWeight: 700, color: '#374151', margin: 0 }}>
          {title}
        </p>
      </div>
      {children}
    </div>
  )
}
