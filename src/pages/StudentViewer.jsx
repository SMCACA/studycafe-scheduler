import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { createClient } from '@supabase/supabase-js'
import { Eye, Copy, CheckCheck, MessageSquare, ChevronDown, Loader, Link, Clock } from 'lucide-react'
import { sendNotificationMulti } from '../lib/sendNotification'
import { loadTimeConfig, buildPublicUrl, buildImageUrl, DEFAULT_TIME_CONFIG } from '../lib/timeSlotConfig'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

const DAY_KEYS = [
  { key:'mon_slots', label:'월요일', short:'월', type:'weekday' },
  { key:'tue_slots', label:'화요일', short:'화', type:'weekday' },
  { key:'wed_slots', label:'수요일', short:'수', type:'weekday' },
  { key:'thu_slots', label:'목요일', short:'목', type:'weekday' },
  { key:'fri_slots', label:'금요일', short:'금', type:'weekday' },
  { key:'sat_slots', label:'토요일', short:'토', type:'weekend' },
  { key:'sun_slots', label:'일요일', short:'일', type:'weekend' },
]

const dayStyle = (type, short) => {
  if (short === '일') return { bg:'#FEF2F2', color:'#EF4444' }
  if (type === 'weekend') return { bg:'#FFF7ED', color:'#D97706' }
  return { bg:'#F1F5F9', color:'#475569' }
}

// ✅ 수신자 선택 옵션
const RECIPIENT_OPTIONS = [
  { value:'parent',  label:'학부모',      emoji:'👨‍👩‍👧' },
  { value:'student', label:'학생',        emoji:'🎓' },
  { value:'both',    label:'학부모+학생', emoji:'📨' },
]

