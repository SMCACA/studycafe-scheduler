import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { createClient } from '@supabase/supabase-js'
import {
  BookMarked, Plus, X, Trash2, Edit2, Copy, Check, Search, Tag
} from 'lucide-react'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

const CATEGORIES = [
  { value: 'schedule',  label: '스케줄 안내',   color: '#6366F1', bg: '#EEF2FF' },
  { value: 'absence',   label: '결석 안내',     color: '#EF4444', bg: '#FEF2F2' },
  { value: 'notice',    label: '공지',          color: '#F59E0B', bg: '#FFF7ED' },
  { value: 'reward',    label: '상벌점',        color: '#10B981', bg: '#ECFDF5' },
  { value: 'etc',       label: '기타',          color: '#64748B', bg: '#F8FAFC' },
]

const getCat = (value) => CATEGORIES.find(c => c.value === value) || CATEGORIES[4]

const EMPTY_FORM = { title: '', content: '', category: 'schedule' }

export default function SavedMessages() {
  const [messages,    setMessages]    = useState([])
  const [loading,     setLoading]     = useState(false)
  const [modalOpen,   setModalOpen]   = useState(false)
  const [editingMsg,  setEditingMsg]  = useState(null)
  const [form,        setForm]        = useState({ ...EMPTY_FORM })
  const [toast,       setToast]       = useState(null)
  const [copiedId,    setCopiedId]    = useState(null)
  const [searchQ,     setSearchQ]     = useState('')
  const [catFilter,   setCatFilter]   = useState('all')

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  const fetchMessages = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('saved_messages')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error && data) setMessages(data)
    setLoading(false)
  }

  useEffect(() => { fetchMessages() }, [])

  const openNew = () => {
    setEditingMsg(null)
    setForm({ ...EMPTY_FORM })
    setModalOpen(true)
  }

  const openEdit = (msg) => {
    setEditingMsg(msg)
    setForm({ title: msg.title, content: msg.content, category: msg.category || 'etc' })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.title.trim())   { showToast('제목을 입력해주세요', 'error'); return }
    if (!form.content.trim()) { showToast('문구 내용을 입력해주세요', 'error'); return }

    const payload = {
      title:    form.title.trim(),
      content:  form.content.trim(),
      category: form.category,
    }

    let error
    if (editingMsg) {
      ;({ error } = await supabase.from('saved_messages').update(payload).eq('id', editingMsg.id))
      if (!error) showToast('문구가 수정됐어요 ✏️')
    } else {
      ;({ error } = await supabase.from('saved_messages').insert(payload))
      if (!error) showToast('문구가 저장됐어요 💾')
    }

    if (error) { showToast('저장 중 오류가 발생했어요', 'error'); return }
    setModalOpen(false)
    fetchMessages()
  }

  const handleDelete = async (id) => {
    if (!window.confirm('이 문구를 삭제할까요?')) return
    const { error } = await supabase.from('saved_messages').delete().eq('id', id)
    if (error) { showToast('삭제 중 오류가 발생했어요', 'error'); return }
    showToast('문구가 삭제됐어요 🗑️')
    fetchMessages()
  }

  const handleCopy = async (msg) => {
    try {
      await navigator.clipboard.writeText(msg.content)
      setCopiedId(msg.id)
      showToast('클립보드에 복사됐어요 📋')
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      showToast('복사에 실패했어요', 'error')
    }
  }

  // 필터 + 검색
  const filtered = messages.filter(m => {
    const matchCat = catFilter === 'all' || m.category === catFilter
    const q = searchQ.trim().toLowerCase()
    const matchQ = !q || m.title.toLowerCase().includes(q) || m.content.toLowerCase().includes(q)
    return matchCat && matchQ
  })

  return (
    <Layout>
      <div style={{ padding: '28px 32px' }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '46px', height: '46px', borderRadius: '14px', background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookMarked size={22} style={{ color: '#7C3AED' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0F172A', margin: 0 }}>문구 저장</h1>
              <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '3px' }}>자주 쓰는 알림톡 문구를 저장하고 빠르게 복사하세요</p>
            </div>
          </div>
          <button
            onClick={openNew}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 18px', borderRadius: '12px', border: 'none',
              background: 'linear-gradient(135deg,#7C3AED,#6366F1)',
              color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(124,58,237,0.3)',
            }}
          >
            <Plus size={15} /> 문구 추가
          </button>
        </div>

        {/* 검색 + 카테고리 필터 */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* 검색 */}
          <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="제목 또는 내용으로 검색..."
              style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: '10px', border: '1.5px solid #E2E8F0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', color: '#0F172A', background: '#fff' }}
              onFocus={e => { e.target.style.borderColor = '#7C3AED' }}
              onBlur={e => { e.target.style.borderColor = '#E2E8F0' }}
            />
          </div>

          {/* 카테고리 필터 */}
          <button
            onClick={() => setCatFilter('all')}
            style={{
              padding: '7px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              border: catFilter === 'all' ? '1.5px solid #7C3AED' : '1.5px solid #E2E8F0',
              background: catFilter === 'all' ? '#F5F3FF' : '#fff',
              color: catFilter === 'all' ? '#7C3AED' : '#64748B',
            }}
          >전체</button>
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => setCatFilter(catFilter === cat.value ? 'all' : cat.value)}
              style={{
                padding: '7px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                border: catFilter === cat.value ? `1.5px solid ${cat.color}` : '1.5px solid #E2E8F0',
                background: catFilter === cat.value ? cat.bg : '#fff',
                color: catFilter === cat.value ? cat.color : '#64748B',
              }}
            >{cat.label}</button>
          ))}
        </div>

        {/* 결과 카운트 */}
        <p style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '14px' }}>
          {filtered.length}개의 문구
        </p>

        {/* 목록 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#94A3B8', fontSize: '14px' }}>불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px', background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
            <p style={{ fontSize: '40px', marginBottom: '12px' }}>💬</p>
            <p style={{ fontWeight: 600, color: '#64748B', fontSize: '15px' }}>저장된 문구가 없어요</p>
            <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '4px' }}>자주 쓰는 알림톡 문구를 미리 저장해두세요</p>
            <button
              onClick={openNew}
              style={{ marginTop: '16px', padding: '10px 20px', borderRadius: '10px', border: 'none', background: '#7C3AED', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
            >첫 문구 추가하기</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '14px' }}>
            {filtered.map(msg => {
              const cat = getCat(msg.category)
              const isCopied = copiedId === msg.id
              return (
                <div
                  key={msg.id}
                  style={{
                    background: '#fff', borderRadius: '16px',
                    border: `1.5px solid ${cat.bg === '#F8FAFC' ? '#E2E8F0' : cat.bg}`,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                    display: 'flex', flexDirection: 'column',
                    transition: 'box-shadow 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)' }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)' }}
                >
                  {/* 카드 헤더 */}
                  <div style={{ padding: '14px 16px 10px', borderBottom: `1px solid ${cat.bg}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
                      background: cat.bg, color: cat.color,
                    }}>{cat.label}</span>
                    <span style={{ flex: 1, fontSize: '14px', fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {msg.title}
                    </span>
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      <button onClick={() => openEdit(msg)} style={{ width: '28px', height: '28px', borderRadius: '7px', border: '1.5px solid #E2E8F0', background: '#F8FAFC', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Edit2 size={12} style={{ color: '#64748B' }} />
                      </button>
                      <button onClick={() => handleDelete(msg.id)} style={{ width: '28px', height: '28px', borderRadius: '7px', border: '1.5px solid #FECACA', background: '#FEF2F2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Trash2 size={12} style={{ color: '#EF4444' }} />
                      </button>
                    </div>
                  </div>

                  {/* 문구 내용 */}
                  <div style={{ padding: '12px 16px', flex: 1 }}>
                    <p style={{ fontSize: '13px', color: '#374151', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {msg.content}
                    </p>
                  </div>

                  {/* 복사 버튼 + 날짜 */}
                  <div style={{ padding: '10px 16px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', color: '#CBD5E1' }}>
                      {new Date(msg.created_at).toLocaleDateString('ko-KR')}
                    </span>
                    <button
                      onClick={() => handleCopy(msg)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '7px 14px', borderRadius: '10px',
                        border: isCopied ? '1.5px solid #10B981' : '1.5px solid #E2E8F0',
                        background: isCopied ? '#ECFDF5' : '#F8FAFC',
                        color: isCopied ? '#059669' : '#64748B',
                        fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {isCopied
                        ? <><Check size={13} /> 복사됨!</>
                        : <><Copy size={13} /> 복사하기</>
                      }
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* --
          모달: 문구 추가 / 수정
      -- */}
      {modalOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}
          onClick={() => setModalOpen(false)}
        >
          <div
            style={{ background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                {editingMsg ? '문구 수정' : '새 문구 추가'}
              </h2>
              <button onClick={() => setModalOpen(false)} style={{ width: '32px', height: '32px', borderRadius: '10px', border: 'none', background: '#F1F5F9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} style={{ color: '#64748B' }} />
              </button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* 제목 */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '6px' }}>문구 제목 *</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="예) 스케줄 안내 기본 문구"
                  autoFocus
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #E2E8F0', fontSize: '14px', outline: 'none', boxSizing: 'border-box', color: '#0F172A' }}
                  onFocus={e => { e.target.style.borderColor = '#7C3AED' }}
                  onBlur={e => { e.target.style.borderColor = '#E2E8F0' }}
                />
              </div>

              {/* 카테고리 */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '8px' }}>
                  <Tag size={12} style={{ display: 'inline', marginRight: '4px' }} />카테고리
                </label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {CATEGORIES.map(cat => {
                    const active = form.category === cat.value
                    return (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, category: cat.value }))}
                        style={{
                          padding: '6px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                          border: active ? `2px solid ${cat.color}` : '1.5px solid #E2E8F0',
                          background: active ? cat.bg : '#F8FAFC',
                          color: active ? cat.color : '#64748B',
                          transition: 'all 0.12s',
                        }}
                      >{cat.label}</button>
                    )
                  })}
                </div>
              </div>

              {/* 내용 */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '6px' }}>문구 내용 *</label>
                <textarea
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="알림톡에 사용할 문구를 입력하세요"
                  rows={6}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #E2E8F0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', resize: 'vertical', color: '#0F172A', fontFamily: 'inherit', lineHeight: 1.7 }}
                  onFocus={e => { e.target.style.borderColor = '#7C3AED' }}
                  onBlur={e => { e.target.style.borderColor = '#E2E8F0' }}
                />
                <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px', textAlign: 'right' }}>
                  {form.content.length}자
                </p>
              </div>
            </div>

            <div style={{ padding: '0 24px 24px', display: 'flex', gap: '10px' }}>
              <button onClick={() => setModalOpen(false)} style={{ flex: 1, padding: '11px', borderRadius: '12px', border: '1.5px solid #E2E8F0', background: '#fff', fontSize: '14px', fontWeight: 600, color: '#64748B', cursor: 'pointer' }}>취소</button>
              <button onClick={handleSave} style={{ flex: 2, padding: '11px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#7C3AED,#6366F1)', fontSize: '14px', fontWeight: 700, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 14px rgba(124,58,237,0.3)' }}>
                {editingMsg ? '수정 완료' : '저장하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 토스트 */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 100,
          padding: '12px 18px', borderRadius: '14px',
          background: toast.type === 'error' ? '#EF4444' : '#10B981',
          color: '#fff', fontSize: '13px', fontWeight: 600,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        }}>
          {toast.msg}
        </div>
      )}
    </Layout>
  )
}
