import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { createClient } from '@supabase/supabase-js'
import { Eye, Copy, CheckCheck, MessageSquare, ChevronDown, Loader, Link } from 'lucide-react'
import { sendNotificationMulti } from '../lib/sendNotification'
import { loadTimeConfig, saveSnapshot, buildImageUrlFromId, DEFAULT_TIME_CONFIG } from '../lib/timeSlotConfig'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// ✅ [추가] 요일별 기본 교시 수 (DB에서 불러오기 전 초기값)
//    비유: "기본 영업시간표" — DB 연결 전에도 최소한 이 설정으로 동작함
const DEFAULT_SLOT_CONFIG = { mon:5, tue:5, wed:5, thu:5, fri:5, sat:10, sun:10 }

// ✅ [수정] cfgKey 추가 (슬롯 설정 조회용 키)
//    DAY_KEYS[i].cfgKey → DEFAULT_SLOT_CONFIG / DB schedule_slot_config 의 day_key 와 일치
const DAY_KEYS = [
  { key:'mon_slots', label:'월요일', short:'월', type:'weekday', cfgKey:'mon' },
  { key:'tue_slots', label:'화요일', short:'화', type:'weekday', cfgKey:'tue' },
  { key:'wed_slots', label:'수요일', short:'수', type:'weekday', cfgKey:'wed' },
  { key:'thu_slots', label:'목요일', short:'목', type:'weekday', cfgKey:'thu' },
  { key:'fri_slots', label:'금요일', short:'금', type:'weekday', cfgKey:'fri' },
  { key:'sat_slots', label:'토요일', short:'토', type:'weekend', cfgKey:'sat' },
  { key:'sun_slots', label:'일요일', short:'일', type:'weekend', cfgKey:'sun' },
]

// ✅ [추가] 교시 수 설정을 Supabase DB에서 불러오는 함수
//    비유: "오늘 수업 교시 수 공지판"을 창고(DB)에서 가져오는 단계
async function loadSlotConfigFromDB() {
  try {
    const { data, error } = await supabase
      .from('schedule_slot_config')
      .select('day_key, slot_count')
    if (error || !data || data.length === 0) return { ...DEFAULT_SLOT_CONFIG }
    const cfg = { ...DEFAULT_SLOT_CONFIG }
    data.forEach(row => {
      if (row.day_key in cfg) cfg[row.day_key] = Number(row.slot_count)
    })
    return cfg
  } catch {
    return { ...DEFAULT_SLOT_CONFIG }
  }
}

