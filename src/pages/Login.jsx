import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { Eye, EyeOff, LogIn } from 'lucide-react'
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
    <div
      className="min-h-screen w-full flex"
      style={{ fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif" }}
    >
      {/* ── 좌측 브랜드 패널 ── */}
      <div
        className="hidden lg:flex lg:w-[420px] shrink-0 flex-col justify-between p-12"
        style={{ background: '#0F172A' }}
      >
        {/* 상단 로고 - 실제 SMC 로고 이미지
            mix-blend-mode: screen으로 검정 배경이 패널 색상에 녹아듦 */}
        <div className="flex flex-col items-start">
          <img
            src={logoSrc}
            alt="SMC 스터디카페"
            style={{
              width: '90px',
              height: 'auto',
              mixBlendMode: 'screen',
              filter: 'drop-shadow(0 0 16px rgba(184,138,60,0.35))',
            }}
          />
        </div>

        {/* 중앙 문구 */}
        <div>
          <h1
            className="text-3xl font-bold leading-tight mb-4"
            style={{ color: '#F8FAFC' }}
          >
            학생 관리의<br />
            <span style={{ color: '#818CF8' }}>모든 것</span>을<br />
            한 곳에서.
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: '#64748B' }}>
            스케줄 관리부터 알림톡 발송까지,<br />
            SMC 스터디카페 전용 관리 시스템입니다.
          </p>
        </div>

        {/* 하단 버전 정보 */}
        <p className="text-xs" style={{ color: '#334155' }}>
          SMC Admin v1.0 · © 2025 SMC 스터디카페
        </p>
      </div>

      {/* ── 우측 로그인 폼 ── */}
      <div
        className="flex-1 flex items-center justify-center p-8"
        style={{ background: '#F8FAFC' }}
      >
        <div className="w-full max-w-sm">

          {/* 모바일 로고 (lg 미만에서만 표시) */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div
              className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shrink-0"
              style={{ background: '#0F172A' }}
            >
              <img
                src={logoSrc}
                alt="SMC 로고"
                style={{ width: '100%', height: '100%', objectFit: 'cover', mixBlendMode: 'screen' }}
              />
            </div>
            <p className="font-bold text-sm" style={{ color: '#0F172A' }}>SMC 스터디카페</p>
          </div>

          {/* 로그인 카드 */}
          <div
            className="rounded-3xl p-8"
            style={{
              background: '#fff',
              border: '1px solid #E2E8F0',
              boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
            }}
          >
            <div className="mb-7">
              <h2 className="text-xl font-bold mb-1.5" style={{ color: '#0F172A' }}>
                관리자 로그인
              </h2>
              <p className="text-sm" style={{ color: '#94A3B8' }}>
                원장님 전용 계정으로 로그인해 주세요.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">

              {/* 이메일 */}
              <div>
                <label
                  className="block text-xs font-semibold mb-1.5"
                  style={{ color: '#374151' }}
                >
                  이메일
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  required
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{
                    border: '1.5px solid #E2E8F0',
                    background: '#F8FAFC',
                    color: '#0F172A',
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = '#6366F1'
                    e.target.style.background  = '#fff'
                    e.target.style.boxShadow   = '0 0 0 3px rgba(99,102,241,0.1)'
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = '#E2E8F0'
                    e.target.style.background  = '#F8FAFC'
                    e.target.style.boxShadow   = 'none'
                  }}
                />
              </div>

              {/* 비밀번호 */}
              <div>
                <label
                  className="block text-xs font-semibold mb-1.5"
                  style={{ color: '#374151' }}
                >
                  비밀번호
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="비밀번호를 입력해 주세요"
                    required
                    className="w-full px-4 py-3 pr-11 rounded-xl text-sm outline-none transition-all"
                    style={{
                      border: '1.5px solid #E2E8F0',
                      background: '#F8FAFC',
                      color: '#0F172A',
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = '#6366F1'
                      e.target.style.background  = '#fff'
                      e.target.style.boxShadow   = '0 0 0 3px rgba(99,102,241,0.1)'
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = '#E2E8F0'
                      e.target.style.background  = '#F8FAFC'
                      e.target.style.boxShadow   = 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                    style={{ color: '#94A3B8' }}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* 에러 메시지 */}
              {error && (
                <div
                  className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
                  style={{ background: '#FEF2F2', color: '#EF4444', border: '1px solid #FECACA' }}
                >
                  <span>⚠️</span>
                  {error}
                </div>
              )}

              {/* 로그인 버튼 */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-all mt-2"
                style={{
                  background: loading
                    ? '#A5B4FC'
                    : 'linear-gradient(135deg, #6366F1 0%, #7C3AED 100%)',
                  boxShadow: loading
                    ? 'none'
                    : '0 4px 14px rgba(99,102,241,0.35)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
                onMouseEnter={e => {
                  if (!loading) {
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(99,102,241,0.45)'
                    e.currentTarget.style.transform = 'translateY(-1px)'
                  }
                }}
                onMouseLeave={e => {
                  if (!loading) {
                    e.currentTarget.style.boxShadow = '0 4px 14px rgba(99,102,241,0.35)'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }
                }}
              >
                <LogIn size={16} />
                {loading ? '로그인 중…' : '로그인'}
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  )
}
