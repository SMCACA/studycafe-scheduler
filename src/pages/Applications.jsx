// ================================================================
// 📁 src/pages/Applications.jsx  (4단계 - 관리자용 신청자 명단)
// ================================================================
// 비유: 접수 창구에 쌓인 "신청서 바구니"를 관리자가 한 장씩 넘겨보는 화면이에요.
//   - 위쪽 탭: 상태별로 바구니를 나눠 보기 (대기중 / 연락완료 / 등록완료 / 취소)
//   - 검색창: 이름·학교·연락처로 찾기
//   - 행마다 상태 드롭다운: 바꾸면 바로 서버에 저장돼요
//
// 데이터는 /api/submit-application 으로 GET(조회) / PATCH(상태 변경) 요청을 보내서 받아요.
// 이때 "로그인 출입증(토큰)"을 같이 보내야 서버가 관리자라고 믿어줘요.
// ================================================================

import { useState, useEffect, useCallback, useMemo } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabaseClient'
import {
  UserPlus, RefreshCw, Search, CheckCircle2, XCircle, Copy, Link2,
} from 'lucide-react'

const cell = { border: '1px solid #E2E8F0', padding: '11px 14px', verticalAlign: 'middle' }

// 상태별 색상 (배지·드롭다운 공통)
const STATUS_INFO = {
  '대기중':   { bg: '#FFFBEB', color: '#D97706', border: '#FDE68A' },
  '연락완료': { bg: '#EEF2FF', color: '#6366F1', border: '#C7D2FE' },
  '등록완료': { bg: '#ECFDF5', color: '#059669', border: '#A7F3D0' },
  '취소':     { bg: '#F1F5F9', color: '#64748B', border: '#CBD5E1' },
}
const STATUS_LIST = Object.keys(STATUS_INFO)

