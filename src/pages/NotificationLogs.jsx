// ================================================================
// 📁 src/pages/NotificationLogs.jsx  (신규 - 기능1: 알림톡 발송 결과 확인)
// ================================================================
// 비유: 우체국 "발송 일지"를 보는 화면이에요.
//   - "발송 시도" 칸: 우리 서버가 솔라피에게 보내달라고 요청했을 때 성공/실패했는지
//   - "실제 상태" 칸: 솔라피에게 "진짜 도착했어요?"라고 다시 물어본 결과
//     (이 칸은 버튼을 눌러야 채워져요 - 누를 때마다 솔라피에 다시 물어보기 때문이에요)
// ================================================================

import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import {
  MessageSquare, RefreshCw, Star, AlertTriangle, Eye,
  CheckCircle2, XCircle, HelpCircle, Loader,
} from 'lucide-react'
import { fetchNotificationLogs, checkNotificationStatus } from '../lib/notificationLogsApi'

const cell = { border: '1px solid #E2E8F0', padding: '11px 14px', verticalAlign: 'middle' }

const TYPE_INFO = {
  schedule: { label: '스케줄 알림톡', icon: Eye,           bg: '#EEF2FF', color: '#6366F1' },
  penalty:  { label: '벌점 알림톡',   icon: AlertTriangle,  bg: '#FFF1F2', color: '#E11D48' },
  reward:   { label: '상점 알림톡',   icon: Star,           bg: '#FFFBEB', color: '#D97706' },
}

