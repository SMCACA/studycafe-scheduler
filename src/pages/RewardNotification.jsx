import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import { createClient } from '@supabase/supabase-js'
import {
  Star, AlertTriangle, Plus, Trash2, MessageSquare,
  ChevronDown, Copy, CheckCheck, Edit3, Save, X, Loader, // ✅ Loader 추가
} from 'lucide-react'
import { sendNotification } from '../lib/sendNotification' // ✅ 추가

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

const STORAGE_KEY = 'smc_reward_templates'

const DEFAULT_TEMPLATES = [
  { id: 'default1', type: '상점', title: '성실한 출석',    content: '이번 주 개근 및 성실한 학습 태도를 보여주었습니다. 앞으로도 꾸준히 노력해주세요! 😊' },
  { id: 'default2', type: '상점', title: '시험 성적 향상', content: '이번 시험에서 눈에 띄는 성적 향상을 보여주었습니다. 정말 열심히 노력한 결과입니다! 👏' },
  { id: 'default3', type: '벌점', title: '무단 결석',       content: '사전 연락 없이 등원하지 않았습니다. 결석 시 반드시 사전에 연락 부탁드립니다.' },
  { id: 'default4', type: '벌점', title: '규정 위반',       content: '스터디카페 이용 규정을 위반하였습니다. 다른 학생들을 위해 규정 준수를 부탁드립니다.' },
]

/* ── 스타일 상수 (컴포넌트 바깥에 선언 → ESLint 오류 없음) ── */
const inputStyle = {
  width: '100%', padding: '10px 14px',
  borderRadius: '10px', border: '1.5px solid #E2E8F0',
  fontSize: '13px', outline: 'none', background: '#F8FAFC', color: '#0F172A',
  boxSizing: 'border-box',
}

const iconBtnStyle = (color) => ({
  width: '28px', height: '28px', borderRadius: '8px',
  border: `1.5px solid ${color}`,
  background: 'transparent',
  color: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', transition: 'all 0.15s',
})

const typeBadge = (type) =>
  type === '상점'
    ? { bg: '#FFFBEB', color: '#D97706', border: '#FDE68A' }
    : { bg: '#FFF1F2', color: '#E11D48', border: '#FECDD3' }

