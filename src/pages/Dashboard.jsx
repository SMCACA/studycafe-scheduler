import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { createClient } from '@supabase/supabase-js'
import {
  Users, CalendarDays, MessageSquare, BookOpen,
  Clock, TrendingUp, ArrowRight, UserPlus,
} from 'lucide-react'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// 요일 → schedules 컬럼 키 (0=일 … 6=토)
const DAY_SLOT_KEYS = [
  'sun_slots','mon_slots','tue_slots','wed_slots',
  'thu_slots','fri_slots','sat_slots',
]

// 오늘 날짜 한국어
function getTodayKr() {
  const d    = new Date()
  const days = ['일','월','화','수','목','금','토']
  return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 (${days[d.getDay()]})`
}

// 이번 주 월~일 범위 (YYYY-MM-DD)
function getWeekRange() {
  const now   = new Date()
  const day   = now.getDay()                      // 0=일 6=토
  const mon   = new Date(now)
  mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
  const sun   = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  const fmt   = d => d.toLocaleDateString('sv-SE')
  return { from: fmt(mon), to: fmt(sun) }
}

// 학년 정렬 순서
const GRADE_ORDER = ['고3','고2','고1','중3','중2','중1']

export default function Dashboard() {
  const [students,      setStudents]      = useState([])
  const [todayCount,    setTodayCount]    = useState(0)     // 오늘 등원 예정 학생 수
  const [weekMsgCount,  setWeekMsgCount]  = useState(0)     // 이번 주 알림톡 수
  const [todayNames,    setTodayNames]    = useState([])    // 오늘 등원 학생 이름 목록
  const [loading,       setLoading]       = useState(true)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    try {
      // ① 전체 학생 + 학년 분포
      const { data: stuData } = await supabase
        .from('students')
        .select('id, name, grade, seat_number, school')
        .order('name')

      const stuList = stuData || []
      setStudents(stuList)

      // ② 오늘 등원 예정 — schedules 에서 오늘 요일 슬롯 확인
      const todaySlotKey = DAY_SLOT_KEYS[new Date().getDay()]
      const { data: schData } = await supabase
        .from('schedules')
        .select(`student_id, ${todaySlotKey}, students(name, seat_number)`)

      const todaySchedules = (schData || []).filter(s => {
        const slots = s[todaySlotKey]
        return Array.isArray(slots) && slots.length > 0
      })
      setTodayCount(todaySchedules.length)
      setTodayNames(
        todaySchedules
          .map(s => s.students?.name || '')
          .filter(Boolean)
          .slice(0, 5)
      )

      // ③ 이번 주 알림톡 발송 수 (messages 테이블이 있으면 집계, 없으면 0)
      try {
        const { from, to } = getWeekRange()
        const { count } = await supabase
          .from('messages')
          .select('id', { count:'exact', head:true })
          .gte('created_at', from)
          .lte('created_at', to + 'T23:59:59')
        setWeekMsgCount(count || 0)
      } catch {
        setWeekMsgCount(0)
      }

    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  // 학년별 집계 (정렬 고정)
  const gradeMap = {}
  students.forEach(s => {
    if (s.grade) gradeMap[s.grade] = (gradeMap[s.grade] || 0) + 1
  })
  const gradeDist = GRADE_ORDER
    .filter(g => gradeMap[g])
    .map(g => ({ grade: g, count: gradeMap[g] }))

  const highCount = students.filter(s => s.grade?.startsWith('고')).length
  const midCount  = students.filter(s => s.grade?.startsWith('중')).length
  const maxCount  = gradeDist.length > 0 ? Math.max(...gradeDist.map(g => g.count)) : 1

  // ── 빠른 바로가기 설정 ─────────────────────────────────
  const quickLinks = [
    { label:'학생 등록',   desc:'새 학생을 추가해요',      to:'/students',             icon:UserPlus,      color:'#6366F1', bg:'#EEF2FF' },
    { label:'스케줄 설정', desc:'등원 시간표를 관리해요',   to:'/schedules',            icon:CalendarDays,  color:'#0EA5E9', bg:'#F0F9FF' },
    { label:'등원 기록',   desc:'오늘 출석을 확인해요',     to:'/schedules/attendance', icon:BookOpen,      color:'#10B981', bg:'#ECFDF5' },
    { label:'알림톡 발송', desc:'학부모께 문자를 보내요',   to:'/notifications',        icon:MessageSquare, color:'#F59E0B', bg:'#FFFBEB' },
  ]

  return (
    <Layout>
      <div style={{ padding:'28px 32px', maxWidth:'1100px' }}>

        {/* ── 인사 헤더 ── */}
        <div style={{ marginBottom:'28px' }}>
          <p style={{ fontSize:'13px', color:'#94A3B8', marginBottom:'6px' }}>{getTodayKr()}</p>
          <h1 style={{ fontSize:'26px', fontWeight:800, color:'#0F172A', margin:0, letterSpacing:'-0.02em' }}>
            안녕하세요, 원장님 👋
          </h1>
          <p style={{ fontSize:'14px', color:'#64748B', marginTop:'5px' }}>
            SMC 스터디카페 관리 현황을 확인해보세요.
          </p>
        </div>

        {/* ── 통계 카드 3개 ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'16px', marginBottom:'24px' }}>

          {/* 전체 학생 */}
          <StatCard
            icon={Users} iconBg="#EEF2FF" iconColor="#6366F1"
            loading={loading}
            value={students.length}
            label="전체 학생"
            sub={students.length > 0 ? `고등부 ${highCount}명 · 중등부 ${midCount}명` : '아직 등록된 학생이 없어요'}
          />

          {/* 이번 주 알림톡 */}
          <StatCard
            icon={TrendingUp} iconBg="#F0F9FF" iconColor="#0EA5E9"
            loading={loading}
            value={weekMsgCount}
            label="이번 주 알림톡"
            sub={weekMsgCount > 0 ? `이번 주 ${weekMsgCount}건 발송됐어요` : '발송된 메시지가 없어요'}
          />

          {/* 오늘 등원 예정 */}
          <StatCard
            icon={Clock} iconBg="#ECFDF5" iconColor="#10B981"
            loading={loading}
            value={todayCount}
            label="오늘 등원 예정"
            sub={
              todayCount > 0
                ? todayNames.join(', ') + (todayCount > 5 ? ` 외 ${todayCount-5}명` : '')
                : '오늘 등원 예정 학생이 없어요'
            }
          />
        </div>

        {/* ── 하단 2열: 빠른 바로가기 + 학년 분포 ── */}
        <div style={{ display:'grid', gridTemplateColumns:'3fr 2fr', gap:'16px' }}>

          {/* ── 빠른 바로가기 ── */}
          <div>
            <SectionLabel>빠른 바로가기</SectionLabel>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginTop:'12px' }}>
              {quickLinks.map(({ label, desc, to, icon:Icon, color, bg }) => (
                <Link key={to} to={to} style={{ textDecoration:'none' }}>
                  <div
                    style={{
                      display:'flex', alignItems:'center', gap:'14px',
                      padding:'16px', borderRadius:'14px',
                      background:'#fff', border:'1px solid #E2E8F0',
                      boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
                      transition:'all 0.15s', cursor:'pointer',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform   = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow   = '0 6px 20px rgba(0,0,0,0.08)'
                      e.currentTarget.style.borderColor = color + '66'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform   = 'translateY(0)'
                      e.currentTarget.style.boxShadow   = '0 1px 3px rgba(0,0,0,0.04)'
                      e.currentTarget.style.borderColor = '#E2E8F0'
                    }}
                  >
                    {/* 아이콘 */}
                    <div style={{
                      width:'40px', height:'40px', borderRadius:'12px',
                      background:bg, display:'flex', alignItems:'center',
                      justifyContent:'center', flexShrink:0,
                    }}>
                      <Icon size={18} style={{ color }} />
                    </div>
                    {/* 텍스트 */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:'14px', fontWeight:700, color:'#0F172A', margin:0 }}>{label}</p>
                      <p style={{ fontSize:'12px', color:'#94A3B8', marginTop:'2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{desc}</p>
                    </div>
                    <ArrowRight size={14} style={{ color:'#CBD5E1', flexShrink:0 }} />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* ── 학년 분포 ── */}
          <div>
            <SectionLabel>학년 분포</SectionLabel>
            <div style={{
              marginTop:'12px', padding:'20px',
              background:'#fff', borderRadius:'14px',
              border:'1px solid #E2E8F0', boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
              minHeight:'200px',
            }}>
              {loading ? (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'160px' }}>
                  <p style={{ color:'#94A3B8', fontSize:'13px' }}>불러오는 중…</p>
                </div>
              ) : students.length === 0 ? (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'160px', gap:'10px' }}>
                  <Users size={28} style={{ color:'#E2E8F0' }} />
                  <p style={{ color:'#94A3B8', fontSize:'13px', textAlign:'center' }}>
                    등록된 학생이 없어요
                  </p>
                  <Link to="/students" style={{
                    fontSize:'12px', fontWeight:700, padding:'5px 14px',
                    borderRadius:'8px', background:'#EEF2FF', color:'#6366F1', textDecoration:'none',
                  }}>
                    학생 등록하기
                  </Link>
                </div>
              ) : (
                <>
                  <p style={{ fontSize:'12px', fontWeight:700, color:'#64748B', marginBottom:'14px' }}>
                    총 {students.length}명 재원 중
                  </p>
                  <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                    {gradeDist.map(({ grade, count }) => {
                      const isHigh   = grade.startsWith('고')
                      const barColor = isHigh ? '#6366F1' : '#10B981'
                      const barBg    = isHigh ? '#EEF2FF' : '#ECFDF5'
                      const pct      = Math.round((count / maxCount) * 100)
                      return (
                        <div key={grade}>
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'5px' }}>
                            <span style={{
                              fontSize:'11px', fontWeight:700, padding:'2px 10px',
                              borderRadius:'999px', background:barBg, color:barColor,
                            }}>{grade}</span>
                            <span style={{ fontSize:'12px', fontWeight:700, color:'#0F172A' }}>{count}명</span>
                          </div>
                          <div style={{ height:'8px', borderRadius:'999px', background:'#F1F5F9', overflow:'hidden' }}>
                            <div style={{
                              height:'100%', borderRadius:'999px',
                              width:`${pct}%`, background:barColor,
                              transition:'width 0.6s ease',
                            }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── 오늘 등원 학생 목록 (todayCount > 0일 때) ── */}
        {!loading && todayCount > 0 && (
          <div style={{ marginTop:'16px' }}>
            <SectionLabel>오늘 등원 예정 학생</SectionLabel>
            <div style={{
              marginTop:'12px', padding:'16px 20px',
              background:'#fff', borderRadius:'14px',
              border:'1px solid #E2E8F0', boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                {todayNames.map(name => (
                  <span key={name} style={{
                    padding:'4px 14px', borderRadius:'999px',
                    background:'#ECFDF5', color:'#059669',
                    border:'1px solid #A7F3D0',
                    fontSize:'12px', fontWeight:700,
                  }}>{name}</span>
                ))}
                {todayCount > 5 && (
                  <span style={{
                    padding:'4px 14px', borderRadius:'999px',
                    background:'#F1F5F9', color:'#64748B',
                    fontSize:'12px', fontWeight:600,
                  }}>+{todayCount - 5}명 더</span>
                )}
                <Link to="/schedules/attendance" style={{
                  marginLeft:'auto', display:'flex', alignItems:'center', gap:'5px',
                  fontSize:'12px', fontWeight:700, color:'#6366F1', textDecoration:'none',
                }}>
                  전체 보기 <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  )
}

// ── 통계 카드 ──────────────────────────────────────────────
function StatCard({ icon:Icon, iconBg, iconColor, loading, value, label, sub }) {
  return (
    <div style={{
      padding:'20px', borderRadius:'16px',
      background:'#fff', border:'1px solid #E2E8F0',
      boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
    }}>
      {/* 아이콘 */}
      <div style={{
        width:'40px', height:'40px', borderRadius:'12px',
        background:iconBg, display:'flex', alignItems:'center',
        justifyContent:'center', marginBottom:'14px',
      }}>
        <Icon size={18} style={{ color:iconColor }} />
      </div>

      {/* 숫자 */}
      {loading ? (
        <div style={{ height:'36px', width:'60px', borderRadius:'8px', background:'#F1F5F9', marginBottom:'8px' }} />
      ) : (
        <p style={{ fontSize:'32px', fontWeight:800, color:'#0F172A', margin:'0 0 4px', lineHeight:1, letterSpacing:'-0.02em' }}>
          {value}
        </p>
      )}

      {/* 라벨 */}
      <p style={{ fontSize:'14px', fontWeight:700, color:'#0F172A', margin:'0 0 3px' }}>{label}</p>

      {/* 서브 */}
      {loading ? (
        <div style={{ height:'12px', width:'120px', borderRadius:'6px', background:'#F1F5F9', marginTop:'4px' }} />
      ) : (
        <p style={{ fontSize:'11px', color:'#94A3B8', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{sub}</p>
      )}
    </div>
  )
}

// ── 섹션 레이블 ───────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <h3 style={{ fontSize:'14px', fontWeight:700, color:'#0F172A', margin:0 }}>{children}</h3>
  )
}
