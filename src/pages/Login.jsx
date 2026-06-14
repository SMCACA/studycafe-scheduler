import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { Eye, EyeOff, LogIn, BookOpen } from 'lucide-react'
import logoSrc from '../assets/smc_logo.png'

export default function Login() {
  const navigate  = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
    } else {
      navigate('/dashboard')
    }
    setLoading(false)
  }

  return (
    <div style={{ display:'flex', height:'100vh', width:'100vw', fontFamily:"'Pretendard','Apple SD Gothic Neo',sans-serif" }}>

      {/* ── 좌측: 내부 사이드바와 동일한 다크 패널 ── */}
      <div style={{
        width:'320px', flexShrink:0, background:'#0F172A',
        display:'flex', flexDirection:'column',
        borderRight:'1px solid rgba(255,255,255,0.07)',
      }}>
        {/* 로고 영역 */}
        <div style={{
          display:'flex', flexDirection:'column', alignItems:'center',
          padding:'48px 24px 36px',
          borderBottom:'1px solid rgba(255,255,255,0.07)',
        }}>
          <img
            src={logoSrc}
            alt="SMC 스터디카페"
            style={{
              width:'96px', height:'auto',
              mixBlendMode:'screen',
              filter:'drop-shadow(0 0 18px rgba(184,138,60,0.4))',
            }}
          />
          <p style={{
            color:'#E2E8F0', fontWeight:700, fontSize:'17px',
            marginTop:'16px', letterSpacing:'-0.01em', textAlign:'center',
          }}>SMC 스터디카페</p>
          <span style={{
            display:'inline-block', marginTop:'6px', padding:'3px 14px',
            borderRadius:'999px', fontSize:'11px', fontWeight:600,
            background:'rgba(99,102,241,0.2)', color:'#818CF8',
            letterSpacing:'0.04em',
          }}>관리자 시스템</span>
        </div>

        {/* 소개 문구 */}
        <div style={{ flex:1, padding:'36px 24px', display:'flex', flexDirection:'column', gap:'20px' }}>
          {[
            { icon:'📅', title:'스케줄 관리', desc:'학생별 등원 시간표를 한눈에' },
            { icon:'📱', title:'알림톡 발송', desc:'학부모·학생에게 바로 전송' },
            { icon:'⭐', title:'상벌점 관리', desc:'출석·태도 기록을 알림으로' },
          ].map(({ icon, title, desc }) => (
            <div key={title} style={{ display:'flex', alignItems:'center', gap:'14px' }}>
              <div style={{
                width:'38px', height:'38px', borderRadius:'12px', flexShrink:0,
                background:'rgba(99,102,241,0.15)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:'17px',
              }}>{icon}</div>
              <div>
                <p style={{ color:'#E2E8F0', fontSize:'13px', fontWeight:600, margin:0 }}>{title}</p>
                <p style={{ color:'#475569', fontSize:'12px', margin:'2px 0 0' }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 하단 버전 */}
        <div style={{ padding:'16px 24px', borderTop:'1px solid rgba(255,255,255,0.07)' }}>
          <p style={{ fontSize:'11px', color:'#334155', margin:0 }}>
            SMC Admin v1.0 · © 2025 SMC 스터디카페
          </p>
        </div>
      </div>

      {/* ── 우측: 로그인 폼 ── */}
      <div style={{
        flex:1, background:'#F8FAFC',
        display:'flex', alignItems:'center', justifyContent:'center',
        padding:'32px',
      }}>
        <div style={{ width:'100%', maxWidth:'400px' }}>

          {/* 상단 안내 */}
          <div style={{ marginBottom:'28px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
              <div style={{
                width:'40px', height:'40px', borderRadius:'12px',
                background:'linear-gradient(135deg,#6366F1,#7C3AED)',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                <BookOpen size={18} style={{ color:'#fff' }} />
              </div>
              <span style={{ fontSize:'13px', fontWeight:700, color:'#6366F1', letterSpacing:'0.04em' }}>
                SMC ADMIN
              </span>
            </div>
            <h1 style={{ fontSize:'24px', fontWeight:800, color:'#0F172A', margin:'0 0 6px', letterSpacing:'-0.02em' }}>
              관리자 로그인
            </h1>
            <p style={{ fontSize:'14px', color:'#64748B', margin:0 }}>
              원장님 전용 계정으로 로그인해 주세요.
            </p>
          </div>

          {/* 로그인 카드 */}
          <div style={{
            background:'#fff', borderRadius:'20px',
            border:'1px solid #E2E8F0',
            boxShadow:'0 4px 24px rgba(0,0,0,0.06)',
            padding:'28px',
          }}>
            <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:'16px' }}>

              {/* 이메일 */}
              <div>
                <label style={{ display:'block', fontSize:'12px', fontWeight:700, color:'#374151', marginBottom:'6px' }}>
                  이메일
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  required
                  style={{
                    width:'100%', padding:'11px 14px', boxSizing:'border-box',
                    borderRadius:'12px', border:'1.5px solid #E2E8F0',
                    fontSize:'14px', outline:'none', background:'#F8FAFC', color:'#0F172A',
                    transition:'all 0.15s',
                  }}
                  onFocus={e => { e.target.style.borderColor='#6366F1'; e.target.style.background='#fff'; e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,0.1)' }}
                  onBlur={e => { e.target.style.borderColor='#E2E8F0'; e.target.style.background='#F8FAFC'; e.target.style.boxShadow='none' }}
                />
              </div>

              {/* 비밀번호 */}
              <div>
                <label style={{ display:'block', fontSize:'12px', fontWeight:700, color:'#374151', marginBottom:'6px' }}>
                  비밀번호
                </label>
                <div style={{ position:'relative' }}>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="비밀번호를 입력해 주세요"
                    required
                    style={{
                      width:'100%', padding:'11px 44px 11px 14px', boxSizing:'border-box',
                      borderRadius:'12px', border:'1.5px solid #E2E8F0',
                      fontSize:'14px', outline:'none', background:'#F8FAFC', color:'#0F172A',
                      transition:'all 0.15s',
                    }}
                    onFocus={e => { e.target.style.borderColor='#6366F1'; e.target.style.background='#fff'; e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,0.1)' }}
                    onBlur={e => { e.target.style.borderColor='#E2E8F0'; e.target.style.background='#F8FAFC'; e.target.style.boxShadow='none' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(p => !p)}
                    style={{
                      position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)',
                      background:'none', border:'none', cursor:'pointer', padding:'4px',
                      color:'#94A3B8', display:'flex', alignItems:'center',
                    }}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* 에러 */}
              {error && (
                <div style={{
                  display:'flex', alignItems:'center', gap:'8px',
                  padding:'11px 14px', borderRadius:'12px', fontSize:'13px',
                  background:'#FEF2F2', color:'#EF4444', border:'1px solid #FECACA',
                }}>
                  <span>⚠️</span> {error}
                </div>
              )}

              {/* 버튼 */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
                  padding:'13px', borderRadius:'12px', border:'none',
                  fontSize:'14px', fontWeight:700, color:'#fff', cursor: loading ? 'not-allowed' : 'pointer',
                  background: loading ? '#A5B4FC' : 'linear-gradient(135deg,#6366F1 0%,#7C3AED 100%)',
                  boxShadow: loading ? 'none' : '0 4px 16px rgba(99,102,241,0.35)',
                  transition:'all 0.2s',
                  marginTop:'4px',
                }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.boxShadow='0 6px 22px rgba(99,102,241,0.45)'; e.currentTarget.style.transform='translateY(-1px)' } }}
                onMouseLeave={e => { if (!loading) { e.currentTarget.style.boxShadow='0 4px 16px rgba(99,102,241,0.35)'; e.currentTarget.style.transform='translateY(0)' } }}
              >
                <LogIn size={16} />
                {loading ? '로그인 중…' : '로그인'}
              </button>
            </form>
          </div>

          {/* 안내 문구 */}
          <p style={{ textAlign:'center', fontSize:'12px', color:'#94A3B8', marginTop:'20px' }}>
            계정 문의는 시스템 관리자에게 연락해주세요
          </p>
        </div>
      </div>
    </div>
  )
}
