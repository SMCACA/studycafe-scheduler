import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import logoSrc from '../assets/smc_logo.png'
import { getTodayQuote } from '../lib/encouragementQuotes'
import {
  LayoutDashboard, Users, CalendarDays, MessageSquare,
  LogOut, ChevronDown, ChevronRight, ClipboardList, Eye, BookOpen, Star,
  UserCheck, Award,
  Sparkles,
  BarChart3,
  Archive,
  BookMarked,
  CalendarCheck,
  Pencil,
  Check,
  X as XIcon,
} from 'lucide-react'

const SIDEBAR_W = 400
const TOPBAR_H  = 58

const menuItems = [
  { label: '대시보드',  path: '/dashboard',  icon: LayoutDashboard },
  { label: '학생 관리', path: '/students',   icon: Users },
  { label: '상벌점 관리', path: '/points',   icon: Award },
  {
    label: '스케줄 관리', path: '/schedules', icon: CalendarDays,
    children: [
      { label: '스케줄 설정', path: '/schedules',            icon: BookOpen },
      { label: '등원 기록',   path: '/schedules/attendance', icon: ClipboardList },
    ],
  },
  {
    label: '알림톡', path: '/notifications', icon: MessageSquare,
    children: [
      { label: '스케줄 알림톡', path: '/notifications/schedule', icon: Eye        },
      { label: '상벌점 알림톡', path: '/notifications/rewards',  icon: Star       },
      { label: '발송 결과 확인', path: '/notifications/logs',    icon: BarChart3  },
      { label: '문구 저장',     path: '/notifications/messages', icon: BookMarked },
    ],
  },
  { label: '학사 캘린더', path: '/calendar', icon: CalendarCheck },
  { label: '직원 근무표', path: '/staff', icon: UserCheck },
  { label: '매뉴얼 저장함', path: '/manuals', icon: Archive },
]

function getPageTitle(p) {
  const map = {
    '/dashboard':              '대시보드',
    '/students':               '학생 관리',
    '/points':                 '상벌점 관리',
    '/schedules':              '스케줄 설정',
    '/schedules/attendance':   '등원 기록',
    '/notifications/schedule': '스케줄 알림톡',
    '/notifications/rewards':  '상벌점 알림톡',
    '/notifications/logs':     '발송 결과 확인',
    '/notifications/messages': '문구 저장',
    '/calendar':               '학사 캘린더',
    '/staff':                  '직원 근무표',
    '/manuals':                '매뉴얼 저장함',
  }
  return map[p] || ''
}

const S = {
  active:   { color: '#fff',    background: 'rgba(99,102,241,0.20)' },
  inactive: { color: '#94A3B8', background: 'transparent' },
  hover:    { color: '#E2E8F0', background: 'rgba(255,255,255,0.07)' },
}

function NavLink({ to, isActive, children, style = {}, ...rest }) {
  return (
    <Link
      to={to}
      style={{ ...(isActive ? S.active : S.inactive), ...style }}
      onMouseEnter={e => { if (!isActive) Object.assign(e.currentTarget.style, S.hover) }}
      onMouseLeave={e => { if (!isActive) Object.assign(e.currentTarget.style, S.inactive) }}
      {...rest}
    >
      {children}
    </Link>
  )
}