export default function StudentViewer() {
  const [students,   setStudents]   = useState([])
  const [schedules,  setSchedules]  = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [loading,    setLoading]    = useState(false)
  const [copied,     setCopied]     = useState(false)
  const [sending,    setSending]    = useState(false)
  const [recipient,  setRecipient]  = useState('parent')   // ✅ 수신자 선택 (기본: 학부모)
  const [sendResult, setSendResult] = useState(null)        // ✅ 발송 결과 메시지
  const [timeConfig,  setTimeConfig]  = useState({...DEFAULT_TIME_CONFIG})  // 교시 → 시간 매핑 (Supabase)
  const [linkCopied,  setLinkCopied]  = useState(false)            // 링크 복사 완료 여부

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data:sts }, { data:schs }, timeCfg] = await Promise.all([
      supabase.from('students').select('*').eq('status', '재원생').order('name'),
      supabase.from('schedules').select('*'),
      loadTimeConfig(supabase),  // ✅ 시간 설정 Supabase에서 로드
    ])
    if (sts)     setStudents(sts)
    if (schs)    setSchedules(schs)
    if (timeCfg) setTimeConfig(timeCfg)
    setLoading(false)
  }

  const selectedStudent  = students.find(s => s.id === selectedId)
  const selectedSchedule = schedules.find(s => s.student_id === selectedId)

  const activeDays = selectedSchedule
    ? DAY_KEYS.filter(d => {
        const slots = selectedSchedule[d.key]
        return Array.isArray(slots) && slots.length > 0
      })
    : []

  const totalPeriods = activeDays.reduce((sum, d) =>
    sum + (selectedSchedule?.[d.key]?.length || 0), 0)

  // 관리자 참고용 HTML 웹페이지 링크
  const publicUrl = (selectedStudent && selectedSchedule)
    ? buildPublicUrl(selectedStudent, selectedSchedule, timeConfig)
    : ''

  // ✅ 알림톡 버튼 링크 (클릭 시 시간표 이미지로 바로 보임)
  const imageUrl = (selectedStudent && selectedSchedule)
    ? buildImageUrl(selectedStudent, selectedSchedule, timeConfig)
    : ''

  // 링크 복사
  const handleLinkCopy = async () => {
    if (!imageUrl) return
    await navigator.clipboard.writeText(imageUrl)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2500)
  }

  const buildMessageText = () => {
    if (!selectedStudent || !selectedSchedule) return ''
    return [
      `[SMC 스터디카페]`,
      `📚 안녕하세요, SMC 관리형 스터디카페입니다.`,
      `${selectedStudent.name} 학생의 등원 시간표를 안내드립니다.`,
      `▶ 좌석번호: ${selectedStudent.seat_number ?? (selectedSchedule.seat_number || '미지정')}번`,
      `▶ 멤버십: ${selectedSchedule.membership_type || '–'}`,
      ``,
      `아래 버튼을 눌러 시간표를 확인해 주세요 📅`,
      ``,
      `문의사항은 010-6748-2577으로 연락 주세요 😊`,
    ].join('\n')
  }

  const handleCopy = async () => {
    const text = buildMessageText()
    if (!text) return
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ✅ 수신자에 따라 전화번호 목록 결정
  const getPhoneNumbers = () => {
    if (!selectedStudent) return []
    const phones = []
    if (recipient === 'parent' || recipient === 'both') {
      if (selectedStudent.parent_phone) phones.push({ label:'학부모', phone: selectedStudent.parent_phone })
    }
    if (recipient === 'student' || recipient === 'both') {
      if (selectedStudent.student_phone) phones.push({ label:'학생', phone: selectedStudent.student_phone })
    }
    return phones
  }

  const handleSend = async () => {
    const text    = buildMessageText()
    const targets = getPhoneNumbers()
    if (!text) return
    if (targets.length === 0) {
      alert(`선택한 수신자(${RECIPIENT_OPTIONS.find(r=>r.value===recipient)?.label})의 전화번호가 등록되지 않았어요.\n학생 관리 페이지에서 번호를 먼저 등록해주세요!`)
      return
    }

    // ✅ 알림톡 템플릿 변수 (#{변수명} 자리에 들어갈 실제 값들)
    // ⚠️ 중요: 솔라피에 승인된 템플릿의 변수와 "정확히 일치"해야 발송됩니다!
    //          (없는 변수를 보내면 카카오가 3109 "잘못된 파라미터"로 거부)
    // 승인된 템플릿 변수: #{학생이름}, #{좌석번호}, #{멤버십}  ← 딱 이 3개만!
    const variables = (selectedStudent && selectedSchedule) ? {
      '#{학생이름}':   selectedStudent.name,
      '#{좌석번호}':   String(selectedStudent.seat_number ?? selectedSchedule?.seat_number ?? '미지정'),
      '#{멤버십}':     selectedSchedule?.membership_type || '–',
    } : undefined

    // ✅ 알림톡 버튼 (시간표 이미지 링크 버튼)
    const buttons = imageUrl ? [{
      buttonType: 'WL',              // WL = Web Link (웹 링크 버튼 유형)
      buttonName: '📅 시간표 확인하기',
      linkMo: imageUrl,              // 모바일에서 클릭 시 열릴 URL
      linkPc: imageUrl,              // PC에서 클릭 시 열릴 URL
    }] : undefined

    setSending(true)
    setSendResult(null)
    try {
      await sendNotificationMulti({ targets, text, type:'schedule', variables, buttons })
      setSendResult({ ok:true, msg:`📨 ${targets.map(t=>t.label).join(', ')}에게 발송 완료!` })
    } catch (err) {
      setSendResult({ ok:false, msg:`발송 실패: ${err.message}` })
    } finally {
      setSending(false)
      setTimeout(() => setSendResult(null), 4000)
    }
  }

  const msgText = buildMessageText()

  return (
    <Layout>
      <div style={{ padding:'28px 32px', maxWidth:'860px' }}>

        {/* 헤더 */}
        <div style={{ display:'flex', alignItems:'center', gap:'14px', marginBottom:'24px' }}>
          <div style={{ width:'46px', height:'46px', borderRadius:'14px', background:'#EEF2FF', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Eye size={22} style={{ color:'#6366F1' }} />
          </div>
          <div>
            <h1 style={{ fontSize:'22px', fontWeight:700, color:'#0F172A', margin:0 }}>스케줄 알림톡</h1>
            <p style={{ fontSize:'13px', color:'#94A3B8', marginTop:'3px' }}>
              재원생 {students.length}명 · 학생 스케줄을 조회하고 알림톡을 발송합니다
            </p>
          </div>
        </div>

        {/* 학생 선택 */}
        <div style={{ background:'#fff', borderRadius:'16px', border:'1px solid #E2E8F0', padding:'20px', marginBottom:'20px', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
          <p style={{ fontSize:'12px', fontWeight:700, color:'#374151', marginBottom:'10px' }}>학생 선택</p>
          <div style={{ position:'relative' }}>
            <ChevronDown size={15} style={{ position:'absolute', right:'14px', top:'50%', transform:'translateY(-50%)', color:'#94A3B8', pointerEvents:'none' }} />
            <select
              value={selectedId} onChange={e => { setSelectedId(e.target.value); setSendResult(null) }}
              style={{ width:'100%', padding:'11px 40px 11px 14px', borderRadius:'12px', border:'1.5px solid #E2E8F0', fontSize:'14px', outline:'none', background:'#fff', color: selectedId ? '#0F172A' : '#94A3B8', appearance:'none', cursor:'pointer' }}
              onFocus={e => { e.target.style.borderColor='#6366F1'; e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,0.1)' }}
              onBlur={e  => { e.target.style.borderColor='#E2E8F0'; e.target.style.boxShadow='none' }}
            >
              <option value="">— 학생을 선택해주세요 —</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.name} {s.grade ? `(${s.grade})` : ''}</option>
              ))}
            </select>
          </div>
        </div>

        {selectedStudent && selectedSchedule && (
          <>
            {/* 스케줄 카드 */}
            <div style={{ background:'#fff', borderRadius:'16px', border:'1px solid #E2E8F0', padding:'20px', marginBottom:'20px', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px' }}>
                <div>
                  <p style={{ fontSize:'17px', fontWeight:700, color:'#0F172A', margin:0 }}>{selectedStudent.name}</p>
                  <p style={{ fontSize:'12px', color:'#94A3B8', margin:'3px 0 0' }}>
                    {selectedStudent.grade} · 좌석 {selectedStudent.seat_number || selectedSchedule.seat_number || '미지정'}번 · 주 {totalPeriods}교시
                  </p>
                </div>
                <span style={{
                  padding:'4px 14px', borderRadius:'999px', fontSize:'12px', fontWeight:700,
                  background: selectedSchedule.membership_type==='풀' ? '#ECFDF5' : selectedSchedule.membership_type==='평일' ? '#EEF2FF' : '#FFF7ED',
                  color:      selectedSchedule.membership_type==='풀' ? '#059669' : selectedSchedule.membership_type==='평일' ? '#4F46E5' : '#D97706',
                }}>{selectedSchedule.membership_type} 멤버십</span>
              </div>

              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                {activeDays.map(d => {
                  const slots = (selectedSchedule[d.key] || []).sort((a,b)=>a-b)
                  const st = dayStyle(d.type, d.short)
                  return (
                    <div key={d.key} style={{ background:st.bg, borderRadius:'12px', padding:'10px 14px', minWidth:'90px' }}>
                      <p style={{ fontSize:'11px', fontWeight:700, color:st.color, margin:'0 0 6px' }}>{d.label}</p>
                      <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
                        {slots.map(p => (
                          <span key={p} style={{ display:'inline-block', padding:'2px 8px', borderRadius:'999px', fontSize:'11px', fontWeight:700, background:'rgba(255,255,255,0.7)', color:st.color }}>
                            {p}교시
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 메시지 미리보기 */}
            <div style={{ background:'#fff', borderRadius:'16px', border:'1px solid #E2E8F0', padding:'20px', marginBottom:'20px', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
              <p style={{ fontSize:'12px', fontWeight:700, color:'#374151', marginBottom:'10px' }}>📋 메시지 미리보기</p>
              <pre style={{
                background:'#F8FAFC', borderRadius:'12px', padding:'16px',
                fontSize:'12px', lineHeight:1.8, color:'#374151',
                whiteSpace:'pre-wrap', fontFamily:'inherit', margin:0,
                border:'1px solid #E2E8F0',
              }}>{msgText}</pre>
            </div>

            {/* ✅ 수신자 선택 + 발송 버튼 */}
            <div style={{ background:'#fff', borderRadius:'16px', border:'1px solid #E2E8F0', padding:'20px', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
              <p style={{ fontSize:'12px', fontWeight:700, color:'#374151', marginBottom:'12px' }}>📤 발송 설정</p>

              {/* 수신자 선택 */}
              <div style={{ display:'flex', gap:'8px', marginBottom:'12px' }}>
                {RECIPIENT_OPTIONS.map(opt => {
                  const isActive = recipient === opt.value
                  // 전화번호 유무 확인
                  const hasPhone = opt.value === 'parent'
                    ? !!selectedStudent.parent_phone
                    : opt.value === 'student'
                    ? !!selectedStudent.student_phone
                    : !!(selectedStudent.parent_phone || selectedStudent.student_phone)
                  return (
                    <button key={opt.value} onClick={() => setRecipient(opt.value)}
                      style={{
                        flex:1, padding:'10px 8px', borderRadius:'12px', fontSize:'13px', fontWeight:600,
                        cursor:'pointer', transition:'all 0.15s', textAlign:'center',
                        border: isActive ? '2px solid #6366F1' : '2px solid #E2E8F0',
                        background: isActive ? '#EEF2FF' : '#F8FAFC',
                        color: isActive ? '#4F46E5' : hasPhone ? '#64748B' : '#CBD5E1',
                        position:'relative',
                      }}>
                      <span style={{ display:'block', fontSize:'18px', marginBottom:'2px' }}>{opt.emoji}</span>
                      {opt.label}
                      {!hasPhone && <span style={{ display:'block', fontSize:'10px', color:'#FCA5A5', marginTop:'2px' }}>번호 없음</span>}
                    </button>
                  )
                })}
              </div>

              {/* 수신자 전화번호 표시 */}
              <div style={{ background:'#F8FAFC', borderRadius:'10px', padding:'10px 14px', marginBottom:'14px', fontSize:'12px', color:'#64748B' }}>
                {getPhoneNumbers().length === 0
                  ? <span style={{ color:'#FCA5A5' }}>⚠️ 선택한 수신자의 전화번호가 없어요</span>
                  : getPhoneNumbers().map(t => (
                    <div key={t.label} style={{ display:'flex', gap:'8px' }}>
                      <span style={{ fontWeight:700, color:'#374151' }}>{t.label}:</span>
                      <span>{t.phone}</span>
                    </div>
                  ))
                }
              </div>

              {/* 발송 결과 */}
              {sendResult && (
                <div style={{
                  padding:'10px 14px', borderRadius:'10px', marginBottom:'12px', fontSize:'13px', fontWeight:600,
                  background: sendResult.ok ? '#ECFDF5' : '#FEF2F2',
                  color:      sendResult.ok ? '#059669' : '#EF4444',
                  border:     `1px solid ${sendResult.ok ? '#A7F3D0' : '#FECACA'}`,
                }}>{sendResult.msg}</div>
              )}

              {/* 시간표 링크 섹션 */}
              <div style={{
                background:'#FFFBEB', border:'1px solid #FDE68A',
                borderRadius:'12px', padding:'12px 14px', marginBottom:'12px',
              }}>
                <p style={{ fontSize:'11px', fontWeight:700, color:'#92400E', marginBottom:'8px' }}>
                  🖼️ 알림톡 시간표 이미지 링크
                </p>
                <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                  <input
                    readOnly
                    value={imageUrl}
                    style={{
                      flex:1, padding:'7px 10px', borderRadius:'8px', fontSize:'11px',
                      border:'1px solid #FDE68A', background:'#fff', color:'#64748B',
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                      outline:'none',
                    }}
                  />
                  <button onClick={handleLinkCopy} style={{
                    display:'flex', alignItems:'center', gap:'6px', flexShrink:0,
                    padding:'7px 12px', borderRadius:'8px', border:'none',
                    background: linkCopied ? '#D1FAE5' : '#FDE68A',
                    color: linkCopied ? '#059669' : '#92400E',
                    fontSize:'12px', fontWeight:700, cursor:'pointer',
                    transition:'all 0.2s',
                  }}>
                    {linkCopied ? <><CheckCheck size={13} /> 복사됨</> : <><Link size={13} /> 복사</>}
                  </button>
                </div>
                <p style={{ fontSize:'10px', color:'#D97706', marginTop:'6px' }}>
                  💡 이 링크 클릭 시 시간표 이미지가 바로 보여요 (알림톡 버튼에 자동 포함)
                </p>
              </div>

              <div style={{ display:'flex', gap:'10px' }}>
                <button onClick={handleCopy} style={{
                  display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
                  flex:1, padding:'12px', borderRadius:'12px',
                  border:'1.5px solid #E2E8F0', background:'#fff',
                  fontSize:'14px', fontWeight:600, color:'#475569', cursor:'pointer',
                }}>
                  {copied ? <><CheckCheck size={16} style={{ color:'#059669' }} /> 복사됨!</> : <><Copy size={16} /> 메시지 복사</>}
                </button>
                <button onClick={handleSend} disabled={sending || getPhoneNumbers().length===0} style={{
                  display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
                  flex:1, padding:'12px', borderRadius:'12px', border:'none',
                  background: (sending || getPhoneNumbers().length===0) ? '#A5B4FC' : 'linear-gradient(135deg,#6366F1,#7C3AED)',
                  fontSize:'14px', fontWeight:700, color:'#fff',
                  cursor: (sending || getPhoneNumbers().length===0) ? 'not-allowed' : 'pointer',
                  boxShadow:'0 4px 14px rgba(99,102,241,0.35)',
                }}>
                  {sending
                    ? <><Loader size={16} style={{ animation:'spin 1s linear infinite' }} /> 발송 중…</>
                    : <><MessageSquare size={16} /> 알림톡 발송</>
                  }
                </button>
              </div>
            </div>
          </>
        )}

        {selectedId && !selectedSchedule && (
          <div style={{ textAlign:'center', padding:'60px 0', background:'#fff', borderRadius:'16px', border:'1px solid #E2E8F0' }}>
            <p style={{ fontSize:'32px', marginBottom:'8px' }}>📭</p>
            <p style={{ color:'#64748B', fontWeight:600 }}>아직 스케줄이 등록되지 않은 학생이에요</p>
            <p style={{ fontSize:'13px', color:'#94A3B8', marginTop:'4px' }}>스케줄 설정 페이지에서 먼저 스케줄을 등록해주세요</p>
          </div>
        )}
      </div>
    </Layout>
  )
}
