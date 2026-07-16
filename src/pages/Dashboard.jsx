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
const GRADE_ORDER = ['고3','고2','고1','중3','중2','중1','성인']

export default function Dashboard() {
  const [students,      setStudents]      = useState([])     // 재원생만 (학년 분포용)
  const [academyCounts, setAcademyCounts] = useState({ smc: 0, nonSmc: 0 }) // ✅ SMC 재원생/비재원생 인원
  const [todayCount,    setTodayCount]    = useState(0)     // 오늘 등원 예정 학생 수
  const [weekMsgCount,  setWeekMsgCount]  = useState(0)     // 이번 주 알림톡 수
  const [todayNames,    setTodayNames]    = useState([])    // 오늘 등원 학생 이름 목록
  const [loading,       setLoading]       = useState(true)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    try {
      // ① 재원생만 + 학년 분포
      const { data: stuData } = await supabase
        .from('students')
        .select('id, name, grade, seat_number, school, status, is_academy_student')
        .eq('status', '재원생')
        .order('name')

      const stuList = stuData || []
      setStudents(stuList)

      // ✅ ①-1. "스터디카페 재원생" 중에서 SMC 학원도 같이 다니는지(SMC 재원생) 비율 — 원형 그래프용
      //    비유: 재원 상태는 "이 카페에 다니는지"이고, 이건 "SMC 학원 수업도 같이 듣는지"라
      //         완전히 다른 구분이에요. 그래서 재원생 명단 안에서 다시 한번 나눠 세요.
      const smcCount = stuList.filter(s => s.is_academy_student).length
      setAcademyCounts({ smc: smcCount, nonSmc: stuList.length - smcCount })

      // ② 오늘 등원 예정 — schedules 에서 오늘 요일 슬롯 확인 (재원생만)
      const todaySlotKey = DAY_SLOT_KEYS[new Date().getDay()]
      const { data: schData } = await supabase
        .from('schedules')
        .select(`student_id, ${todaySlotKey}, students!inner(name, seat_number, status)`)
        .eq('students.status', '재원생')

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

  const highCount  = students.filter(s => s.grade?.startsWith('고')).length
  const midCount   = students.filter(s => s.grade?.startsWith('중')).length
  const adultCount = students.filter(s => s.grade === '성인').length
  const maxCount   = gradeDist.length > 0 ? Math.max(...gradeDist.map(g => g.count)) : 1

  // ✅ [교체] SMC 재원생/비재원생 원형 그래프용 데이터
  //    StudentManagement.jsx의 ACADEMY_STYLE과 색을 맞춰서, 다른 화면과 똑같은 색으로 보이게 했어요.
  const ACADEMY_PIE_COLORS = { 'SMC 재원생': '#D97706', '비재원생': '#64748B' }
  const totalAcademyCount = academyCounts.smc + academyCounts.nonSmc
  const academyPieData = [
    { label: 'SMC 재원생', count: academyCounts.smc,    color: ACADEMY_PIE_COLORS['SMC 재원생'] },
    { label: '비재원생',    count: academyCounts.nonSmc, color: ACADEMY_PIE_COLORS['비재원생'] },
  ]
    .map(d => ({ ...d, pct: totalAcademyCount > 0 ? (d.count / totalAcademyCount) * 100 : 0 }))
    .filter(d => d.count > 0)

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
            sub={students.length > 0
              ? `고등부 ${highCount}명 · 중등부 ${midCount}명${adultCount > 0 ? ` · 성인 ${adultCount}명` : ''}`
              : '아직 등록된 학생이 없어요'
            }
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
                    재원생 총 {students.length}명
                  </p>
                  <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                    {gradeDist.map(({ grade, count }) => {
                      const isHigh   = grade.startsWith('고')
                      const isAdult  = grade === '성인'
                      const barColor = isHigh ? '#6366F1' : isAdult ? '#F59E0B' : '#10B981'
                      const barBg    = isHigh ? '#EEF2FF' : isAdult ? '#FFF7ED' : '#ECFDF5'
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

        {/* ── SMC 재원생 현황 원형 그래프 (재원생 중 SMC 재원생/비재원생 비율 + 명수) ── */}
        <div style={{ marginTop:'16px' }}>
          <SectionLabel>SMC 재원생 현황</SectionLabel>
          <div style={{
            marginTop:'12px', padding:'20px',
            background:'#fff', borderRadius:'14px',
            border:'1px solid #E2E8F0', boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
            display:'flex', alignItems:'center', gap:'28px', flexWrap:'wrap',
          }}>
            {loading ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'160px', width:'100%' }}>
                <p style={{ color:'#94A3B8', fontSize:'13px' }}>불러오는 중…</p>
              </div>
            ) : totalAcademyCount === 0 ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'160px', width:'100%', gap:'10px' }}>
                <Users size={28} style={{ color:'#E2E8F0' }} />
                <p style={{ color:'#94A3B8', fontSize:'13px' }}>등록된 학생이 없어요</p>
              </div>
            ) : (
              <>
                <StatusDonutChart data={academyPieData} total={totalAcademyCount} />
                {/* 범례 (SMC 재원생 / 비재원생 명수 + 비율) */}
                <div style={{ display:'flex', flexDirection:'column', gap:'10px', minWidth:'160px' }}>
                  {[
                    { label: 'SMC 재원생', count: academyCounts.smc },
                    { label: '비재원생',    count: academyCounts.nonSmc },
                  ].map(({ label, count }) => {
                    const pct = totalAcademyCount > 0 ? Math.round((count / totalAcademyCount) * 100) : 0
                    return (
                      <div key={label} style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                        <span style={{ width:'10px', height:'10px', borderRadius:'999px', background:ACADEMY_PIE_COLORS[label], flexShrink:0 }} />
                        <span style={{ fontSize:'13px', fontWeight:600, color:'#374151', minWidth:'70px' }}>{label}</span>
                        <span style={{ fontSize:'13px', fontWeight:700, color:'#0F172A' }}>{count}명</span>
                        <span style={{ fontSize:'12px', color:'#94A3B8' }}>({pct}%)</span>
                      </div>
                    )
                  })}
                  <div style={{ marginTop:'4px', paddingTop:'10px', borderTop:'1px solid #F1F5F9', fontSize:'12px', color:'#64748B' }}>
                    재원생 중 <strong style={{ color:'#0F172A' }}>{totalAcademyCount}명</strong> 기준
                  </div>
                </div>
              </>
            )}
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