function formatDateTime(iso) {
  if (!iso) return '–'
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function NotificationLogs() {
  const [logs,        setLogs]        = useState([])
  const [loading,     setLoading]     = useState(true)
  const [checkingId,  setCheckingId]  = useState(null)
  const [toast,       setToast]       = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchNotificationLogs(100)
      setLogs(data)
    } catch (err) {
      showToast('발송 기록을 불러오지 못했어요: ' + err.message, 'error')
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadLogs() }, [loadLogs])

  // ── "실제 상태 확인" 버튼 클릭 ──
  const handleCheck = async (log) => {
    if (!log.solapi_group_id) {
      showToast('이 기록은 그룹 ID가 없어 조회할 수 없어요 (발송 자체가 실패한 건이에요)', 'error')
      return
    }
    setCheckingId(log.id)
    try {
      const updated = await checkNotificationStatus(log.id)
      setLogs(prev => prev.map(l => (l.id === log.id ? updated : l)))
      showToast('실제 상태를 새로 확인했어요 ✅')
    } catch (err) {
      showToast('상태 확인 실패: ' + err.message, 'error')
    }
    setCheckingId(null)
  }

  return (
    <Layout>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      <div style={{ padding: '28px 32px' }}>

        {/* ── 페이지 헤더 ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '46px', height: '46px', borderRadius: '14px', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageSquare size={22} style={{ color: '#6366F1' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0F172A', margin: 0 }}>알림톡 발송 결과</h1>
              <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '3px' }}>
                최근 발송한 알림톡 {logs.length}건 · 행마다 [실제 상태 확인]을 누르면 솔라피에 다시 물어봐요
              </p>
            </div>
          </div>
          <button onClick={loadLogs} disabled={loading} style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 18px', borderRadius: '12px', border: '1.5px solid #E2E8F0',
            background: '#fff', color: '#475569', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
          }}>
            <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            목록 새로고침
          </button>
        </div>

        {/* ── 안내 카드 ── */}
        <div style={{
          background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '14px',
          padding: '14px 18px', marginBottom: '18px', fontSize: '12.5px', color: '#92400E', lineHeight: 1.6,
        }}>
          💡 <strong>발송 시도</strong>는 우리 서버가 솔라피에 "보내주세요" 요청한 결과예요 (성공/실패).<br />
          <strong>실제 상태</strong>는 카카오/통신사가 실제로 전달했는지를 솔라피에 다시 물어본 결과예요. 발송 직후엔 아직 빈칸일 수 있고, 1~2분 후 버튼을 눌러보면 채워져요.
        </div>

        {/* ── 발송 기록 테이블 ── */}
        <div style={{
          background: '#fff', borderRadius: '16px',
          border: '1px solid #E2E8F0', overflowX: 'auto',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr>
                {['발송일시', '종류', '학생', '수신번호', '발송 시도', '실제 상태', ''].map(h => (
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
                <tr><td colSpan={7} style={{ ...cell, textAlign: 'center', padding: '64px 0', color: '#94A3B8' }}>불러오는 중...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={7} style={{ ...cell, textAlign: 'center', padding: '64px 0', color: '#94A3B8' }}>발송 기록이 없어요</td></tr>
              ) : (
                logs.map((log, idx) => {
                  const info = TYPE_INFO[log.notify_type] || { label: log.notify_type || '–', icon: MessageSquare, bg: '#F1F5F9', color: '#64748B' }
                  const Icon = info.icon
                  return (
                    <tr key={log.id} style={{ background: idx % 2 === 0 ? '#fff' : '#FAFBFF' }}>
                      <td style={{ ...cell, color: '#64748B', whiteSpace: 'nowrap', fontSize: '12px' }}>{formatDateTime(log.created_at)}</td>
                      <td style={cell}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                          padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
                          background: info.bg, color: info.color, whiteSpace: 'nowrap',
                        }}><Icon size={11} /> {info.label}</span>
                      </td>
                      <td style={{ ...cell, fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>{log.student_name || '–'}</td>
                      <td style={{ ...cell, color: '#64748B', fontFamily: 'monospace', fontSize: '12px' }}>{log.phone || '–'}</td>
                      <td style={cell}>
                        {log.send_status === 'sent'
                          ? <Badge text="발송 성공" bg="#ECFDF5" color="#059669" icon={CheckCircle2} />
                          : <Badge text={log.error_message ? `실패: ${log.error_message}` : '발송 실패'} bg="#FEF2F2" color="#DC2626" icon={XCircle} />}
                      </td>
                      <td style={cell}>
                        {log.solapi_status_message
                          ? <Badge
                              text={`${log.solapi_status_message}${log.solapi_status_code ? ` (${log.solapi_status_code})` : ''}`}
                              bg={log.solapi_status_code === '4000' ? '#ECFDF5' : '#F1F5F9'}
                              color={log.solapi_status_code === '4000' ? '#059669' : '#475569'}
                              icon={log.solapi_status_code === '4000' ? CheckCircle2 : HelpCircle}
                            />
                          : <span style={{ color: '#CBD5E1', fontSize: '12px' }}>확인 전</span>}
                        {log.checked_at && (
                          <p style={{ fontSize: '10px', color: '#CBD5E1', marginTop: '3px' }}>
                            {formatDateTime(log.checked_at)} 확인
                          </p>
                        )}
                      </td>
                      <td style={cell}>
                        <button
                          onClick={() => handleCheck(log)}
                          disabled={checkingId === log.id || !log.solapi_group_id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '5px',
                            padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
                            background: '#EEF2FF', color: '#6366F1', border: '1px solid #C7D2FE',
                            cursor: (!log.solapi_group_id || checkingId === log.id) ? 'not-allowed' : 'pointer',
                            opacity: !log.solapi_group_id ? 0.4 : 1,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {checkingId === log.id
                            ? <><Loader size={12} /> 확인 중</>
                            : <><RefreshCw size={12} /> 실제 상태 확인</>}
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
    </Layout>
  )
}

function Badge({ text, bg, color, icon: Icon }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
      background: bg, color, whiteSpace: 'nowrap', maxWidth: '220px',
    }}>
      <Icon size={11} style={{ flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span>
    </span>
  )
}

function Toast({ msg, type }) {
  return (
    <div style={{
      position: 'fixed', top: '20px', right: '20px', zIndex: 100,
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '12px 18px', borderRadius: '14px',
      background: type === 'success' ? '#10B981' : '#EF4444',
      color: '#fff', fontSize: '13px', fontWeight: 600,
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
    }}>
      <CheckCircle2 size={15} /> {msg}
    </div>
  )
}
