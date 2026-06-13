import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { createClient } from '@supabase/supabase-js'
import { Eye, Copy, CheckCheck, MessageSquare, ChevronDown, Loader } from 'lucide-react'
import { sendNotification } from '../lib/sendNotification' // ✅ 추가

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

// 요일 색상
const dayStyle = (type, short) => {
  if (short === '일') return { bg:'#FEF2F2', color:'#EF4444' }
  if (type === 'weekend') return { bg:'#FFF7ED', color:'#D97706' }
  return { bg:'#F1F5F9', color:'#475569' }
}

export default function StudentViewer() {
  const [students,   setStudents]   = useState([])
  const [schedules,  setSchedules]  = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [loading,    setLoading]    = useState(false)
  const [copied,     setCopied]     = useState(false)
  const [sending,    setSending]    = useState(false) // ✅ 추가: 발송 중 상태

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data:sts }, { data:schs }] = await Promise.all([
      supabase.from('students').select('*').order('name'),
      supabase.from('schedules').select('*'),
    ])
    if (sts)  setStudents(sts)
    if (schs) setSchedules(schs)
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

  // ──────────────────────────────────────────────
  // ✅ 추가: 메시지 텍스트를 만드는 함수 (복사/발송 공용)
  // ──────────────────────────────────────────────
  const buildMessageText = () => {
    if (!selectedStudent || !selectedSchedule) return ''
    const lines = [
      `[SMC 스터디카페] 📚`, ``,
      `안녕하세요, ${selectedStudent.parent_name || '학부모님'}!`,
      `${selectedStudent.name} 학생의 등원 스케줄을 안내드립니다.`, ``,
      `▶ 좌석번호: ${selectedStudent.seat_number ?? (selectedSchedule.seat_number || '미지정')}번`,
      `▶ 멤버십: ${selectedSchedule.membership_type || '–'}`, ``,
      `📅 주간 스케줄`,
      ...activeDays.map(d => {
        const slots = selectedSchedule[d.key] || []
        return `  ${d.label}: ${slots.sort((a,b)=>a-b).join(', ')}교시`
      }), ``,
      `문의사항은 원으로 연락 주세요 😊`,
    ]
    return lines.join('\n')
  }

  const handleCopyText = () => {
    if (!selectedStudent || !selectedSchedule) return
    const text = buildMessageText()
    navigator.clipboard.writeText(text)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
      .catch(() => alert('복사 실패 – 브라우저 권한을 확인해주세요'))
  }

  // ──────────────────────────────────────────────
  // ✅ 추가: 실제 알림톡 발송 함수
  // ──────────────────────────────────────────────
  const handleSend = async () => {
    if (!selectedStudent || !selectedSchedule) return
    if (!selectedStudent.parent_phone) {
      alert('❌ 학부모 전화번호가 없습니다!\n\n학생 관리 페이지에서 번호를 먼저 등록해주세요.')
      return
    }

    const confirm = window.confirm(
      `📱 알림톡을 발송할까요?\n\n` +
      `수신자: ${selectedStudent.parent_name || '학부모님'} (${selectedStudent.parent_phone})\n` +
      `학생: ${selectedStudent.name}`
    )
    if (!confirm) return

    setSending(true)
    try {
      await sendNotification({
        to:   selectedStudent.parent_phone,
        text: buildMessageText(),
        type: 'schedule',
      })
      alert(`✅ 발송 완료!\n\n${selectedStudent.name} 학생의 학부모님께 알림톡이 전송되었습니다.`)
    } catch (err) {
      alert(`❌ 발송 실패\n\n${err.message}`)
    } finally {
      setSending(false)
    }
  }
  const membershipBadge = (type) => {
    const map = {
      풀:   { bg:'#ECFDF5', color:'#059669', border:'#A7F3D0' },
      평일: { bg:'#EEF2FF', color:'#4F46E5', border:'#C7D2FE' },
      주말: { bg:'#FFF7ED', color:'#D97706', border:'#FDE68A' },
    }
    return map[type] || map['풀']
  }

  return (
    <Layout>
      <div style={{ padding:'28px 32px', maxWidth:'760px' }}>

        {/* ── 페이지 헤더 ── */}
        <div style={{ display:'flex', alignItems:'center', gap:'14px', marginBottom:'28px' }}>
          <div style={{
            width:'46px', height:'46px', borderRadius:'14px',
            background:'#F5F3FF', display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <Eye size={22} style={{ color:'#7C3AED' }} />
          </div>
          <div>
            <h1 style={{ fontSize:'22px', fontWeight:700, color:'#0F172A', margin:0 }}>개인 스케줄 뷰어</h1>
            <p style={{ fontSize:'13px', color:'#94A3B8', marginTop:'3px' }}>학생별 스케줄을 확인하고 알림톡으로 공유할 수 있어요</p>
          </div>
        </div>

        {/* ── 학생 선택 카드 ── */}
        <div style={{
          background:'#fff', borderRadius:'16px', padding:'20px',
          border:'1px solid #E2E8F0', marginBottom:'20px',
          boxShadow:'0 1px 4px rgba(0,0,0,0.04)',
        }}>
          <label style={{ fontSize:'12px', fontWeight:700, color:'#374151', display:'block', marginBottom:'10px', letterSpacing:'0.02em' }}>
            학생 선택
          </label>
          {loading ? (
            <p style={{ fontSize:'13px', color:'#94A3B8' }}>학생 목록 불러오는 중...</p>
          ) : (
            <div style={{ position:'relative' }}>
              <select
                value={selectedId}
                onChange={e => setSelectedId(e.target.value)}
                style={{
                  width:'100%', padding:'11px 40px 11px 14px',
                  borderRadius:'12px', border:'1.5px solid #E2E8F0',
                  fontSize:'14px', outline:'none', background:'#F8FAFC',
                  color: selectedId ? '#0F172A' : '#94A3B8',
                  appearance:'none', cursor:'pointer',
                }}
                onFocus={e => { e.target.style.borderColor='#6366F1'; e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,0.1)' }}
                onBlur={e  => { e.target.style.borderColor='#E2E8F0'; e.target.style.boxShadow='none' }}
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
                position:'absolute', right:'12px', top:'50%',
                transform:'translateY(-50%)', color:'#94A3B8', pointerEvents:'none',
              }} />
            </div>
          )}
        </div>

        {/* ── 스케줄 카드 ── */}
        {selectedStudent && selectedSchedule ? (
          <div style={{
            background:'#fff', borderRadius:'20px',
            border:'1px solid #E2E8F0', overflow:'hidden',
            boxShadow:'0 4px 16px rgba(0,0,0,0.06)',
          }}>

            {/* 카드 헤더 — 인디고 그라데이션 */}
            <div style={{
              background:'linear-gradient(135deg, #6366F1 0%, #7C3AED 100%)',
              padding:'24px 28px',
            }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
                <div>
                  <p style={{ color:'rgba(255,255,255,0.6)', fontSize:'11px', marginBottom:'6px', letterSpacing:'0.08em', fontWeight:600 }}>
                    STUDENT SCHEDULE
                  </p>
                  <h2 style={{ color:'#fff', fontSize:'28px', fontWeight:800, margin:0, letterSpacing:'-0.02em' }}>
                    {selectedStudent.name}
                  </h2>
                  <p style={{ color:'rgba(255,255,255,0.65)', fontSize:'13px', marginTop:'5px' }}>
                    {selectedStudent.school} · {selectedStudent.grade}
                  </p>
                </div>

                {/* 좌석 뱃지 */}
                {(selectedStudent.seat_number || selectedSchedule.seat_number) && (
                  <div style={{
                    background:'rgba(255,255,255,0.15)', borderRadius:'14px',
                    padding:'12px 18px', textAlign:'center', backdropFilter:'blur(8px)',
                    border:'1px solid rgba(255,255,255,0.25)',
                  }}>
                    <p style={{ color:'rgba(255,255,255,0.65)', fontSize:'10px', fontWeight:600, letterSpacing:'0.06em' }}>좌석번호</p>
                    <p style={{ color:'#fff', fontSize:'26px', fontWeight:800, marginTop:'2px', lineHeight:1 }}>
                      {selectedStudent.seat_number ?? selectedSchedule.seat_number}
                    </p>
                  </div>
                )}
              </div>

              {/* 하단 배지 행 */}
              <div style={{ display:'flex', gap:'8px', marginTop:'16px', flexWrap:'wrap' }}>
                <span style={{
                  display:'inline-block', padding:'4px 14px', borderRadius:'999px',
                  background:'rgba(255,255,255,0.18)', color:'#fff',
                  fontSize:'12px', fontWeight:600,
                }}>
                  {selectedSchedule.membership_type || '–'} 멤버십
                </span>
                {selectedStudent.parent_phone && (
                  <span style={{
                    display:'inline-block', padding:'4px 14px', borderRadius:'999px',
                    background:'rgba(255,255,255,0.18)', color:'#fff',
                    fontSize:'12px', fontWeight:600,
                  }}>
                    📞 {selectedStudent.parent_phone}
                  </span>
                )}
                <span style={{
                  display:'inline-block', padding:'4px 14px', borderRadius:'999px',
                  background:'rgba(255,255,255,0.18)', color:'#fff',
                  fontSize:'12px', fontWeight:600,
                }}>
                  주 {totalPeriods}교시
                </span>
              </div>
            </div>

            {/* 주간 스케줄 본문 */}
            <div style={{ padding:'24px 28px' }}>
              <p style={{ fontSize:'11px', fontWeight:700, color:'#94A3B8', letterSpacing:'0.08em', marginBottom:'16px' }}>
                📅 주간 등원 스케줄
              </p>

              {activeDays.length === 0 ? (
                <p style={{ color:'#94A3B8', fontSize:'14px' }}>등록된 스케줄이 없습니다.</p>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                  {activeDays.map(day => {
                    const slots = (selectedSchedule[day.key] || []).slice().sort((a,b) => a-b)
                    const ds = dayStyle(day.type, day.short)
                    return (
                      <div key={day.key} style={{
                        display:'flex', alignItems:'center', gap:'14px',
                        padding:'12px 16px', borderRadius:'12px',
                        border:'1px solid #F1F5F9', background:'#FAFBFF',
                      }}>
                        {/* 요일 뱃지 */}
                        <div style={{
                          width:'40px', height:'40px', borderRadius:'12px',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          background:ds.bg, color:ds.color,
                          fontWeight:800, fontSize:'14px', flexShrink:0,
                        }}>{day.short}</div>

                        {/* 교시 뱃지들 */}
                        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', flex:1 }}>
                          {slots.map(slot => (
                            <span key={slot} style={{
                              padding:'4px 12px', borderRadius:'8px',
                              background:'#EEF2FF', color:'#4F46E5',
                              border:'1px solid #C7D2FE',
                              fontSize:'12px', fontWeight:700,
                            }}>
                              {slot}교시
                            </span>
                          ))}
                        </div>

                        {/* 교시 수 */}
                        <span style={{ fontSize:'11px', color:'#94A3B8', flexShrink:0, fontWeight:600 }}>
                          {slots.length}교시
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* 총 교시 합계 */}
              <div style={{
                display:'flex', justifyContent:'space-between', alignItems:'center',
                marginTop:'20px', paddingTop:'16px',
                borderTop:'1px solid #F1F5F9',
              }}>
                <span style={{ fontSize:'13px', color:'#94A3B8' }}>주당 총 등원 교시</span>
                <span style={{ fontSize:'20px', fontWeight:800, color:'#6366F1' }}>{totalPeriods}교시</span>
              </div>
            </div>

            {/* 하단 액션 버튼 */}
            <div style={{
              display:'flex', justifyContent:'flex-end', gap:'10px',
              padding:'16px 28px', borderTop:'1px solid #F1F5F9', background:'#FAFBFF',
            }}>
              <button
                onClick={handleCopyText}
                style={{
                  display:'flex', alignItems:'center', gap:'7px',
                  padding:'10px 18px', borderRadius:'12px',
                  border:`1.5px solid ${copied ? '#A7F3D0' : '#E2E8F0'}`,
                  background: copied ? '#ECFDF5' : '#fff',
                  color: copied ? '#059669' : '#475569',
                  fontSize:'13px', fontWeight:600, cursor:'pointer', transition:'all 0.15s',
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
                  display:'flex', alignItems:'center', gap:'7px',
                  padding:'10px 20px', borderRadius:'12px', border:'none',
                  background: sending
                    ? 'linear-gradient(135deg,#A5B4FC,#C4B5FD)'
                    : 'linear-gradient(135deg,#6366F1,#7C3AED)',
                  color:'#fff', fontSize:'13px', fontWeight:700,
                  cursor: sending ? 'not-allowed' : 'pointer',
                  boxShadow:'0 4px 12px rgba(99,102,241,0.3)',
                  transition:'all 0.2s',
                }}
              >
                {sending
                  ? <><Loader size={15} /> 발송 중...</>
                  : <><MessageSquare size={15} /> 알림톡 발송</>
                }
              </button>
            </div>
          </div>

        ) : selectedId && !selectedSchedule ? (
          <div style={{
            textAlign:'center', padding:'64px 0',
            background:'#fff', borderRadius:'16px', border:'1px solid #E2E8F0',
          }}>
            <p style={{ fontSize:'40px', marginBottom:'12px' }}>📋</p>
            <p style={{ fontWeight:600, color:'#374151' }}>{selectedStudent?.name} 학생의 스케줄이 아직 없어요</p>
            <p style={{ fontSize:'13px', color:'#94A3B8', marginTop:'4px' }}>스케줄 설정 페이지에서 먼저 스케줄을 등록해주세요</p>
          </div>
        ) : !selectedId ? (
          <div style={{
            textAlign:'center', padding:'64px 0',
            background:'#fff', borderRadius:'16px', border:'1px solid #E2E8F0',
          }}>
            <p style={{ fontSize:'40px', marginBottom:'12px' }}>👆</p>
            <p style={{ color:'#64748B', fontWeight:600 }}>위에서 학생을 선택하면 스케줄이 표시돼요</p>
          </div>
        ) : null}
      </div>
    </Layout>
  )
}