// ── 학생 현황 도넛(원형) 차트 ──────────────────────────────
// 비유: 피자 한 판(원 전체 = 100%)을 상태별 인원수만큼 조각내서 색칠하는 거예요.
//      SVG의 strokeDasharray(점선 길이 조절 기능)를 이용해서
//      "원의 둘레 중 몇 %만 색을 칠할지"를 계산해서 조각을 만들어요.
function StatusDonutChart({ data, total }) {
  const size   = 140
  const stroke = 22
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius

  let offsetAcc = 0 // 지금까지 칠한 비율(누적) — 다음 조각이 시작할 위치를 정해줘요

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink:0 }}>
      {/* 배경 원 (아무것도 안 칠해진 부분) */}
      <circle
        cx={size/2} cy={size/2} r={radius}
        fill="none" stroke="#F1F5F9" strokeWidth={stroke}
      />
      {data.map(({ label, color, pct }) => {
        const dash      = (pct / 100) * circumference
        const dashArray = `${dash} ${circumference - dash}`
        const dashOffset = circumference - (offsetAcc / 100) * circumference
        offsetAcc += pct
        return (
          <circle
            key={label}
            cx={size/2} cy={size/2} r={radius}
            fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={dashArray}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${size/2} ${size/2})`} // 12시 방향에서 시작하도록 회전
            strokeLinecap="butt"
          />
        )
      })}
      {/* 가운데 전체 인원수 텍스트 */}
      <text x="50%" y="48%" textAnchor="middle" fontSize="22" fontWeight="800" fill="#0F172A">
        {total}
      </text>
      <text x="50%" y="64%" textAnchor="middle" fontSize="11" fontWeight="600" fill="#94A3B8">
        재원생
      </text>
    </svg>
  )
}