export default function Layout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()

  // ── 지점명 (localStorage에 저장, 온스케줄은 앱 이름으로 고정) ──
  const [branchName, setBranchName] = useState(
    () => localStorage.getItem('onschedule_branch_name') || 'SMC 스터디카페'
  )
  const [isEditingBranch, setIsEditingBranch] = useState(false)
  const [tempBranch, setTempBranch] = useState('')
  const branchInputRef = useRef(null)

  useEffect(() => {
    if (isEditingBranch && branchInputRef.current) {
      branchInputRef.current.focus()
      branchInputRef.current.select()
    }
  }, [isEditingBranch])

  const startEditBranch = () => {
    setTempBranch(branchName)
    setIsEditingBranch(true)
  }
  const saveBranch = () => {
    const name = tempBranch.trim() || branchName
    setBranchName(name)
    localStorage.setItem('onschedule_branch_name', name)
    setIsEditingBranch(false)
  }
  const cancelEditBranch = () => {
    setIsEditingBranch(false)
  }


  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', width:'100vw', overflow:'hidden' }}>

      <header style={{
        display:'flex', alignItems:'center', height:`${TOPBAR_H}px`,
        flexShrink:0, background:'#0F172A',
        borderBottom:'1px solid rgba(255,255,255,0.07)',
      }}>
        <div style={{
          width:`${SIDEBAR_W}px`, flexShrink:0,
          display:'flex', alignItems:'center', gap:'12px',
          padding:'0 20px', height:'100%',
          borderRight:'1px solid rgba(255,255,255,0.07)',
        }}>
          <img src={logoSrc} alt="로고" style={{
            width:'38px', height:'auto', mixBlendMode:'screen',
            filter:'drop-shadow(0 0 10px rgba(184,138,60,0.4))', flexShrink:0,
          }} />
          <div>
            {/* 온스케줄 - 앱 고정명 */}
            <p style={{ color:'#818CF8', fontWeight:800, fontSize:'15px', letterSpacing:'-0.02em', lineHeight:1.2 }}>
              온스케줄
            </p>
            {/* 지점명 */}
            <p style={{ color:'#475569', fontSize:'11px', marginTop:'2px' }}>{branchName}</p>
          </div>
        </div>

        <div style={{ flex:1, padding:'0 24px', display:'flex', alignItems:'center', gap:'6px', overflow:'hidden' }}>
          <span style={{ color:'#475569', fontSize:'12px', flexShrink:0 }}>{branchName}</span>
          <span style={{ color:'#1E293B', fontSize:'12px', flexShrink:0 }}>&rsaquo;</span>
          <span style={{ color:'#94A3B8', fontSize:'13px', fontWeight:500, flexShrink:0 }}>
            {getPageTitle(location.pathname)}
          </span>

          <span style={{ color:'#1E293B', fontSize:'12px', flexShrink:0, marginLeft:'4px' }}>&middot;</span>
          <span style={{
            display:'flex', alignItems:'center', gap:'6px',
            fontSize:'13px', fontWeight:500, color:'#A5B4FC',
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
          }}>
            <Sparkles size={13} style={{ color:'#818CF8', flexShrink:0 }} />
            {getTodayQuote()}
          </span>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'0 20px', flexShrink:0 }}>
          <div style={{ textAlign:'right' }}>
            <p style={{ color:'#E2E8F0', fontSize:'13px', fontWeight:600 }}>원장님</p>
            <p style={{ color:'#475569', fontSize:'10px' }}>관리자</p>
          </div>
          <div style={{
            width:'34px', height:'34px', borderRadius:'50%',
            background:'linear-gradient(135deg,#6366F1,#8B5CF6)',
            display:'flex', alignItems:'center', justifyContent:'center',
            color:'#fff', fontSize:'12px', fontWeight:700, flexShrink:0,
          }}>관</div>
        </div>
      </header>

      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>

        <aside style={{
          width:`${SIDEBAR_W}px`, flexShrink:0, background:'#0F172A',
          display:'flex', flexDirection:'column', overflow:'hidden',
          borderRight:'1px solid rgba(255,255,255,0.05)',
        }}>

          <div style={{
            display:'flex', flexDirection:'column', alignItems:'center',
            padding:'28px 20px 22px', borderBottom:'1px solid rgba(255,255,255,0.07)',
            flexShrink:0,
          }}>
            <img src={logoSrc} alt="로고" style={{
              width:'96px', height:'auto', mixBlendMode:'screen',
              filter:'drop-shadow(0 0 18px rgba(184,138,60,0.35))', display:'block',
            }} />
            {/* 앱 이름 - 온스케줄 고정 */}
            <p style={{
              color:'#818CF8', fontWeight:800, fontSize:'20px',
              marginTop:'14px', letterSpacing:'-0.02em', textAlign:'center',
              textShadow:'0 0 20px rgba(129,140,248,0.4)',
            }}>온스케줄</p>

            {/* 지점명 - 클릭하면 수정 가능 */}
            {isEditingBranch ? (
              <div style={{ display:'flex', alignItems:'center', gap:'4px', marginTop:'5px' }}>
                <input
                  ref={branchInputRef}
                  value={tempBranch}
                  onChange={e => setTempBranch(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveBranch()
                    if (e.key === 'Escape') cancelEditBranch()
                  }}
                  style={{
                    fontSize:'12px', fontWeight:600, color:'#E2E8F0',
                    background:'rgba(255,255,255,0.08)', border:'1px solid rgba(129,140,248,0.5)',
                    borderRadius:'6px', padding:'3px 8px', outline:'none', width:'130px',
                    textAlign:'center',
                  }}
                />
                <button
                  onClick={saveBranch}
                  style={{ background:'none', border:'none', cursor:'pointer', padding:'2px', color:'#818CF8' }}
                  title="저장"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={cancelEditBranch}
                  style={{ background:'none', border:'none', cursor:'pointer', padding:'2px', color:'#475569' }}
                  title="취소"
                >
                  <XIcon size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={startEditBranch}
                title="지점명 수정"
                style={{
                  display:'inline-flex', alignItems:'center', gap:'5px',
                  marginTop:'5px', background:'none', border:'none', cursor:'pointer',
                  padding:'3px 8px', borderRadius:'6px',
                  transition:'background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
              >
                <span style={{ fontSize:'12px', fontWeight:600, color:'#94A3B8' }}>{branchName}</span>
                <Pencil size={11} style={{ color:'#475569' }} />
              </button>
            )}

            <span style={{
              display:'inline-block', marginTop:'8px', padding:'3px 14px',
              borderRadius:'999px', fontSize:'11px', fontWeight:600,
              background:'rgba(99,102,241,0.2)', color:'#818CF8', letterSpacing:'0.04em',
            }}>관리자 시스템</span>
          </div>

          <nav style={{ flex:1, padding:'16px 12px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'2px' }}>
            <p style={{ color:'#334155', fontSize:'10px', fontWeight:700, letterSpacing:'0.1em',
              padding:'0 12px', marginBottom:'6px', marginTop:'2px' }}>NAVIGATION</p>

            {menuItems.map(item => {
              const isParent = location.pathname.startsWith(item.path)
              const isActive = location.pathname === item.path

              if (item.children) {
                const Icon = item.icon
                return (
                  <div key={item.path}>
                    <NavLink
                      to={item.children[0].path}
                      isActive={isParent}
                      style={{
                        position:'relative', display:'flex', alignItems:'center',
                        gap:'12px', padding:'11px 14px', borderRadius:'12px',
                        fontSize:'14px', fontWeight:500, textDecoration:'none',
                        transition:'all 0.15s',
                      }}
                    >
                      {isParent && <span style={{
                        position:'absolute', left:0, top:'50%', transform:'translateY(-50%)',
                        width:'3px', height:'24px', background:'#818CF8', borderRadius:'0 4px 4px 0',
                      }} />}
                      <Icon size={18} strokeWidth={isParent ? 2.2 : 1.8} />
                      <span style={{ flex:1 }}>{item.label}</span>
                      {isParent
                        ? <ChevronDown  size={14} style={{ color:'#64748B' }} />
                        : <ChevronRight size={14} style={{ color:'#64748B' }} />}
                    </NavLink>

                    {isParent && (
                      <div style={{
                        marginLeft:'20px', marginTop:'2px', marginBottom:'4px',
                        paddingLeft:'14px', borderLeft:'1px solid rgba(255,255,255,0.08)',
                        display:'flex', flexDirection:'column', gap:'1px',
                      }}>
                        {item.children.map(child => {
                          const C = child.icon
                          const isCActive = location.pathname === child.path
                          return (
                            <NavLink
                              key={child.path} to={child.path} isActive={isCActive}
                              style={{
                                display:'flex', alignItems:'center', gap:'9px',
                                padding:'9px 12px', borderRadius:'10px',
                                fontSize:'13px', fontWeight: isCActive ? 600 : 400,
                                textDecoration:'none', transition:'all 0.15s',
                                color: isCActive ? '#A5B4FC' : '#64748B',
                                background: isCActive ? 'rgba(99,102,241,0.12)' : 'transparent',
                              }}
                            >
                              <C size={14} />
                              {child.label}
                            </NavLink>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              }

              return (
                <NavLink
                  key={item.path} to={item.path} isActive={isActive}
                  style={{
                    position:'relative', display:'flex', alignItems:'center',
                    gap:'12px', padding:'11px 14px', borderRadius:'12px',
                    fontSize:'14px', fontWeight:500, textDecoration:'none',
                    transition:'all 0.15s',
                  }}
                >
                  {isActive && <span style={{
                    position:'absolute', left:0, top:'50%', transform:'translateY(-50%)',
                    width:'3px', height:'24px', background:'#818CF8', borderRadius:'0 4px 4px 0',
                  }} />}
                  <item.icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </nav>

          <div style={{ padding:'12px', flexShrink:0, borderTop:'1px solid rgba(255,255,255,0.07)' }}>
            <button
              onClick={async () => { await supabase.auth.signOut(); navigate('/login') }}
              style={{
                width:'100%', display:'flex', alignItems:'center', gap:'12px',
                padding:'11px 14px', borderRadius:'12px', fontSize:'14px',
                color:'#475569', background:'transparent', border:'none', cursor:'pointer',
                transition:'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color='#FCA5A5'; e.currentTarget.style.background='rgba(239,68,68,0.1)' }}
              onMouseLeave={e => { e.currentTarget.style.color='#475569'; e.currentTarget.style.background='transparent' }}
            >
              <LogOut size={18} strokeWidth={1.8} />
              <span>로그아웃</span>
            </button>
          </div>
        </aside>

        <main style={{ flex:1, overflow:'auto', background:'#F8FAFC' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
