// ================================================================
// 📁 src/pages/Manuals.jsx  (신규 - 기능4: 매뉴얼 저장함)
// ================================================================
// 비유: 스터디카페 운영 매뉴얼들을 보관하는 "사서함"이에요.
//   제목을 정하고 파일(PDF, 워드, 이미지 등 무엇이든)을 올려두면,
//   누구나 로그인해서 들어와 다운로드할 수 있어요.
// ================================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import Layout from '../components/Layout'
import {
  Archive, Upload, FileText, Trash2, Download, Loader, CheckCircle, AlertTriangle,
} from 'lucide-react'
import { fetchManuals, uploadManual, deleteManual } from '../lib/manualsApi'

function formatSize(bytes) {
  if (!bytes) return '–'
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

function formatDate(iso) {
  if (!iso) return '–'
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`
}

export default function Manuals() {
  const [manuals,     setManuals]     = useState([])
  const [loading,      setLoading]    = useState(true)
  const [title,        setTitle]      = useState('')
  const [file,         setFile]       = useState(null)
  const [uploading,    setUploading]  = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting,     setDeleting]   = useState(false)
  const [toast,        setToast]      = useState(null)
  const fileInputRef = useRef(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  const loadManuals = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchManuals()
      setManuals(data)
    } catch (err) {
      showToast('매뉴얼 목록을 불러오지 못했어요: ' + err.message, 'error')
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadManuals() }, [loadManuals])

  const handleUpload = async () => {
    if (!title.trim()) { showToast('제목을 입력해주세요', 'error'); return }
    if (!file) { showToast('파일을 선택해주세요', 'error'); return }

    setUploading(true)
    try {
      await uploadManual({ title, file })
      showToast(`'${title.trim()}' 매뉴얼이 등록됐어요 📁`)
      setTitle('')
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      loadManuals()
    } catch (err) {
      showToast(err.message, 'error')
    }
    setUploading(false)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteManual(deleteTarget)
      showToast(`'${deleteTarget.title}' 매뉴얼이 삭제됐어요 🗑️`)
      setDeleteTarget(null)
      loadManuals()
    } catch (err) {
      showToast('삭제 실패: ' + err.message, 'error')
    }
    setDeleting(false)
  }

  return (
    <Layout>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      <div style={{ padding: '28px 32px' }}>

        {/* ── 페이지 헤더 ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
          <div style={{ width: '46px', height: '46px', borderRadius: '14px', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Archive size={22} style={{ color: '#6366F1' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0F172A', margin: 0 }}>매뉴얼 저장함</h1>
            <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '3px' }}>
              스터디카페 운영 매뉴얼 {manuals.length}건 보관 중
            </p>
          </div>
        </div>

        {/* ── 업로드 카드 ── */}
        <div style={{
          background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0',
          padding: '20px', marginBottom: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '12px' }}>새 매뉴얼 등록</p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text" placeholder="매뉴얼 제목 (예: 등원 응대 매뉴얼)"
              value={title} onChange={e => setTitle(e.target.value)}
              style={{
                flex: '1 1 240px', padding: '10px 14px', borderRadius: '10px',
                border: '1.5px solid #E2E8F0', fontSize: '13px', outline: 'none',
                background: '#F8FAFC', color: '#0F172A', boxSizing: 'border-box',
              }}
            />
            <label style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
              borderRadius: '10px', border: '1.5px dashed #C7D2FE', background: '#EEF2FF',
              color: '#6366F1', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
              <Upload size={14} />
              {file ? file.name : '파일 선택'}
              <input
                ref={fileInputRef}
                type="file" style={{ display: 'none' }}
                onChange={e => setFile(e.target.files?.[0] || null)}
              />
            </label>
            <button
              onClick={handleUpload}
              disabled={uploading}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '10px 20px', borderRadius: '10px', border: 'none',
                background: uploading ? '#A5B4FC' : 'linear-gradient(135deg,#6366F1,#7C3AED)',
                color: '#fff', fontSize: '13px', fontWeight: 700,
                cursor: uploading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {uploading ? <><Loader size={14} /> 업로드 중...</> : <><Upload size={14} /> 등록하기</>}
            </button>
          </div>
        </div>

        {/* ── 매뉴얼 목록 ── */}
        <div style={{
          background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0',
          overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '64px 0', color: '#94A3B8' }}>불러오는 중...</div>
          ) : manuals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 0' }}>
              <Archive size={32} style={{ color: '#E2E8F0', display: 'block', margin: '0 auto 10px' }} />
              <p style={{ color: '#94A3B8', fontSize: '14px' }}>등록된 매뉴얼이 없어요</p>
            </div>
          ) : (
            manuals.map((m, idx) => (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '16px 22px',
                borderTop: idx === 0 ? 'none' : '1px solid #F1F5F9',
              }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileText size={18} style={{ color: '#6366F1' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', margin: 0 }}>{m.title}</p>
                  <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.file_name} · {formatSize(m.file_size)} · {formatDate(m.uploaded_at)} 등록
                  </p>
                </div>
                <a href={m.file_url} target="_blank" rel="noreferrer" style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
                  borderRadius: '10px', background: '#EEF2FF', color: '#6366F1',
                  border: '1px solid #C7D2FE', fontSize: '12px', fontWeight: 700,
                  textDecoration: 'none', flexShrink: 0,
                }}>
                  <Download size={13} /> 다운로드
                </a>
                <button onClick={() => setDeleteTarget(m)} style={{
                  display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 12px',
                  borderRadius: '10px', background: '#FEF2F2', color: '#EF4444',
                  border: '1px solid #FECACA', fontSize: '12px', fontWeight: 700,
                  cursor: 'pointer', flexShrink: 0,
                }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '360px', padding: '28px 24px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <AlertTriangle size={24} style={{ color: '#EF4444' }} />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>매뉴얼을 삭제할까요?</h3>
              <p style={{ fontSize: '13px', color: '#64748B', lineHeight: 1.6 }}>
                <strong style={{ color: '#0F172A' }}>{deleteTarget.title}</strong><br />파일이 영구적으로 삭제됩니다.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setDeleteTarget(null)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1.5px solid #E2E8F0', background: '#fff', fontSize: '14px', fontWeight: 600, color: '#64748B', cursor: 'pointer' }}>취소</button>
              <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: deleting ? '#FCA5A5' : '#EF4444', fontSize: '14px', fontWeight: 700, color: '#fff', cursor: deleting ? 'not-allowed' : 'pointer' }}>
                {deleting ? '삭제 중…' : '삭제하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
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
      <CheckCircle size={15} /> {msg}
    </div>
  )
}