// ✅ [추가] 회원권 종류에 따라 해당 요일이 허용되는지 확인
//    비유: 평일 회원은 주말 자리에 앉을 수 없음
const isDayAllowed = (membershipType, dayType) => {
  if (membershipType === '풀') return true
  if (membershipType === '평일' && dayType === 'weekday') return true
  if (membershipType === '주말' && dayType === 'weekend') return true
  return false
}

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
  const [students,    setStudents]    = useState([])
  const [schedules,   setSchedules]   = useState([])
  const [slotConfig,  setSlotConfig]  = useState({...DEFAULT_SLOT_CONFIG}) // ✅ [추가] 교시 설정
  const [selectedId,  setSelectedId]  = useState('')
  const [loading,     setLoading]     = useState(false)
  const [copied,      setCopied]      = useState(false)
  const [sending,     setSending]     = useState(false)
  const [recipient,   setRecipient]   = useState('parent')
  const [sendResult,  setSendResult]  = useState(null)
  const [timeConfig,  setTimeConfig]  = useState({...DEFAULT_TIME_CONFIG})
  const [linkCopied,  setLinkCopied]  = useState(false)
  const [copiedUrl,   setCopiedUrl]   = useState('')

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    // ✅ [수정] slotConfig도 함께 불러오기
    const [{ data:sts }, { data:schs }, timeCfg, slotCfg] = await Promise.all([
      supabase.from('students').select('*').eq('status', '재원생').order('name'),
      supabase.from('schedules').select('*'),
      loadTimeConfig(supabase),
      loadSlotConfigFromDB(),   // ✅ 교시 설정 DB에서 로드
    ])
    if (sts)     setStudents(sts)
    if (schs)    setSchedules(schs)
    if (timeCfg) setTimeConfig(timeCfg)
    if (slotCfg) setSlotConfig(slotCfg)  // ✅ 교시 설정 반영
    setLoading(false)
  }

  const selectedStudent  = students.find(s => s.id === selectedId)
  const selectedSchedule = schedules.find(s => s.student_id === selectedId)

  // ──────────────────────────────────────────────────────────────
  // ✅ [핵심 수정] 현재 slotConfig + 회원권을 기준으로 필터링된 슬롯 계산
  //
  //  비유: "출석부 정리" 단계
  //    ① 평일 회원이면 주말 칸은 지운다 (회원권 필터)
  //    ② 현재 교시 설정(1~5교시)을 넘는 번호는 지운다 (교시 수 필터)
  //    ③ 숫자가 아닌 이상한 값도 지운다 (타입 안전)
  //
  //  이 과정을 거친 슬롯만 알림톡 시간표 이미지에 들어갑니다.
  // ──────────────────────────────────────────────────────────────
  const getFilteredSlots = (schedule) => {
    if (!schedule) return {}
    const membershipType = schedule.membership_type || '풀'
    const filtered = {}

    for (const day of DAY_KEYS) {
      // ① 회원권에 해당하지 않는 요일 → 빈 배열
      if (!isDayAllowed(membershipType, day.type)) {
        filtered[day.key] = []
        continue
      }
      // ② 현재 교시 설정 범위(1 ~ maxPeriod) 내의 정수만 허용
      const maxPeriod = slotConfig[day.cfgKey] || 5
      const rawSlots  = schedule[day.key] || []
      filtered[day.key] = rawSlots
        .filter(p => Number.isFinite(p) && Number.isInteger(p) && p >= 1 && p <= maxPeriod)
        .sort((a, b) => a - b)
    }
    return filtered
  }

  // ✅ [수정] 필터링된 슬롯을 활성 요일/교시 계산에 사용
  const filteredSlots = selectedSchedule ? getFilteredSlots(selectedSchedule) : {}

  const activeDays = selectedSchedule
    ? DAY_KEYS.filter(d => {
        const slots = filteredSlots[d.key]
        return Array.isArray(slots) && slots.length > 0
      })
    : []

  const totalPeriods = activeDays.reduce((sum, d) =>
    sum + (filteredSlots[d.key]?.length || 0), 0)

  // ✅ [수정] 링크 복사 시에도 필터링된 슬롯 사용
  const handleLinkCopy = async () => {
    if (!selectedStudent || !selectedSchedule) return
    try {
      const filteredSchedule = { ...selectedSchedule, ...filteredSlots }
      const id  = await saveSnapshot(selectedStudent, filteredSchedule, timeConfig)
      const url = buildImageUrlFromId(id)
      setCopiedUrl(url)
      await navigator.clipboard.writeText(url)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2500)
    } catch (err) {
      alert(`링크 생성 실패: ${err.message}`)
    }
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

    setSending(true)
    setSendResult(null)

    let linkWithoutProtocol
    try {
      // ✅ [핵심 수정] 필터링된 슬롯(현재 교시 설정 + 회원권 기준)으로 스냅샷 저장
      //    - 설정된 교시 수(slotConfig) 초과 데이터 제거
      //    - 회원권 범위 외 요일 데이터 제거
      //    이렇게 해야 알림톡 시간표 이미지가 현재 저장된 스케줄과 정확히 일치합니다.
      const filteredSchedule = { ...selectedSchedule, ...filteredSlots }
      const id  = await saveSnapshot(selectedStudent, filteredSchedule, timeConfig)
      const imageUrl = buildImageUrlFromId(id)
      // 솔라피 규정: 버튼 URL 변수에는 https:// 제외한 뒷부분만
      linkWithoutProtocol = imageUrl.replace(/^https?:\/\//, '')
    } catch (err) {
      setSendResult({ ok:false, msg:`시간표 저장 실패: ${err.message}` })
      setSending(false)
      return
    }

    // ✅ 알림톡 템플릿 변수
    const variables = {
      '#{학생이름}':     selectedStudent.name,
      '#{좌석번호}':     String(selectedStudent.seat_number ?? selectedSchedule?.seat_number ?? '미지정'),
      '#{멤버십}':       selectedSchedule?.membership_type || '–',
      '#{시간표링크}':   linkWithoutProtocol,
    }

    // ✅ 알림톡 버튼
    const buttons = [{
      buttonType: 'WL',
      buttonName: '📅 시간표 확인하기',
      linkMo: 'https://#{시간표링크}',
      linkPc: 'https://#{시간표링크}',
    }]

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

              {/* ✅ [수정] 필터링된 슬롯(filteredSlots)으로 활성 요일 표시 */}
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                {activeDays.length === 0 ? (
                  <p style={{ fontSize:'13px', color:'#94A3B8' }}>현재 설정된 교시 범위 내에 등원 스케줄이 없어요</p>
                ) : (
                  activeDays.map(d => {
                    const slots = filteredSlots[d.key]
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
                  })
                )}
              </div>

              {/* ✅ [추가] 필터링 안내 메시지 */}
              <p style={{ fontSize:'11px', color:'#94A3B8', marginTop:'12px' }}>
                💡 현재 교시 설정(평일 최대 {slotConfig.mon}교시) 및 {selectedSchedule.membership_type} 회원권 기준으로 표시됩니다
              </p>
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

            {/* 수신자 선택 + 발송 버튼 */}
            <div style={{ background:'#fff', borderRadius:'16px', border:'1px solid #E2E8F0', padding:'20px', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
              <p style={{ fontSize:'12px', fontWeight:700, color:'#374151', marginBottom:'12px' }}>📤 발송 설정</p>

              {/* 수신자 선택 */}
              <div style={{ display:'flex', gap:'8px', marginBottom:'12px' }}>
                {RECIPIENT_OPTIONS.map(opt => {
                  const isActive = recipient === opt.value
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
                    value={copiedUrl}
                    placeholder="복사 버튼을 누르면 짧은 링크가 생성됩니다"
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
                <button onClick={handleSend} disabled={sending || getPhoneNumbers().length===0 || activeDays.length===0} style={{
                  display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
                  flex:1, padding:'12px', borderRadius:'12px', border:'none',
                  background: (sending || getPhoneNumbers().length===0 || activeDays.length===0) ? '#A5B4FC' : 'linear-gradient(135deg,#6366F1,#7C3AED)',
                  fontSize:'14px', fontWeight:700, color:'#fff',
                  cursor: (sending || getPhoneNumbers().length===0 || activeDays.length===0) ? 'not-allowed' : 'pointer',
                  boxShadow:'0 4px 14px rgba(99,102,241,0.35)',
                }}>
                  {sending
                    ? <><Loader size={16} style={{ animation:'spin 1s linear infinite' }} /> 발송 중…</>
                    : <><MessageSquare size={16} /> 알림톡 발송</>
                  }
                </button>
              </div>

              {/* ✅ [추가] 발송 불가 안내 (필터링 결과 활성 교시가 없는 경우) */}
              {activeDays.length === 0 && (
                <p style={{ fontSize:'12px', color:'#EF4444', marginTop:'10px', textAlign:'center' }}>
                  ⚠️ 현재 교시 설정 범위 내에 등원 스케줄이 없어 발송할 수 없어요.<br />
                  스케줄 관리 페이지에서 스케줄을 확인해주세요.
                </p>
              )}
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