function formatDateTime(iso) {
  if (!iso) return '–'
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatDate(str) {
  if (!str) return '–'
  return str.replaceAll('-', '.')
}

// 로그인 출입증(토큰)을 꺼내서 요청 머리말(헤더)에 붙여주는 도우미 함수
async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token || ''}`,
  }
}

export default function Applications() {
  const [applicants, setApplicants] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [filter,     setFilter]     = useState('전체')
  const [keyword,    setKeyword]    = useState('')
  const [savingId,   setSavingId]   = useState(null)
  const [toast,      setToast]      = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  // ── 명단 불러오기 ──
  const loadApplicants = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/submit-application', { headers: await authHeaders() })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || `서버 응답 ${res.status}`)
      setApplicants(json.applicants || [])
    } catch (err) {
      showToast('명단을 불러오지 못했어요: ' + err.message, 'error')
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadApplicants() }, [loadApplicants])

  // ── 상태 변경 ──
  const handleStatusChange = async (applicant, newStatus) => {
    if (applicant.status === newStatus) return
    setSavingId(applicant.id)
    try {
      const res = await fetch('/api/submit-application', {
        method: 'PATCH',
        headers: await authHeaders(),
        body: JSON.stringify({ id: applicant.id, status: newStatus }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || `서버 응답 ${res.status}`)
      setApplicants(prev => prev.map(a => (a.id === applicant.id ? { ...a, status: newStatus } : a)))
      showToast(`${applicant.name} → '${newStatus}'(으)로 바꿨어요`)
    } catch (err) {
      showToast('상태 변경 실패: ' + err.message, 'error')
    }
    setSavingId(null)
  }

  // ── 신청서 링크 복사 (학부모에게 보낼 때) ──
  const copyApplyLink = async () => {
    const url = `${window.location.origin}/apply`
    try {
      await navigator.clipboard.writeText(url)
      showToast('신청서 링크를 복사했어요: ' + url)
    } catch {
      showToast('복사 실패 — 직접 입력해주세요: ' + url, 'error')
    }
  }

  // ── 상태별 개수 (탭에 숫자 표시용) ──
  const counts = useMemo(() => {
    const c = { 전체: applicants.length }
    STATUS_LIST.forEach(s => { c[s] = applicants.filter(a => (a.status || '대기중') === s).length })
    return c
  }, [applicants])

  // ── 탭 + 검색어로 걸러낸 목록 ──
  const visible = useMemo(() => {
    const k = keyword.trim().toLowerCase()
    return applicants.filter(a => {
      if (filter !== '전체' && (a.status || '대기중') !== filter) return false
      if (!k) return true
      return [a.name, a.school, a.parent_phone, a.student_phone]
        .some(v => (v || '').toLowerCase().includes(k))
    })
  }, [applicants, filter, keyword])

  return (
    <Layout>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      <div style={{ padding: '28px 32px' }}>

        {/* ── 페이지 헤더 ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '46px', height: '46px', borderRadius: '14px', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserPlus size={22} style={{ color: '#6366F1' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0F172A', margin: 0 }}>신청자 명단</h1>
              <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '3px' }}>
                /apply 신청서로 들어온 {applicants.length}건 · 대기중 {counts['대기중'] || 0}건
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={copyApplyLink} style={btnStyle}>
              <Link2 size={15} /> 신청서 링크 복사
            </button>
            <button onClick={loadApplicants} disabled={loading} style={btnStyle}>
              <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              새로고침
            </button>
          </div>
        </div>

        {/* ── 상태 탭 + 검색 ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {['전체', ...STATUS_LIST].map(s => {
              const active = filter === s
              return (
                <button key={s} onClick={() => setFilter(s)} style={{
                  padding: '8px 14px', borderRadius: '999px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                  border: `1.5px solid ${active ? '#6366F1' : '#E2E8F0'}`,
                  background: active ? '#6366F1' : '#fff',
                  color: active ? '#fff' : '#475569',
                }}>
                  {s} <span style={{ opacity: 0.75, marginLeft: '2px' }}>{counts[s] || 0}</span>
                </button>
              )
            })}
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="이름·학교·연락처 검색"
              style={{
                padding: '9px 14px 9px 34px', borderRadius: '12px', border: '1.5px solid #E2E8F0',
                fontSize: '13px', outline: 'none', width: '220px', color: '#0F172A',
              }}
            />
          </div>
        </div>

        {/* ── 명단 테이블 ── */}
        <div style={{
          background: '#fff', borderRadius: '16px',
          border: '1px solid #E2E8F0', overflowX: 'auto',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr>
                {['신청일시', '이름', '학년', 'SMC 재원', '학교', '학부모 연락처', '학생 연락처', '희망 시작일', '희망 일정', '상태'].map(h => (
                  <th key={h} style={{
                    ...cell, background: '#F8FAFC',
                    fontSize: '11px', fontWeight: 700, color: '#64748B',
                    letterSpacing: '0.04em', textAlign: 'left', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} style={{ ...cell, textAlign: 'center', padding: '64px 0', color: '#94A3B8' }}>불러오는 중...</td></tr>
              ) : visible.length === 0 ? (
                <tr><td colSpan={10} style={{ ...cell, textAlign: 'center', padding: '64px 0', color: '#94A3B8' }}>
                  {applicants.length === 0 ? '아직 들어온 신청서가 없어요' : '조건에 맞는 신청자가 없어요'}
                </td></tr>
              ) : (
                visible.map((a, idx) => {
                  const status = a.status || '대기중'
                  const info = STATUS_INFO[status] || STATUS_INFO['대기중']
                  return (
                    <tr key={a.id} style={{ background: idx % 2 === 0 ? '#fff' : '#FAFBFF', opacity: status === '취소' ? 0.6 : 1 }}>
                      <td style={{ ...cell, color: '#64748B', whiteSpace: 'nowrap', fontSize: '12px' }}>{formatDateTime(a.created_at)}</td>
                      <td style={{ ...cell, fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>{a.name}</td>
                      <td style={{ ...cell, whiteSpace: 'nowrap' }}>{a.grade || '–'}</td>
                      <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                        {a.is_academy_student
                          ? <span style={{ ...pill, background: '#ECFDF5', color: '#059669' }}>재원생</span>
                          : <span style={{ ...pill, background: '#F1F5F9', color: '#64748B' }}>외부</span>}
                      </td>
                      <td style={{ ...cell, whiteSpace: 'nowrap' }}>{a.school || '–'}</td>
                      <td style={cell}><Phone value={a.parent_phone} onCopied={showToast} /></td>
                      <td style={cell}><Phone value={a.student_phone} onCopied={showToast} /></td>
                      <td style={{ ...cell, whiteSpace: 'nowrap' }}>{formatDate(a.desired_start_date)}</td>
                      <td style={{ ...cell, minWidth: '180px', maxWidth: '280px', whiteSpace: 'pre-wrap', color: '#334155', lineHeight: 1.5 }}>
                        {a.desired_schedule_text || '–'}
                      </td>
                      <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                        <select
                          value={status}
                          disabled={savingId === a.id}
                          onChange={e => handleStatusChange(a, e.target.value)}
                          style={{
                            padding: '6px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: 700,
                            border: `1.5px solid ${info.border}`, background: info.bg, color: info.color,
                            cursor: 'pointer', outline: 'none',
                          }}
                        >
                          {STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </Layout>
  )
}

const btnStyle = {
  display: 'flex', alignItems: 'center', gap: '8px',
  padding: '10px 18px', borderRadius: '12px', border: '1.5px solid #E2E8F0',
  background: '#fff', color: '#475569', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
}

const pill = {
  display: 'inline-block', padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
}

// 연락처 + 복사 버튼
function Phone({ value, onCopied }) {
  if (!value) return <span style={{ color: '#CBD5E1' }}>–</span>
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      onCopied(`${value} 복사했어요`)
    } catch {
      onCopied('복사 실패', 'error')
    }
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'monospace', fontSize: '12px', color: '#334155', whiteSpace: 'nowrap' }}>
      {value}
      <button onClick={copy} title="복사" style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: '#94A3B8', display: 'flex' }}>
        <Copy size={13} />
      </button>
    </span>
  )
}

function Toast({ msg, type }) {
  const Icon = type === 'success' ? CheckCircle2 : XCircle
  return (
    <div style={{
      position: 'fixed', top: '20px', right: '20px', zIndex: 100,
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '12px 18px', borderRadius: '14px',
      background: type === 'success' ? '#10B981' : '#EF4444',
      color: '#fff', fontSize: '13px', fontWeight: 600,
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
    }}>
      <Icon size={15} /> {msg}
    </div>
  )
}
