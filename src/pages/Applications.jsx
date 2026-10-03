// ================================================================
// 📁 src/pages/Applications.jsx  (관리자용 신청자 명단 + 학생 전환)
// ================================================================
// 비유: 접수 창구에 쌓인 "신청서 바구니"를 관리자가 한 장씩 넘겨보는 화면이에요.
//   - 위쪽 탭: 상태별로 나눠 보기 (대기중 / 연락완료 / 등록완료 / 취소)
//   - 행마다 [재원생 전환] [예비원생 전환] 버튼
//       → 확인 창에서 이용권·교시·좌석·첫등원일을 확인/수정하고 등록하면
//         ① 학생 관리(students)에 학생 추가  ② 스케줄 관리(schedules)에 시간표 추가
//         ③ 신청서는 '등록완료'로 잠김 (두 번 등록되는 것 방지)
//
// 데이터는 /api/submit-application 으로 요청해요. (로그인 출입증(토큰)을 같이 보냄)
// ================================================================

import { useState, useEffect, useCallback, useMemo } from 'react'
import Layout from '../components/Layout'
import SlotPicker from '../components/SlotPicker'
import { supabase } from '../lib/supabaseClient'
import { fetchSeatConfig } from '../lib/seatConfig'
import {
  MEMBERSHIP_OPTIONS, MEMBERSHIP_LABEL, DEFAULT_SLOT_CONFIG,
  emptySlots, cleanSlots, countSlots, summarizeSlots,
} from '../lib/applySchedule'
import {
  UserPlus, RefreshCw, Search, CheckCircle2, XCircle, Copy, Link2, X, AlertTriangle, UserCheck, Clock, Trash2, Smartphone, Plus, Send,
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
const MANUAL_STATUS = ['대기중', '연락완료', '취소']   // 드롭다운으로 바꿀 수 있는 상태

// 전환 종류별 색상 (학생 관리 화면과 동일)
const AS_STYLE = {
  재원생:   { bg: '#ECFDF5', color: '#059669', border: '#A7F3D0', solid: '#10B981' },
  예비원생: { bg: '#EEF2FF', color: '#6366F1', border: '#C7D2FE', solid: '#6366F1' },
}

function formatDateTime(iso) {
  if (!iso) return '–'
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatDate(str) {
  if (!str) return '–'
  return String(str).slice(0, 10).replaceAll('-', '.')
}

// 로그인 출입증(토큰)을 꺼내서 요청 머리말(헤더)에 붙여주는 도우미 함수
async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token || ''}`,
  }
}

// 서버에 요청 보내고 결과 받기 (실패하면 서버가 보낸 이유를 그대로 에러로)
async function callApi(method, body) {
  const res = await fetch('/api/submit-application', {
    method,
    headers: await authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(json.error || `서버 응답 ${res.status}`)
    err.status = res.status
    err.data = json
    throw err
  }
  return json
}

export default function Applications() {
  const [applicants, setApplicants] = useState([])
  const [slotConfig, setSlotConfig] = useState(DEFAULT_SLOT_CONFIG)
  const [timeConfig, setTimeConfig] = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [filter,     setFilter]     = useState('전체')
  const [keyword,    setKeyword]    = useState('')
  const [savingId,   setSavingId]   = useState(null)
  const [selected,   setSelected]   = useState(() => new Set())   // 체크한 신청서 id 목록
  const [deleting,   setDeleting]   = useState(false)
  const [toast,      setToast]      = useState(null)
  const [converting, setConverting] = useState(null)   // { applicant, as } — 전환 창 열림
  const [notifyPhones, setNotifyPhones] = useState([])  // 새 신청자 문자 받을 번호
  const [notifyReady,  setNotifyReady]  = useState(true) // 설정 테이블 준비 여부
  const [showNotify,   setShowNotify]   = useState(false)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ── 명단 불러오기 ──
  const loadApplicants = useCallback(async () => {
    setLoading(true)
    try {
      const json = await callApi('GET')
      setApplicants(json.applicants || [])
      if (json.slotConfig) setSlotConfig(json.slotConfig)
      if (json.timeConfig) setTimeConfig(json.timeConfig)
      setNotifyPhones(json.notifyPhones || [])
      setNotifyReady(json.notifyReady !== false)
    } catch (err) {
      showToast('명단을 불러오지 못했어요: ' + err.message, 'error')
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadApplicants() }, [loadApplicants])

  // ── 상태 변경 (대기중/연락완료/취소) ──
  const handleStatusChange = async (applicant, newStatus) => {
    if ((applicant.status || '대기중') === newStatus) return
    setSavingId(applicant.id)
    try {
      await callApi('PATCH', { id: applicant.id, status: newStatus })
      setApplicants(prev => prev.map(a => (a.id === applicant.id ? { ...a, status: newStatus } : a)))
      showToast(`${applicant.name} → '${newStatus}'(으)로 바꿨어요`)
    } catch (err) {
      showToast('상태 변경 실패: ' + err.message, 'error')
    }
    setSavingId(null)
  }

  // ── 전환 완료 후 ──
  const handleConverted = (updated, as) => {
    setApplicants(prev => prev.map(a => (a.id === updated.id ? updated : a)))
    setConverting(null)
    showToast(`${updated.name} 학생을 ${as}(으)로 등록하고 스케줄까지 연동했어요 🎉`)
  }

  // ── 삭제 (테스트·불필요한 신청서 정리용) ──
  // ⚠️ 신청서 기록만 지워요. 이미 학생으로 전환된 경우, 학생 관리·스케줄의 학생은 그대로 남아요.
  const handleDelete = async (ids) => {
    const targets = applicants.filter(a => ids.includes(a.id))
    if (targets.length === 0) return
    const names = targets.slice(0, 5).map(a => a.name).join(', ') + (targets.length > 5 ? ` 외 ${targets.length - 5}명` : '')
    const convertedCount = targets.filter(a => a.converted_student_id).length
    const msg =
      `신청서 ${targets.length}건을 삭제할까요?\n(${names})\n\n삭제하면 되돌릴 수 없어요.` +
      (convertedCount ? `\n\n※ 이 중 ${convertedCount}건은 이미 학생으로 등록됐어요. 신청서만 지워지고, 학생 관리·스케줄의 학생은 그대로 남아요.` : '')
    if (!window.confirm(msg)) return

    setDeleting(true)
    try {
      const json = await callApi('DELETE', { ids: targets.map(a => a.id) })
      const gone = new Set((json.deletedIds || []).map(String))
      setApplicants(prev => prev.filter(a => !gone.has(String(a.id))))
      setSelected(new Set())
      showToast(`신청서 ${gone.size}건을 삭제했어요 🗑️`)
    } catch (err) {
      showToast('삭제 실패: ' + err.message, 'error')
    }
    setDeleting(false)
  }

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
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

  const HEADERS = ['신청일시', '이름', '학년', 'SMC 재원', '학교', '학부모 연락처', '학생 연락처', '이용권', '희망 스케줄', '희망 시작일', '요청사항', '상태', '학생 전환', '삭제']

  return (
    <Layout>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {showNotify && (
        <NotifyPhonesModal
          initial={notifyPhones}
          ready={notifyReady}
          onClose={() => setShowNotify(false)}
          onSaved={phones => { setNotifyPhones(phones); setNotifyReady(true); showToast('알림 받을 번호를 저장했어요 📱') }}
          showToast={showToast}
        />
      )}

      {converting && (
        <ConvertModal
          applicant={converting.applicant}
          initialAs={converting.as}
          slotConfig={slotConfig}
          timeConfig={timeConfig}
          onClose={() => setConverting(null)}
          onDone={handleConverted}
        />
      )}

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
                /apply 신청서로 들어온 {applicants.length}건 · 대기중 {counts['대기중'] || 0}건 · [재원생/예비원생 전환]을 누르면 학생·스케줄에 자동 등록돼요
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {selected.size > 0 && (
              <button onClick={() => handleDelete([...selected])} disabled={deleting} style={{
                ...btnStyle, border: '1.5px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626',
              }}>
                <Trash2 size={15} /> {deleting ? '삭제 중…' : `선택 삭제 (${selected.size})`}
              </button>
            )}
            <button onClick={() => setShowNotify(true)} style={{
              ...btnStyle,
              ...(notifyPhones.length === 0 ? { border: '1.5px solid #FDE68A', background: '#FFFBEB', color: '#B45309' } : {}),
            }}>
              <Smartphone size={15} /> 알림 받을 번호 {notifyPhones.length > 0 ? `(${notifyPhones.length})` : '설정'}
            </button>
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
                <button key={s} onClick={() => { setFilter(s); setSelected(new Set()) }} style={{
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
              onChange={e => { setKeyword(e.target.value); setSelected(new Set()) }}
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
                <th style={{ ...cell, background: '#F8FAFC', width: '36px', textAlign: 'center' }}>
                  <input type="checkbox" title="보이는 신청서 전체 선택"
                    checked={visible.length > 0 && visible.every(a => selected.has(a.id))}
                    onChange={e => setSelected(e.target.checked ? new Set(visible.map(a => a.id)) : new Set())}
                    style={{ cursor: 'pointer', width: '15px', height: '15px' }} />
                </th>
                {HEADERS.map(h => (
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
                <tr><td colSpan={HEADERS.length + 1} style={{ ...cell, textAlign: 'center', padding: '64px 0', color: '#94A3B8' }}>불러오는 중...</td></tr>
              ) : visible.length === 0 ? (
                <tr><td colSpan={HEADERS.length + 1} style={{ ...cell, textAlign: 'center', padding: '64px 0', color: '#94A3B8' }}>
                  {applicants.length === 0 ? '아직 들어온 신청서가 없어요' : '조건에 맞는 신청자가 없어요'}
                </td></tr>
              ) : (
                visible.map((a, idx) => {
                  const status = a.status || '대기중'
                  const info = STATUS_INFO[status] || STATUS_INFO['대기중']
                  const converted = !!a.converted_student_id
                  const summary = summarizeSlots(a.desired_slots)
                  return (
                    <tr key={a.id} style={{ background: selected.has(a.id) ? '#FEF2F2' : idx % 2 === 0 ? '#fff' : '#FAFBFF', opacity: status === '취소' ? 0.6 : 1 }}>
                      <td style={{ ...cell, textAlign: 'center' }}>
                        <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggleSelect(a.id)}
                          style={{ cursor: 'pointer', width: '15px', height: '15px' }} />
                      </td>
                      <td style={{ ...cell, color: '#64748B', whiteSpace: 'nowrap', fontSize: '12px' }}>{formatDateTime(a.created_at)}</td>
                      <td style={{ ...cell, fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>{a.name}</td>
                      <td style={{ ...cell, whiteSpace: 'nowrap' }}>{a.grade || '–'}</td>
                      <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                        {a.is_academy_student
                          ? <span style={{ ...pill, background: '#FFFBEB', color: '#D97706' }}>SMC 재원생</span>
                          : <span style={{ ...pill, background: '#F1F5F9', color: '#64748B' }}>비재원생</span>}
                      </td>
                      <td style={{ ...cell, whiteSpace: 'nowrap' }}>{a.school || '–'}</td>
                      <td style={cell}><Phone value={a.parent_phone} onCopied={showToast} /></td>
                      <td style={cell}><Phone value={a.student_phone} onCopied={showToast} /></td>
                      <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                        {a.membership_type
                          ? <span style={{ ...pill, background: '#EEF2FF', color: '#4F46E5' }}>{MEMBERSHIP_LABEL[a.membership_type] || a.membership_type}</span>
                          : <span style={{ color: '#CBD5E1' }}>–</span>}
                      </td>
                      <td style={{ ...cell, minWidth: '150px' }}>
                        {summary.length === 0 ? <span style={{ color: '#CBD5E1' }}>–</span> : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            {summary.map(s => (
                              <span key={s.day} style={{ fontSize: '12px', color: '#334155', whiteSpace: 'nowrap' }}>
                                <strong style={{ color: s.color, marginRight: '5px' }}>{s.day}</strong>{s.text}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ ...cell, whiteSpace: 'nowrap' }}>{formatDate(a.desired_start_date)}</td>
                      <td style={{ ...cell, minWidth: '140px', maxWidth: '240px', whiteSpace: 'pre-wrap', color: '#334155', lineHeight: 1.5, fontSize: '12px' }}>
                        {a.desired_schedule_text || '–'}
                      </td>
                      <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                        {converted ? (
                          <span style={{ ...pill, background: info.bg, color: info.color, border: `1px solid ${info.border}` }}>등록완료</span>
                        ) : (
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
                            {!MANUAL_STATUS.includes(status) && <option value={status} disabled>{status}</option>}
                            {MANUAL_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        )}
                      </td>
                      <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                        {converted ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{
                              ...pill, display: 'inline-flex', alignItems: 'center', gap: '4px',
                              background: AS_STYLE[a.converted_as]?.bg || '#ECFDF5',
                              color: AS_STYLE[a.converted_as]?.color || '#059669',
                            }}>
                              <UserCheck size={11} /> {a.converted_as || '학생'} 등록됨
                            </span>
                            <span style={{ fontSize: '11px', color: '#94A3B8' }}>{formatDateTime(a.converted_at)}</span>
                          </div>
                        ) : status === '취소' ? (
                          <span style={{ fontSize: '12px', color: '#94A3B8' }}>취소된 신청</span>
                        ) : (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {['재원생', '예비원생'].map(as => (
                              <button key={as} onClick={() => setConverting({ applicant: a, as })} style={{
                                padding: '6px 10px', borderRadius: '9px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                                border: `1.5px solid ${AS_STYLE[as].border}`, background: AS_STYLE[as].bg, color: AS_STYLE[as].color,
                              }}>
                                {as} 전환
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ ...cell, textAlign: 'center' }}>
                        <button onClick={() => handleDelete([a.id])} disabled={deleting} title="이 신청서 삭제" style={{
                          border: 'none', background: 'transparent', cursor: 'pointer', color: '#CBD5E1', padding: '4px', display: 'inline-flex',
                        }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#EF4444' }}
                          onMouseLeave={e => { e.currentTarget.style.color = '#CBD5E1' }}>
                          <Trash2 size={15} />
                        </button>
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

// ================================================================
//  전환 확인 창
// ================================================================
// 비유: 입학 서류에 도장 찍기 전 마지막으로 "이대로 등록할까요?" 확인하는 창이에요.
//       신청자가 고른 이용권·교시가 미리 채워져 있고, 상담 결과에 맞게 고칠 수 있어요.
function ConvertModal({ applicant, initialAs, slotConfig, timeConfig, onClose, onDone }) {
  const startMembership = applicant.membership_type || ''
  const [as,          setAs]          = useState(initialAs)
  const [membership,  setMembership]  = useState(startMembership)
  const [slots,       setSlots]       = useState(() =>
    startMembership ? cleanSlots(applicant.desired_slots || emptySlots(), startMembership, slotConfig) : emptySlots())
  const [seat,        setSeat]        = useState('')
  const [firstDate,   setFirstDate]   = useState(applicant.desired_start_date ? String(applicant.desired_start_date).slice(0, 10) : '')
  const [freeSeats,   setFreeSeats]   = useState(null)   // null = 불러오는 중
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const [duplicates,  setDuplicates]  = useState(null)   // 같은 이름 학생 목록

  // 빈 좌석 목록 불러오기 (학생 관리 화면과 같은 규칙: 재원생·예비원생이 쓰는 좌석은 제외)
  useEffect(() => {
    (async () => {
      try {
        const [cfg, { data: sts, error: stErr }] = await Promise.all([
          fetchSeatConfig(),
          supabase.from('students').select('seat_number, status'),
        ])
        if (stErr) throw stErr
        const used = new Set(
          (sts || [])
            .filter(s => (s.status || '재원생') !== '퇴원생' && s.seat_number != null)
            .map(s => Number(s.seat_number))
        )
        const list = []
        for (let n = cfg.min_seat; n <= cfg.max_seat; n++) if (!used.has(n)) list.push(n)
        setFreeSeats(list)
      } catch {
        setFreeSeats([])
      }
    })()
  }, [])

  const changeMembership = (value) => {
    setMembership(value)
    setSlots(prev => cleanSlots(prev, value, slotConfig))
    setError('')
  }

  const total = membership ? countSlots(cleanSlots(slots, membership, slotConfig)) : 0
  const asStyle = AS_STYLE[as]

  const submit = async (force = false) => {
    setError('')
    if (!membership) { setError('이용권을 선택해주세요'); return }
    if (total === 0) { setError('스케줄(요일·교시)을 최소 1개 이상 선택해주세요'); return }

    setSaving(true)
    try {
      const json = await callApi('PATCH', {
        action: 'convert',
        id: applicant.id,
        as,
        membership_type: membership,
        slots: cleanSlots(slots, membership, slotConfig),
        seat_number: seat === '' ? null : Number(seat),
        first_attendance_date: firstDate || null,
        force,
      })
      onDone(json.applicant, as)
    } catch (err) {
      if (err.data?.code === 'DUPLICATE_NAME') {
        setDuplicates(err.data.matches || [])
      } else {
        setError(err.message)
      }
    }
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={e => { if (e.target === e.currentTarget && !saving) onClose() }}>
      <div style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '640px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>

        {/* 머리 */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>
              {applicant.name} 학생 등록
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#94A3B8' }}>
              {applicant.grade} · {applicant.school || '학교 미입력'} · {applicant.is_academy_student ? 'SMC 재원생' : '비재원생'}
            </p>
          </div>
          <button onClick={onClose} disabled={saving} style={{ border: 'none', background: '#F1F5F9', borderRadius: '10px', width: '34px', height: '34px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={17} color="#64748B" />
          </button>
        </div>

        {/* 본문 */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>

          {/* 등록 상태 */}
          <Section label="어떤 상태로 등록할까요?">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {['재원생', '예비원생'].map(v => {
                const on = as === v
                const s = AS_STYLE[v]
                return (
                  <button key={v} type="button" onClick={() => setAs(v)} style={{
                    padding: '12px', borderRadius: '12px', cursor: 'pointer', textAlign: 'left',
                    border: on ? `2px solid ${s.solid}` : '1.5px solid #E2E8F0',
                    background: on ? s.bg : '#fff',
                  }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: on ? s.color : '#475569' }}>{v}</div>
                    <div style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '2px' }}>
                      {v === '재원생' ? '바로 이용 시작 · 스케줄 관리에 바로 보여요' : '등원 전 대기 · 학생 관리에서 재원생으로 바꾸면 스케줄에 보여요'}
                    </div>
                  </button>
                )
              })}
            </div>
          </Section>

          {/* 이용권 */}
          <Section label="이용권">
            {!startMembership && (
              <p style={{ fontSize: '12px', color: '#D97706', margin: '0 0 8px' }}>
                ⚠️ 예전 신청서라 이용권·스케줄 정보가 없어요. 상담 내용대로 직접 골라주세요.
              </p>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {MEMBERSHIP_OPTIONS.map(opt => {
                const on = membership === opt.value
                return (
                  <button key={opt.value} type="button" onClick={() => changeMembership(opt.value)} style={{
                    padding: '10px', borderRadius: '12px', cursor: 'pointer',
                    border: on ? '2px solid #6366F1' : '1.5px solid #E2E8F0',
                    background: on ? '#EEF2FF' : '#fff', color: on ? '#4F46E5' : '#475569',
                  }}>
                    <div style={{ fontSize: '14px', fontWeight: 700 }}>{opt.label}</div>
                    <div style={{ fontSize: '11px', opacity: 0.8 }}>{opt.desc}</div>
                  </button>
                )
              })}
            </div>
            {startMembership && membership !== startMembership && (
              <p style={{ fontSize: '12px', color: '#D97706', margin: '8px 0 0' }}>
                신청자는 {MEMBERSHIP_LABEL[startMembership]}을 골랐어요. 바뀐 이용권으로 못 오는 요일은 자동으로 비워졌어요.
              </p>
            )}
          </Section>

          {/* 스케줄 */}
          <Section label={`스케줄 (총 ${total}교시) — 신청자가 고른 그대로 채워져 있어요`}>
            <SlotPicker
              membership={membership}
              slots={slots}
              onChange={v => { setSlots(v); setError('') }}
              slotConfig={slotConfig}
              timeConfig={timeConfig}
            />
          </Section>

          {/* 좌석 + 첫등원일 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Section label="좌석번호 (선택)">
              <select value={seat} onChange={e => setSeat(e.target.value)} disabled={freeSeats === null} style={inputStyle}>
                <option value="">{freeSeats === null ? '빈 좌석 확인 중…' : '나중에 배정'}</option>
                {(freeSeats || []).map(n => <option key={n} value={n}>{n}번</option>)}
              </select>
              {freeSeats && freeSeats.length === 0 && (
                <p style={{ fontSize: '11.5px', color: '#94A3B8', margin: '5px 0 0' }}>빈 좌석이 없어요 (나중에 배정 가능)</p>
              )}
            </Section>
            <Section label="첫등원일">
              <input type="date" value={firstDate} onChange={e => setFirstDate(e.target.value)} style={inputStyle} />
            </Section>
          </div>

          {applicant.desired_schedule_text && (
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '12px 14px', fontSize: '12.5px', color: '#475569', whiteSpace: 'pre-wrap' }}>
              <strong>신청자 요청사항</strong> (학생 메모에 같이 저장돼요)<br />{applicant.desired_schedule_text}
            </div>
          )}

          {/* 같은 이름 경고 */}
          {duplicates && (
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '12px', padding: '12px 14px', fontSize: '12.5px', color: '#92400E', lineHeight: 1.6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, marginBottom: '4px' }}>
                <AlertTriangle size={14} /> 같은 이름의 학생이 이미 있어요
              </div>
              {duplicates.map((d, i) => (
                <div key={i}>· {d.name} ({d.grade || '학년?'} · {d.school || '학교?'} · {d.status})</div>
              ))}
              <div style={{ marginTop: '6px' }}>
                같은 학생이면 [닫기] 후 학생 관리에서 확인해주세요. 다른 학생(동명이인)이면 아래 버튼으로 등록하세요.
              </div>
              <button onClick={() => submit(true)} disabled={saving} style={{
                marginTop: '8px', padding: '8px 12px', borderRadius: '10px', border: 'none',
                background: '#D97706', color: '#fff', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
              }}>
                동명이인이에요 — 새 학생으로 등록
              </button>
            </div>
          )}

          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '12px', padding: '10px 14px', fontSize: '12.5px', color: '#B91C1C' }}>
              {error}
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #F1F5F9', display: 'flex', gap: '10px' }}>
          <button onClick={onClose} disabled={saving} style={{
            flex: 1, padding: '12px', borderRadius: '12px', border: '1.5px solid #E2E8F0',
            background: '#fff', fontSize: '14px', fontWeight: 600, color: '#64748B', cursor: 'pointer',
          }}>닫기</button>
          <button onClick={() => submit(false)} disabled={saving || !!duplicates} style={{
            flex: 2, padding: '12px', borderRadius: '12px', border: 'none',
            background: saving || duplicates ? '#CBD5E1' : asStyle.solid,
            fontSize: '14px', fontWeight: 700, color: '#fff', cursor: saving || duplicates ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          }}>
            {saving ? <><Clock size={15} /> 등록 중…</> : <><UserCheck size={15} /> {as}(으)로 등록 + 스케줄 연동</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ================================================================
//  📱 새 신청자 문자 받을 번호 설정 창
// ================================================================
const formatPhone = p => {
  const d = String(p).replace(/[^0-9]/g, '')
  return d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
       : d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : d
}

function NotifyPhonesModal({ initial, ready, onClose, onSaved, showToast }) {
  const [phones,  setPhones]  = useState(initial.map(formatPhone))
  const [input,   setInput]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const [testing, setTesting] = useState(false)
  const [error,   setError]   = useState('')
  const changed = phones.join(',') !== initial.map(formatPhone).join(',')

  const add = () => {
    const d = input.replace(/[^0-9]/g, '')
    if (!/^01[016789]\d{7,8}$/.test(d)) { setError('휴대폰 번호를 정확히 입력해주세요 (예: 010-1234-5678)'); return }
    if (phones.map(p => p.replace(/[^0-9]/g, '')).includes(d)) { setError('이미 등록된 번호예요'); return }
    if (phones.length >= 5) { setError('최대 5개까지 등록할 수 있어요'); return }
    setPhones([...phones, formatPhone(d)]); setInput(''); setError('')
  }

  const save = async () => {
    setSaving(true); setError('')
    try {
      const json = await callApi('PATCH', { action: 'set-notify-phones', phones })
      onSaved(json.phones || [])
      onClose()
    } catch (err) { setError(err.message) }
    setSaving(false)
  }

  const test = async () => {
    setTesting(true); setError('')
    try {
      const json = await callApi('PATCH', { action: 'test-notify' })
      showToast(`솔라피에 ${json.sent}건 접수됐어요 📩 안 오면 [발송 결과 확인]에서 실제 상태를 눌러보세요`)
    } catch (err) { setError(err.message) }
    setTesting(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={e => { if (e.target === e.currentTarget && !saving) onClose() }}>
      <div style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0F172A' }}>📱 새 신청자 알림톡 받을 번호</h2>
            <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#94A3B8' }}>신청서가 들어오면 이 번호들의 카카오톡으로 알림이 가요 (최대 5개)</p>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: '#F1F5F9', borderRadius: '10px', width: '34px', height: '34px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={17} color="#64748B" />
          </button>
        </div>

        <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {!ready && (
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '12px', padding: '10px 14px', fontSize: '12.5px', color: '#92400E' }}>
              ⚠️ 번호를 저장할 테이블이 아직 없어요. Supabase에서 <strong>sql/app_settings.sql</strong>을 먼저 실행해주세요.
            </div>
          )}

          {phones.length === 0 ? (
            <div style={{ padding: '16px', borderRadius: '12px', border: '1.5px dashed #CBD5E1', color: '#94A3B8', fontSize: '13px', textAlign: 'center' }}>
              등록된 번호가 없어요 — 지금은 알림이 안 가요
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {phones.map(p => (
                <div key={p} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '12px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{p}</span>
                  <button onClick={() => setPhones(phones.filter(x => x !== p))} title="삭제" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94A3B8', display: 'flex' }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <input value={input} onChange={e => { setInput(e.target.value); setError('') }}
              onKeyDown={e => { if (e.key === 'Enter') add() }}
              placeholder="010-0000-0000" inputMode="tel"
              style={{ ...inputStyle, flex: 1 }} />
            <button onClick={add} style={{ ...btnStyle, padding: '10px 14px' }}><Plus size={15} /> 추가</button>
          </div>

          {error && <div style={{ fontSize: '12.5px', color: '#DC2626' }}>{error}</div>}

          <button onClick={test} disabled={testing || changed || phones.length === 0} style={{
            ...btnStyle, justifyContent: 'center',
            opacity: testing || changed || phones.length === 0 ? 0.5 : 1,
            cursor: testing || changed || phones.length === 0 ? 'not-allowed' : 'pointer',
          }}>
            <Send size={14} /> {testing ? '보내는 중…' : changed ? '저장 후 테스트할 수 있어요' : '저장된 번호로 테스트 알림 보내기'}
          </button>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid #F1F5F9', display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1.5px solid #E2E8F0', background: '#fff', fontSize: '14px', fontWeight: 600, color: '#64748B', cursor: 'pointer' }}>닫기</button>
          <button onClick={save} disabled={saving || !changed} style={{
            flex: 2, padding: '12px', borderRadius: '12px', border: 'none',
            background: saving || !changed ? '#CBD5E1' : 'linear-gradient(135deg,#6366F1,#7C3AED)',
            fontSize: '14px', fontWeight: 700, color: '#fff', cursor: saving || !changed ? 'not-allowed' : 'pointer',
          }}>{saving ? '저장 중…' : '저장'}</button>
        </div>
      </div>
    </div>
  )
}

function Section({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#374151', marginBottom: '8px' }}>{label}</div>
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #E2E8F0',
  background: '#F8FAFC', fontSize: '13.5px', color: '#0F172A', outline: 'none', boxSizing: 'border-box',
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
