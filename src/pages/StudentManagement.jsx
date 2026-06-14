import { useState, useEffect } from 'react'
import { Users, Search, Plus, Edit2, Trash2, X, CheckCircle, AlertTriangle } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import Layout from '../components/Layout'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

const GRADES = ['중1','중2','중3','고1','고2','고3']

// ✅ 학생 상태 정의
const STATUS_OPTIONS = ['재원생', '예비원생', '퇴원생']
const STATUS_STYLE = {
  재원생:  { bg:'#ECFDF5', color:'#059669', border:'#A7F3D0' },
  예비원생: { bg:'#EEF2FF', color:'#6366F1', border:'#C7D2FE' },
  퇴원생:  { bg:'#F8FAFC', color:'#94A3B8', border:'#E2E8F0' },
}

const cell = { border:'1px solid #E2E8F0', padding:'11px 14px', verticalAlign:'middle' }

export default function StudentManagement() {
  const [students,       setStudents]       = useState([])
  const [search,         setSearch]         = useState('')
  const [statusFilter,   setStatusFilter]   = useState('재원생')   // ✅ 상태 필터 (기본: 재원생)
  const [isModalOpen,    setIsModalOpen]    = useState(false)
  const [editingStudent, setEditingStudent] = useState(null)
  const [deleteTarget,   setDeleteTarget]   = useState(null)
  const [toast,          setToast]          = useState(null)
  const [loading,        setLoading]        = useState(false)

  useEffect(() => { fetchStudents() }, [])

  const fetchStudents = async () => {
    const { data, error } = await supabase.from('students').select('*').order('name')
    if (error) { showToast('학생 목록을 불러오지 못했어요', 'error'); return }
    setStudents(data || [])
  }

  // ✅ 상태 필터 + 검색 필터 동시 적용
  const filtered = students.filter(s => {
    const matchStatus = statusFilter === '전체' || (s.status || '재원생') === statusFilter
    const matchSearch = !search ||
      s.name?.includes(search) || s.school?.includes(search) ||
      s.grade?.includes(search) || String(s.seat_number||'').includes(search)
    return matchStatus && matchSearch
  })

  const showToast = (msg, type='success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  const openAdd  = () => { setEditingStudent(null); setIsModalOpen(true) }
  const openEdit = s  => { setEditingStudent(s);    setIsModalOpen(true) }
  const closeModal = () => { setIsModalOpen(false); setEditingStudent(null) }

  const handleSave = async (formData) => {
    setLoading(true)
    try {
      if (editingStudent) {
        const { error } = await supabase.from('students').update(formData).eq('id', editingStudent.id)
        if (error) throw error
        showToast(`${formData.name} 학생 정보가 수정됐어요 ✏️`)
      } else {
        const { error } = await supabase.from('students').insert(formData)
        if (error) throw error
        showToast(`${formData.name} 학생이 등록됐어요 🎉`)
      }
      closeModal(); fetchStudents()
    } catch (err) { showToast(`저장 실패: ${err.message}`, 'error') }
    finally { setLoading(false) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setLoading(true)
    try {
      const { error } = await supabase.from('students').delete().eq('id', deleteTarget.id)
      if (error) throw error
      showToast(`${deleteTarget.name} 학생이 삭제됐어요 🗑️`, 'error')
      setDeleteTarget(null); fetchStudents()
    } catch (err) { showToast(`삭제 실패: ${err.message}`, 'error') }
    finally { setLoading(false) }
  }

  // 각 상태별 인원수
  const countByStatus = (status) => students.filter(s => (s.status || '재원생') === status).length

  return (
    <Layout>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      <div style={{ padding:'28px 32px' }}>

        {/* ── 페이지 헤더 ── */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'20px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
            <div style={{ width:'46px', height:'46px', borderRadius:'14px', background:'#EEF2FF', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Users size={22} style={{ color:'#6366F1' }} />
            </div>
            <div>
              <h1 style={{ fontSize:'22px', fontWeight:700, color:'#0F172A', margin:0 }}>학생 관리</h1>
              <p style={{ fontSize:'13px', color:'#94A3B8', marginTop:'3px' }}>
                재원생 {countByStatus('재원생')}명 · 예비원생 {countByStatus('예비원생')}명 · 퇴원생 {countByStatus('퇴원생')}명
              </p>
            </div>
          </div>
          <button
            onClick={openAdd}
            style={{
              display:'flex', alignItems:'center', gap:'8px',
              padding:'11px 20px', borderRadius:'12px', border:'none',
              background:'linear-gradient(135deg,#6366F1,#7C3AED)',
              color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer',
              boxShadow:'0 4px 12px rgba(99,102,241,0.3)',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 6px 16px rgba(99,102,241,0.4)' }}
            onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 4px 12px rgba(99,102,241,0.3)' }}
          >
            <Plus size={16} /> 학생 등록
          </button>
        </div>

        {/* ✅ 상태 필터 탭 */}
        <div style={{ display:'flex', gap:'8px', marginBottom:'16px', flexWrap:'wrap' }}>
          {['전체', ...STATUS_OPTIONS].map(st => {
            const count = st === '전체' ? students.length : countByStatus(st)
            const isActive = statusFilter === st
            const sty = STATUS_STYLE[st] || { bg:'#F1F5F9', color:'#475569', border:'#E2E8F0' }
            return (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                style={{
                  display:'flex', alignItems:'center', gap:'6px',
                  padding:'7px 16px', borderRadius:'999px', fontSize:'13px', fontWeight:600,
                  cursor:'pointer', transition:'all 0.15s',
                  border: isActive ? `1.5px solid ${sty.border}` : '1.5px solid #E2E8F0',
                  background: isActive ? sty.bg : '#fff',
                  color: isActive ? sty.color : '#64748B',
                  boxShadow: isActive ? `0 0 0 3px ${sty.border}44` : 'none',
                }}
              >
                {st}
                <span style={{
                  display:'inline-flex', alignItems:'center', justifyContent:'center',
                  width:'18px', height:'18px', borderRadius:'999px', fontSize:'10px', fontWeight:700,
                  background: isActive ? sty.color : '#E2E8F0',
                  color: isActive ? '#fff' : '#64748B',
                }}>{count}</span>
              </button>
            )
          })}

          {/* 검색창 (오른쪽) */}
          <div style={{ position:'relative', marginLeft:'auto' }}>
            <Search size={15} style={{ position:'absolute', left:'14px', top:'50%', transform:'translateY(-50%)', color:'#CBD5E1' }} />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="이름, 학교, 학년, 좌석번호 검색"
              style={{
                padding:'9px 14px 9px 40px', borderRadius:'12px',
                border:'1.5px solid #E2E8F0', fontSize:'13px', outline:'none',
                background:'#fff', color:'#0F172A', width:'240px',
              }}
              onFocus={e => { e.target.style.borderColor='#6366F1'; e.target.style.boxShadow='0 0 0 3px rgba(99,102,241,0.1)' }}
              onBlur={e  => { e.target.style.borderColor='#E2E8F0'; e.target.style.boxShadow='none' }}
            />
          </div>
        </div>

        {/* ── 학생 테이블 ── */}
        <div style={{
          background:'#fff', borderRadius:'16px',
          border:'1px solid #E2E8F0', overflowX:'auto',
          boxShadow:'0 1px 4px rgba(0,0,0,0.04)',
        }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
            <thead>
              <tr>
                {['좌석','이름','상태','학년','학교','학부모','학부모 전화','학생 전화','특이사항','메모','관리'].map(h => (
                  <th key={h} style={{
                    ...cell, background:'#F8FAFC',
                    fontSize:'11px', fontWeight:700, color:'#64748B',
                    letterSpacing:'0.04em', textAlign:'left', whiteSpace:'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ ...cell, textAlign:'center', padding:'64px 0' }}>
                    <Users size={32} style={{ color:'#E2E8F0', display:'block', margin:'0 auto 10px' }} />
                    <p style={{ color:'#94A3B8', fontSize:'14px' }}>
                      {search ? '검색 결과가 없어요' : `${statusFilter} 학생이 없어요`}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((s, idx) => {
                  const isHigh = s.grade?.startsWith('고')
                  const status = s.status || '재원생'
                  const sStyle = STATUS_STYLE[status]
                  return (
                    <tr key={s.id}
                      style={{ background: idx%2===0 ? '#fff' : '#FAFBFF', transition:'background 0.12s' }}
                      onMouseEnter={e => { e.currentTarget.style.background='#F0F4FF' }}
                      onMouseLeave={e => { e.currentTarget.style.background = idx%2===0 ? '#fff' : '#FAFBFF' }}
                    >
                      {/* 좌석 */}
                      <td style={{ ...cell, textAlign:'center' }}>
                        {s.seat_number
                          ? <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:'28px', height:'28px', borderRadius:'8px', background:'#EEF2FF', color:'#6366F1', fontSize:'12px', fontWeight:700 }}>{s.seat_number}</span>
                          : <span style={{ color:'#CBD5E1' }}>–</span>
                        }
                      </td>
                      {/* 이름 */}
                      <td style={{ ...cell, fontWeight:700, color:'#0F172A', whiteSpace:'nowrap' }}>{s.name}</td>
                      {/* ✅ 상태 배지 */}
                      <td style={cell}>
                        <span style={{
                          padding:'2px 10px', borderRadius:'999px', fontSize:'11px', fontWeight:700,
                          background: sStyle.bg, color: sStyle.color, border: `1px solid ${sStyle.border}`,
                          whiteSpace:'nowrap',
                        }}>{status}</span>
                      </td>
                      {/* 학년 */}
                      <td style={cell}>
                        {s.grade && (
                          <span style={{
                            padding:'2px 10px', borderRadius:'999px', fontSize:'11px', fontWeight:700,
                            background: isHigh ? '#EEF2FF' : '#ECFDF5',
                            color:      isHigh ? '#4F46E5' : '#059669',
                          }}>{s.grade}</span>
                        )}
                      </td>
                      {/* 학교 */}
                      <td style={{ ...cell, color:'#64748B' }}>{s.school || '–'}</td>
                      {/* 학부모 */}
                      <td style={{ ...cell, color:'#64748B' }}>{s.parent_name || '–'}</td>
                      {/* 학부모 전화 */}
                      <td style={{ ...cell, color:'#64748B', fontFamily:'monospace', fontSize:'12px' }}>{s.parent_phone || '–'}</td>
                      {/* 학생 전화 */}
                      <td style={{ ...cell, color:'#64748B', fontFamily:'monospace', fontSize:'12px' }}>{s.student_phone || '–'}</td>
                      {/* ✅ 특이사항 */}
                      <td style={{ ...cell, textAlign:'center' }}>
                        {s.special_notes
                          ? <span title={s.special_notes} style={{
                              display:'inline-flex', alignItems:'center', gap:'4px',
                              padding:'2px 8px', borderRadius:'999px', fontSize:'11px', fontWeight:700,
                              background:'#FFF7ED', color:'#D97706', border:'1px solid #FDE68A', cursor:'help',
                            }}>⚠️ 있음</span>
                          : <span style={{ color:'#CBD5E1' }}>–</span>
                        }
                      </td>
                      {/* 메모 */}
                      <td style={{ ...cell, color:'#CBD5E1', maxWidth:'120px' }}>
                        <span style={{ display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {s.memo || '–'}
                        </span>
                      </td>
                      {/* 관리 버튼 */}
                      <td style={cell}>
                        <div style={{ display:'flex', gap:'6px' }}>
                          <button onClick={() => openEdit(s)} style={{ display:'flex', alignItems:'center', gap:'4px', padding:'5px 10px', borderRadius:'8px', fontSize:'11px', fontWeight:700, background:'#EEF2FF', color:'#6366F1', border:'1px solid #C7D2FE', cursor:'pointer' }}
                            onMouseEnter={e => { e.currentTarget.style.background='#E0E7FF' }}
                            onMouseLeave={e => { e.currentTarget.style.background='#EEF2FF' }}>
                            <Edit2 size={11} /> 수정
                          </button>
                          <button onClick={() => setDeleteTarget(s)} style={{ display:'flex', alignItems:'center', gap:'4px', padding:'5px 10px', borderRadius:'8px', fontSize:'11px', fontWeight:700, background:'#FEF2F2', color:'#EF4444', border:'1px solid #FECACA', cursor:'pointer' }}
                            onMouseEnter={e => { e.currentTarget.style.background='#FEE2E2' }}
                            onMouseLeave={e => { e.currentTarget.style.background='#FEF2F2' }}>
                            <Trash2 size={11} /> 삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <StudentModal student={editingStudent} onSave={handleSave} onClose={closeModal} loading={loading} />
      )}
      {deleteTarget && (
        <DeleteDialog student={deleteTarget} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} loading={loading} />
      )}
    </Layout>
  )
}

// ── 등록/수정 모달 ──────────────────────────────────────
function StudentModal({ student, onSave, onClose, loading }) {
  const isEdit = !!student
  const [form, setForm] = useState({
    name:          student?.name          || '',
    grade:         student?.grade         || '',
    school:        student?.school        || '',
    seat_number:   student?.seat_number   || '',
    parent_name:   student?.parent_name   || '',
    parent_phone:  student?.parent_phone  || '',
    student_phone: student?.student_phone || '',
    status:        student?.status        || '재원생',  // ✅ 추가
    special_notes: student?.special_notes || '',        // ✅ 추가
    memo:          student?.memo          || '',
  })
  const [errors, setErrors] = useState({})

  const set = (key, value) => {
    setForm(f => ({ ...f, [key]: value }))
    if (errors[key]) setErrors(e => ({ ...e, [key]: '' }))
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = '이름을 입력해주세요'
    if (!form.grade)        e.grade = '학년을 선택해주세요'
    if (form.seat_number !== '' && isNaN(Number(form.seat_number)))
      e.seat_number = '숫자만 입력해주세요'
    return e
  }

  const handleSubmit = () => {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }
    onSave({ ...form, seat_number: form.seat_number !== '' ? Number(form.seat_number) : null })
  }

  const inputStyle = (hasError) => ({
    width:'100%', padding:'9px 12px', borderRadius:'10px',
    border:`1.5px solid ${hasError ? '#FCA5A5' : '#E2E8F0'}`,
    background: hasError ? '#FEF2F2' : '#F8FAFC',
    fontSize:'13px', outline:'none', color:'#0F172A', boxSizing:'border-box',
  })

  const focusStyle = { borderColor:'#6366F1', boxShadow:'0 0 0 3px rgba(99,102,241,0.1)' }
  const blurStyle  = (err) => ({ borderColor: err ? '#FCA5A5' : '#E2E8F0', boxShadow:'none' })

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:'16px' }}>
      <div style={{ background:'#fff', borderRadius:'24px', width:'100%', maxWidth:'540px', maxHeight:'92vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.15)' }}>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'20px 24px 16px', borderBottom:'1px solid #F1F5F9' }}>
          <h2 style={{ fontSize:'17px', fontWeight:700, color:'#0F172A', margin:0 }}>
            {isEdit ? '학생 정보 수정' : '새 학생 등록'}
          </h2>
          <button onClick={onClose} style={{ width:'32px', height:'32px', borderRadius:'10px', border:'none', background:'#F1F5F9', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <X size={16} style={{ color:'#64748B' }} />
          </button>
        </div>

        <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:'14px' }}>
          {/* 이름 + 학년 */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            <Field label="이름" required error={errors.name}>
              <input type="text" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="홍길동"
                style={inputStyle(!!errors.name)}
                onFocus={e=>Object.assign(e.target.style,focusStyle)}
                onBlur={e=>Object.assign(e.target.style,blurStyle(errors.name))} />
            </Field>
            <Field label="학년" required error={errors.grade}>
              <select value={form.grade} onChange={e=>set('grade',e.target.value)}
                style={{ ...inputStyle(!!errors.grade), appearance:'none', cursor:'pointer' }}
                onFocus={e=>Object.assign(e.target.style,focusStyle)}
                onBlur={e=>Object.assign(e.target.style,blurStyle(errors.grade))}>
                <option value="">학년 선택</option>
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
          </div>

          {/* ✅ 재원 상태 */}
          <Field label="재원 상태">
            <div style={{ display:'flex', gap:'8px' }}>
              {STATUS_OPTIONS.map(st => {
                const sty = STATUS_STYLE[st]
                const isActive = form.status === st
                return (
                  <button key={st} type="button" onClick={() => set('status', st)}
                    style={{
                      flex:1, padding:'8px', borderRadius:'10px', fontSize:'13px', fontWeight:600,
                      cursor:'pointer', transition:'all 0.15s',
                      border: isActive ? `2px solid ${sty.border}` : '2px solid #E2E8F0',
                      background: isActive ? sty.bg : '#F8FAFC',
                      color: isActive ? sty.color : '#94A3B8',
                    }}>
                    {st}
                  </button>
                )
              })}
            </div>
          </Field>

          {/* 학교 + 좌석 */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            <Field label="학교">
              <input type="text" value={form.school} onChange={e=>set('school',e.target.value)} placeholder="한빛고등학교"
                style={inputStyle(false)}
                onFocus={e=>Object.assign(e.target.style,focusStyle)}
                onBlur={e=>Object.assign(e.target.style,blurStyle(false))} />
            </Field>
            <Field label="좌석번호" error={errors.seat_number}>
              <input type="number" min="1" value={form.seat_number} onChange={e=>set('seat_number',e.target.value)} placeholder="예: 5"
                style={inputStyle(!!errors.seat_number)}
                onFocus={e=>Object.assign(e.target.style,focusStyle)}
                onBlur={e=>Object.assign(e.target.style,blurStyle(errors.seat_number))} />
            </Field>
          </div>

          {/* 학부모 정보 */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            <Field label="학부모 이름">
              <input type="text" value={form.parent_name} onChange={e=>set('parent_name',e.target.value)} placeholder="홍부모"
                style={inputStyle(false)}
                onFocus={e=>Object.assign(e.target.style,focusStyle)}
                onBlur={e=>Object.assign(e.target.style,blurStyle(false))} />
            </Field>
            <Field label="학부모 전화">
              <input type="tel" value={form.parent_phone} onChange={e=>set('parent_phone',e.target.value)} placeholder="010-0000-0000"
                style={inputStyle(false)}
                onFocus={e=>Object.assign(e.target.style,focusStyle)}
                onBlur={e=>Object.assign(e.target.style,blurStyle(false))} />
            </Field>
          </div>

          <Field label="학생 전화">
            <input type="tel" value={form.student_phone} onChange={e=>set('student_phone',e.target.value)} placeholder="010-0000-0000"
              style={inputStyle(false)}
              onFocus={e=>Object.assign(e.target.style,focusStyle)}
              onBlur={e=>Object.assign(e.target.style,blurStyle(false))} />
          </Field>

          {/* ✅ 특이사항 */}
          <Field label="⚠️ 특이사항 (등원기록에 표시됨)">
            <textarea value={form.special_notes} onChange={e=>set('special_notes',e.target.value)}
              placeholder="알레르기, 건강 주의사항, 보호자 요청사항 등"
              rows={3}
              style={{ ...inputStyle(false), resize:'none', fontFamily:'inherit', border:'1.5px solid #FDE68A', background:'#FFFBEB' }}
              onFocus={e=>{ e.target.style.borderColor='#F59E0B'; e.target.style.boxShadow='0 0 0 3px rgba(245,158,11,0.1)' }}
              onBlur={e=>{ e.target.style.borderColor='#FDE68A'; e.target.style.boxShadow='none' }} />
          </Field>

          <Field label="메모 (내부용)">
            <textarea value={form.memo} onChange={e=>set('memo',e.target.value)} placeholder="관리 참고사항을 입력하세요" rows={2}
              style={{ ...inputStyle(false), resize:'none', fontFamily:'inherit' }}
              onFocus={e=>Object.assign(e.target.style,focusStyle)}
              onBlur={e=>Object.assign(e.target.style,blurStyle(false))} />
          </Field>
        </div>

        <div style={{ display:'flex', gap:'10px', padding:'16px 24px', borderTop:'1px solid #F1F5F9' }}>
          <button onClick={onClose} style={{ flex:1, padding:'12px', borderRadius:'12px', border:'1.5px solid #E2E8F0', background:'#fff', fontSize:'14px', fontWeight:600, color:'#64748B', cursor:'pointer' }}>
            취소
          </button>
          <button onClick={handleSubmit} disabled={loading} style={{
            flex:1, padding:'12px', borderRadius:'12px', border:'none',
            background: loading ? '#A5B4FC' : 'linear-gradient(135deg,#6366F1,#7C3AED)',
            fontSize:'14px', fontWeight:700, color:'#fff', cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 4px 14px rgba(99,102,241,0.35)',
          }}>
            {loading ? '처리 중…' : isEdit ? '수정 완료' : '등록하기'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DeleteDialog({ student, onConfirm, onClose, loading }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:'16px' }}>
      <div style={{ background:'#fff', borderRadius:'24px', width:'100%', maxWidth:'360px', padding:'28px 24px', boxShadow:'0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ textAlign:'center', marginBottom:'24px' }}>
          <div style={{ width:'52px', height:'52px', borderRadius:'16px', background:'#FEF2F2', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
            <AlertTriangle size={24} style={{ color:'#EF4444' }} />
          </div>
          <h3 style={{ fontSize:'16px', fontWeight:700, color:'#0F172A', marginBottom:'8px' }}>학생을 삭제할까요?</h3>
          <p style={{ fontSize:'13px', color:'#64748B', lineHeight:1.6 }}>
            <strong style={{ color:'#0F172A' }}>{student.name}</strong> 학생의 모든 정보가<br />영구적으로 삭제됩니다.
          </p>
        </div>
        <div style={{ display:'flex', gap:'10px' }}>
          <button onClick={onClose} style={{ flex:1, padding:'12px', borderRadius:'12px', border:'1.5px solid #E2E8F0', background:'#fff', fontSize:'14px', fontWeight:600, color:'#64748B', cursor:'pointer' }}>취소</button>
          <button onClick={onConfirm} disabled={loading} style={{ flex:1, padding:'12px', borderRadius:'12px', border:'none', background: loading ? '#FCA5A5' : '#EF4444', fontSize:'14px', fontWeight:700, color:'#fff', cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? '삭제 중…' : '삭제하기'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, required, error, children }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:'12px', fontWeight:700, color:'#374151', marginBottom:'6px' }}>
        {label}{required && <span style={{ color:'#EF4444', marginLeft:'2px' }}>*</span>}
      </label>
      {children}
      {error && <p style={{ fontSize:'11px', color:'#EF4444', marginTop:'4px' }}>{error}</p>}
    </div>
  )
}

function Toast({ msg, type }) {
  return (
    <div style={{
      position:'fixed', top:'20px', right:'20px', zIndex:100,
      display:'flex', alignItems:'center', gap:'10px',
      padding:'12px 18px', borderRadius:'14px',
      background: type==='success' ? '#10B981' : '#EF4444',
      color:'#fff', fontSize:'13px', fontWeight:600,
      boxShadow:'0 8px 24px rgba(0,0,0,0.12)',
    }}>
      <CheckCircle size={15} /> {msg}
    </div>
  )
}