/* ════════════════════════════════════════
   메인 컴포넌트
════════════════════════════════════════ */
export default function RewardNotification() {
  const [students,         setStudents]         = useState([])
  const [selectedId,       setSelectedId]        = useState('')
  const [templates,        setTemplates]         = useState([])
  const [selectedTemplate, setSelectedTemplate]  = useState(null)
  const [score,            setScore]             = useState('')
  const [loading,          setLoading]           = useState(false)
  const [copied,           setCopied]            = useState(false)
  const [sending,          setSending]           = useState(false)
  const [recipient,        setRecipient]         = useState('parent') // 'parent' | 'student'

  /* 문구 추가 폼 상태 */
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId,   setEditingId]   = useState(null)
  const [formType,    setFormType]    = useState('상점')
  const [formTitle,   setFormTitle]   = useState('')
  const [formContent, setFormContent] = useState('')

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

  /* ─ 초기 로드 ─ */
  useEffect(() => {
    fetchStudents()
    const saved = localStorage.getItem(STORAGE_KEY)
    setTemplates(saved ? JSON.parse(saved) : DEFAULT_TEMPLATES)
  }, [fetchStudents])  // fetchStudents를 deps에 포함 (useCallback 덕분에 무한루프 없음)

  /* ─ 템플릿 저장 헬퍼 ─ */
  const saveToStorage = (list) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    setTemplates(list)
  }

  /* ─ 문구 저장 / 수정 ─ */
  const handleSaveTemplate = () => {
    if (!formTitle.trim() || !formContent.trim()) return
    let updated
    if (editingId) {
      updated = templates.map(t =>
        t.id === editingId
          ? { ...t, type: formType, title: formTitle, content: formContent }
          : t
      )
      if (selectedTemplate?.id === editingId)
        setSelectedTemplate({ ...selectedTemplate, type: formType, title: formTitle, content: formContent })
    } else {
      const newT = { id: Date.now().toString(), type: formType, title: formTitle, content: formContent }
      updated = [...templates, newT]
    }
    saveToStorage(updated)
    resetForm()
  }

  /* ─ 문구 편집 시작 ─ */
  const handleEditTemplate = (t) => {
    setEditingId(t.id)
    setFormType(t.type)
    setFormTitle(t.title)
    setFormContent(t.content)
    setShowAddForm(true)
  }

  /* ─ 문구 삭제 ─ */
  const handleDeleteTemplate = (id) => {
    saveToStorage(templates.filter(t => t.id !== id))
    if (selectedTemplate?.id === id) setSelectedTemplate(null)
  }

  /* ─ 폼 초기화 ─ */
  const resetForm = () => {
    setShowAddForm(false)
    setEditingId(null)
    setFormType('상점')
    setFormTitle('')
    setFormContent('')
  }

  const selectedStudent = students.find(s => s.id === selectedId)

  /* ─ 알림톡 미리보기 텍스트 ─ */
  const getPreviewText = () => {
    if (!selectedStudent || !selectedTemplate) return ''
    const date = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
    const icon = selectedTemplate.type === '상점' ? '⭐' : '⚠️'
    const sign = selectedTemplate.type === '상점' ? '+' : '-'
    // ✅ 공통 인사말 - 학부모 개인 이름 제거 (학부모/학생 관계없이 통일된 내용)
    const greeting = recipient === 'parent' ? '학부모님' : `${selectedStudent.name} 학생`
    const lines = [
      `[SMC 스터디카페] ${icon} ${selectedTemplate.type} 알림`,
      '',
      `안녕하세요, ${greeting}!`,
      `${selectedStudent.name} 학생의 ${selectedTemplate.type} 알림을 드립니다.`,
      '',
      `📌 사유: ${selectedTemplate.title}`,
      `📝 내용: ${selectedTemplate.content}`,
    ]
    if (score) lines.push(`🎯 ${selectedTemplate.type}: ${sign}${score}점`)
    lines.push(`📅 날짜: ${date}`)
    lines.push('')
    lines.push('문의사항은 원으로 연락 주세요 😊')
    return lines.join('\n')
  }

  const handleCopy = () => {
    const text = getPreviewText()
    if (!text) return
    navigator.clipboard.writeText(text)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
      .catch(() => alert('복사 실패 – 브라우저 권한을 확인해주세요'))
  }

  // ✅ 실제 알림톡 발송 함수
  const handleSend = async () => {
    if (!canSend) return

    const targetPhone = recipient === 'parent'
      ? selectedStudent.parent_phone
      : selectedStudent.student_phone

    if (!targetPhone) {
      const who = recipient === 'parent' ? '학부모 전화번호' : '학생 전화번호'
      alert(`❌ ${who}가 없습니다!\n\n학생 관리 페이지에서 번호를 먼저 등록해주세요.`)
      return
    }

    const icon = selectedTemplate.type === '상점' ? '⭐' : '⚠️'
    const recipientLabel = recipient === 'parent'
      ? `${selectedStudent.parent_name || '학부모님'} (학부모)`
      : `${selectedStudent.name} (학생 본인)`

    const confirmed = window.confirm(
      `📱 알림톡을 발송할까요?\n\n` +
      `수신자: ${recipientLabel}\n` +
      `연락처: ${targetPhone}\n` +
      `학생: ${selectedStudent.name}\n` +
      `내용: ${icon} ${selectedTemplate.type} - ${selectedTemplate.title}`
    )
    if (!confirmed) return

    setSending(true)
    try {
      await sendNotification({
        to:   targetPhone,
        text: getPreviewText(),
        type: 'reward',
      })
      alert(`✅ 발송 완료!\n\n${recipientLabel}께 ${selectedTemplate.type} 알림톡이 전송되었습니다.`)
    } catch (err) {
      alert(`❌ 발송 실패\n\n${err.message}`)
    } finally {
      setSending(false)
    }
  }

  const canSend = selectedStudent && selectedTemplate

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
              학생 상벌점 내용을 학부모님께 알림톡으로 전달해요
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
                    <span style={{ fontSize: '11px', color: phone ? '#64748B' : '#EF4444', marginTop: '2px' }}>
                      {phone || '번호 없음'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </StepCard>

        {/* ── STEP 2: 문구 선택 ── */}
        <StepCard step="2" title="문구 선택" style={{ marginBottom: '16px' }}>

          {templates.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '12px' }}>
              저장된 문구가 없어요. 아래에서 문구를 추가해주세요.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
              {templates.map(t => {
                const bs = typeBadge(t.type)
                const isSelected = selectedTemplate?.id === t.id
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTemplate(isSelected ? null : t)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '12px',
                      padding: '12px 14px', borderRadius: '12px', cursor: 'pointer',
                      border: isSelected ? '2px solid #6366F1' : '1.5px solid #E2E8F0',
                      background: isSelected ? '#F5F3FF' : '#FAFBFF',
                      transition: 'all 0.15s',
                    }}
                  >
                    {/* 유형 뱃지 */}
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      padding: '3px 10px', borderRadius: '999px', flexShrink: 0,
                      fontSize: '11px', fontWeight: 700,
                      background: bs.bg, color: bs.color, border: `1px solid ${bs.border}`,
                    }}>
                      {t.type === '상점'
                        ? <Star size={10} />
                        : <AlertTriangle size={10} />}
                      {t.type}
                    </span>

                    {/* 제목 + 내용 미리보기 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B', margin: 0 }}>
                        {t.title}
                      </p>
                      <p style={{
                        fontSize: '12px', color: '#64748B', marginTop: '3px',
                        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                      }}>
                        {t.content}
                      </p>
                    </div>

                    {/* 편집 / 삭제 버튼 */}
                    <div
                      style={{ display: 'flex', gap: '4px', flexShrink: 0 }}
                      onClick={e => e.stopPropagation()}
                    >
                      <button onClick={() => handleEditTemplate(t)} style={iconBtnStyle('#6366F1')}>
                        <Edit3 size={12} />
                      </button>
                      <button onClick={() => handleDeleteTemplate(t.id)} style={iconBtnStyle('#EF4444')}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* 문구 추가 버튼 or 추가 폼 */}
          {!showAddForm ? (
            <button
              onClick={() => setShowAddForm(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '9px 16px', borderRadius: '10px',
                border: '1.5px dashed #CBD5E1', background: 'transparent',
                color: '#64748B', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366F1'; e.currentTarget.style.color = '#6366F1' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.color = '#64748B' }}
            >
              <Plus size={15} /> 문구 추가
            </button>
          ) : (
            /* 문구 추가 / 수정 폼 */
            <div style={{
              padding: '16px', borderRadius: '14px',
              border: '1.5px solid #C7D2FE', background: '#F5F3FF', marginTop: '4px',
            }}>
              <p style={{ fontSize: '12px', fontWeight: 700, color: '#4F46E5', marginBottom: '12px' }}>
                {editingId ? '✏️ 문구 수정' : '✏️ 새 문구 추가'}
              </p>

              {/* 상점 / 벌점 선택 */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                {['상점', '벌점'].map(tp => (
                  <button
                    key={tp}
                    onClick={() => setFormType(tp)}
                    style={{
                      padding: '7px 20px', borderRadius: '999px',
                      border: formType === tp ? 'none' : '1.5px solid #E2E8F0',
                      background: formType === tp ? (tp === '상점' ? '#D97706' : '#E11D48') : '#fff',
                      color: formType === tp ? '#fff' : '#64748B',
                      fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    {tp === '상점' ? '⭐ 상점' : '⚠️ 벌점'}
                  </button>
                ))}
              </div>

              {/* 사유 제목 입력 */}
              <input
                placeholder="사유 제목 (예: 성실한 출석)"
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                style={inputStyle}
              />

              {/* 내용 입력 */}
              <textarea
                placeholder="상세 내용 (학부모께 전달될 메시지)"
                value={formContent}
                onChange={e => setFormContent(e.target.value)}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', marginTop: '8px' }}
              />

              {/* 저장 / 취소 버튼 */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button
                  onClick={handleSaveTemplate}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 18px', borderRadius: '10px', border: 'none',
                    background: '#6366F1', color: '#fff',
                    fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  <Save size={14} /> {editingId ? '수정 저장' : '저장'}
                </button>
                <button
                  onClick={resetForm}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 16px', borderRadius: '10px',
                    border: '1.5px solid #E2E8F0', background: '#fff',
                    color: '#64748B', fontSize: '13px', cursor: 'pointer',
                  }}
                >
                  <X size={14} /> 취소
                </button>
              </div>
            </div>
          )}
        </StepCard>

        {/* ── STEP 3: 점수 입력 ── */}
        <StepCard step="3" title="점수 입력 (선택)" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ position: 'relative', width: '160px' }}>
              <input
                type="number"
                placeholder="예: 5"
                min="0"
                max="100"
                value={score}
                onChange={e => setScore(e.target.value)}
                style={{ ...inputStyle, paddingRight: '40px' }}
              />
              <span style={{
                position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                fontSize: '13px', color: '#94A3B8', pointerEvents: 'none',
              }}>점</span>
            </div>
            <p style={{ fontSize: '13px', color: '#94A3B8' }}>비워두면 점수 없이 내용만 전달돼요</p>
          </div>
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
              background: selectedTemplate.type === '상점'
                ? 'linear-gradient(135deg,#F59E0B 0%,#D97706 100%)'
                : 'linear-gradient(135deg,#F43F5E 0%,#E11D48 100%)',
              padding: '20px 28px',
            }}>
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', marginBottom: '6px' }}>
                PREVIEW · 알림톡 미리보기
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {selectedTemplate.type === '상점'
                  ? <Star size={22} style={{ color: '#fff' }} />
                  : <AlertTriangle size={22} style={{ color: '#fff' }} />}
                <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: 800, margin: 0 }}>
                  {selectedStudent.name} · {selectedTemplate.title}
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

              {/* ✅ 알림톡 발송 버튼 (실제 발송 구현) */}
              <button
                onClick={handleSend}
                disabled={sending}
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  padding: '10px 20px', borderRadius: '12px', border: 'none',
                  background: sending
                    ? 'linear-gradient(135deg,#FCA5A5,#FDA4AF)'
                    : selectedTemplate.type === '상점'
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
          /* 아직 학생/문구 미선택 상태 */
          <div style={{
            textAlign: 'center', padding: '48px 0',
            background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0',
          }}>
            <p style={{ fontSize: '36px', marginBottom: '10px' }}>
              {!selectedStudent ? '👆' : '📋'}
            </p>
            <p style={{ color: '#64748B', fontWeight: 600, fontSize: '14px' }}>
              {!selectedStudent
                ? '위에서 학생을 선택하고 문구를 골라주세요'
                : '문구를 선택하면 알림톡 미리보기가 나타나요'}
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
