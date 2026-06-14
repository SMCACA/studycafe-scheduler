import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import Layout from '../components/Layout'
import { UserCheck, Plus, Edit2, Trash2, X, CheckCircle, AlertTriangle } from 'lucide-react'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// 요일 정의 (월~일 순서)
const DAYS = [
  { key:1, label:'월' }, { key:2, label:'화' }, { key:3, label:'수' },
  { key:4, label:'목' }, { key:5, label:'금' }, { key:6, label:'토' }, { key:0, label:'일' },
]

// 타임테이블 시간대 (9시~22시)
const HOURS = Array.from({ length: 14 }, (_, i) => i + 9)   // [9,10,...,22]

// 직원 색상 팔레트
const COLORS = ['#6366F1','#059669','#D97706','#EF4444','#8B5CF6','#0EA5E9','#EC4899','#14B8A6']

export default function StaffManagement() {
  const [staffList,   setStaffList]   = useState([])
  const [schedules,   setSchedules]   = useState([])  // 직원 근무 스케줄
  const [loading,     setLoading]     = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingStaff,setEditingStaff]= useState(null)
  const [deleteTarget,setDeleteTarget]= useState(null)
  const [toast,       setToast]       = useState(null)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data: staffData }, { data: schedData }] = await Promise.all([
      supabase.from('staff').select('*').order('created_at'),
      supabase.from('staff_schedules').select('*'),
    ])
    if (staffData) setStaffList(staffData)
    if (schedData) setSchedules(schedData)
    setLoading(false)
  }

  const showToast = (msg, type='success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  const handleSave = async ({ staff, staffSchedules }) => {
    setLoading(true)
    try {
      let staffId
      if (editingStaff) {
        const { error } = await supabase.from('staff').update({
          name: staff.name, role: staff.role, color: staff.color,
        }).eq('id', editingStaff.id)
        if (error) throw error
        staffId = editingStaff.id
        // 기존 스케줄 삭제 후 재등록
        await supabase.from('staff_schedules').delete().eq('staff_id', staffId)
      } else {
        const { data, error } = await supabase.from('staff').insert({
          name: staff.name, role: staff.role, color: staff.color,
        }).select().single()
        if (error) throw error
        staffId = data.id
      }

      // 스케줄 일괄 등록
      if (staffSchedules.length > 0) {
        const { error } = await supabase.from('staff_schedules').insert(
          staffSchedules.map(s => ({ ...s, staff_id: staffId }))
        )
        if (error) throw error
      }

      showToast(editingStaff ? `${staff.name} 직원 정보 수정 완료 ✏️` : `${staff.name} 직원 등록 완료 🎉`)
      setIsModalOpen(false); setEditingStaff(null); fetchAll()
    } catch (err) { showToast(`저장 실패: ${err.message}`, 'error') }
    finally { setLoading(false) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setLoading(true)
    try {
      const { error } = await supabase.from('staff').delete().eq('id', deleteTarget.id)
      if (error) throw error
      showToast(`${deleteTarget.name} 직원이 삭제됐어요 🗑️`, 'error')
      setDeleteTarget(null); fetchAll()
    } catch (err) { showToast(`삭제 실패: ${err.message}`, 'error') }
    finally { setLoading(false) }
  }

  const openEdit = (staff) => { setEditingStaff(staff); setIsModalOpen(true) }

  // 타임테이블: 특정 요일 + 시간에 어느 직원이 근무하는지 계산
  const getCellStaff = (dayKey, hour) => {
    return staffList.filter(staff => {
      return schedules.some(sch => {
        if (sch.staff_id !== staff.id) return false
        if (sch.day_of_week !== dayKey) return false
        const start = parseInt(sch.start_time.split(':')[0])
        const end   = parseInt(sch.end_time.split(':')[0])
        return hour >= start && hour < end
      })
    })
  }

  return (
    <Layout>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      <div style={{ padding:'28px 32px' }}>

        {/* 헤더 */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'24px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
            <div style={{ width:'46px', height:'46px', borderRadius:'14px', background:'#F0FDF4', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <UserCheck size={22} style={{ color:'#059669' }} />
            </div>
            <div>
              <h1 style={{ fontSize:'22px', fontWeight:700, color:'#0F172A', margin:0 }}>직원 근무표</h1>
              <p style={{ fontSize:'13px', color:'#94A3B8', marginTop:'3px' }}>총 {staffList.length}명 등록됨</p>
            </div>
          </div>
          <button
            onClick={() => { setEditingStaff(null); setIsModalOpen(true) }}
            style={{
              display:'flex', alignItems:'center', gap:'8px', padding:'11px 20px',
              borderRadius:'12px', border:'none',
              background:'linear-gradient(135deg,#6366F1,#7C3AED)',
              color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer',
              boxShadow:'0 4px 12px rgba(99,102,241,0.3)',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform='translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)' }}
          >
            <Plus size={16} /> 직원 등록
          </button>
        </div>

        {/* 직원 목록 */}
        {staffList.length > 0 && (
          <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'24px' }}>
            {staffList.map(staff => (
              <div key={staff.id} style={{
                display:'flex', alignItems:'center', gap:'10px',
                padding:'10px 16px', borderRadius:'14px',
                background:'#fff', border:'1.5px solid #E2E8F0',
                boxShadow:'0 1px 4px rgba(0,0,0,0.04)',
              }}>
                <div style={{
                  width:'32px', height:'32px', borderRadius:'10px',
                  background: staff.color || '#6366F1',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  color:'#fff', fontSize:'13px', fontWeight:700, flexShrink:0,
                }}>
                  {staff.name.charAt(0)}
                </div>
                <div>
                  <p style={{ fontSize:'14px', fontWeight:700, color:'#0F172A', margin:0 }}>{staff.name}</p>
                  <p style={{ fontSize:'11px', color:'#94A3B8', margin:0 }}>{staff.role || '직원'}</p>
                </div>
                <div style={{ display:'flex', gap:'4px', marginLeft:'4px' }}>
                  <button onClick={() => openEdit(staff)} style={{ width:'28px', height:'28px', borderRadius:'8px', border:'1px solid #E2E8F0', background:'#F8FAFC', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <Edit2 size={12} style={{ color:'#6366F1' }} />
                  </button>
                  <button onClick={() => setDeleteTarget(staff)} style={{ width:'28px', height:'28px', borderRadius:'8px', border:'1px solid #E2E8F0', background:'#F8FAFC', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <Trash2 size={12} style={{ color:'#EF4444' }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 타임테이블 */}
        {loading ? (
          <div style={{ textAlign:'center', padding:'80px 0', color:'#94A3B8' }}>불러오는 중...</div>
        ) : staffList.length === 0 ? (
          <div style={{ textAlign:'center', padding:'80px 0', background:'#fff', borderRadius:'16px', border:'1px solid #E2E8F0' }}>
            <p style={{ fontSize:'40px', marginBottom:'12px' }}>👋</p>
            <p style={{ color:'#64748B', fontWeight:600, fontSize:'15px' }}>등록된 직원이 없어요</p>
            <p style={{ fontSize:'13px', color:'#94A3B8', marginTop:'4px' }}>직원 등록 버튼을 눌러 추가해보세요</p>
          </div>
        ) : (
          <div style={{ background:'#fff', borderRadius:'16px', border:'1px solid #E2E8F0', overflowX:'auto', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px', minWidth:'700px' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width:'70px' }}>시간</th>
                  {DAYS.map(d => (
                    <th key={d.key} style={{
                      ...thStyle,
                      color: d.key===0 ? '#EF4444' : d.key===6 ? '#D97706' : '#64748B',
                    }}>{d.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HOURS.map(hour => (
                  <tr key={hour}>
                    <td style={{ border:'1px solid #E2E8F0', padding:'8px 12px', textAlign:'center', fontSize:'12px', fontWeight:600, color:'#94A3B8', background:'#F8FAFC', whiteSpace:'nowrap' }}>
                      {hour}:00
                    </td>
                    {DAYS.map(d => {
                      const workingStaff = getCellStaff(d.key, hour)
                      return (
                        <td key={d.key} style={{ border:'1px solid #E2E8F0', padding:'4px', verticalAlign:'top', minHeight:'40px', background: workingStaff.length > 0 ? 'transparent' : '#FAFBFF' }}>
                          {workingStaff.map(staff => (
                            <div key={staff.id} style={{
                              padding:'4px 8px', borderRadius:'6px', marginBottom:'2px',
                              background: staff.color ? `${staff.color}20` : '#EEF2FF',
                              border: `1px solid ${staff.color ? `${staff.color}40` : '#C7D2FE'}`,
                              fontSize:'11px', fontWeight:700,
                              color: staff.color || '#6366F1',
                              whiteSpace:'nowrap',
                            }}>
                              {staff.name}
                            </div>
                          ))}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <StaffModal
          staff={editingStaff}
          existingSchedules={editingStaff ? schedules.filter(s => s.staff_id === editingStaff.id) : []}
          onSave={handleSave}
          onClose={() => { setIsModalOpen(false); setEditingStaff(null) }}
          loading={loading}
        />
      )}
      {deleteTarget && (
        <DeleteDialog
          staff={deleteTarget}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
          loading={loading}
        />
      )}
    </Layout>
  )
}

const thStyle = {
  border:'1px solid #E2E8F0', padding:'12px 14px', background:'#F8FAFC',
  fontSize:'12px', fontWeight:700, textAlign:'center', letterSpacing:'0.04em',
}

// ── 직원 등록/수정 모달 ──────────────────────────────────
function StaffModal({ staff, existingSchedules, onSave, onClose, loading }) {
  const isEdit = !!staff
  const [name,  setName]  = useState(staff?.name  || '')
  const [role,  setRole]  = useState(staff?.role  || '직원')
  const [color, setColor] = useState(staff?.color || COLORS[0])

  // 요일별 근무시간 상태: { [dayKey]: { enabled, start, end } }
  const initDaySchedules = () => {
    const init = {}
    DAYS.forEach(d => {
      const existing = existingSchedules.find(s => s.day_of_week === d.key)
      init[d.key] = {
        enabled: !!existing,
        start:   existing?.start_time || '09:00',
        end:     existing?.end_time   || '18:00',
      }
    })
    return init
  }
  const [daySchedules, setDaySchedules] = useState(initDaySchedules)

  const toggleDay = (key) => setDaySchedules(prev => ({
    ...prev, [key]: { ...prev[key], enabled: !prev[key].enabled }
  }))
  const setTime = (key, field, val) => setDaySchedules(prev => ({
    ...prev, [key]: { ...prev[key], [field]: val }
  }))

  const handleSubmit = () => {
    if (!name.trim()) { alert('이름을 입력해주세요'); return }
    const staffSchedules = Object.entries(daySchedules)
      .filter(([, v]) => v.enabled)
      .map(([key, v]) => ({
        day_of_week: parseInt(key),
        start_time:  v.start,
        end_time:    v.end,
      }))
    onSave({ staff: { name, role, color }, staffSchedules })
  }

  const inputSt = {
    width:'100%', padding:'9px 12px', borderRadius:'10px',
    border:'1.5px solid #E2E8F0', background:'#F8FAFC',
    fontSize:'13px', outline:'none', color:'#0F172A', boxSizing:'border-box',
  }
  const focusSt = { borderColor:'#6366F1', boxShadow:'0 0 0 3px rgba(99,102,241,0.1)' }
  const blurSt  = { borderColor:'#E2E8F0', boxShadow:'none' }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:'16px' }}>
      <div style={{ background:'#fff', borderRadius:'24px', width:'100%', maxWidth:'520px', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.15)' }}>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'20px 24px 16px', borderBottom:'1px solid #F1F5F9' }}>
          <h2 style={{ fontSize:'17px', fontWeight:700, color:'#0F172A', margin:0 }}>
            {isEdit ? '직원 정보 수정' : '새 직원 등록'}
          </h2>
          <button onClick={onClose} style={{ width:'32px', height:'32px', borderRadius:'10px', border:'none', background:'#F1F5F9', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <X size={16} style={{ color:'#64748B' }} />
          </button>
        </div>

        <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:'16px' }}>
          {/* 이름 + 직책 */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            <div>
              <label style={{ display:'block', fontSize:'12px', fontWeight:700, color:'#374151', marginBottom:'6px' }}>이름 *</label>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="홍길동" style={inputSt}
                onFocus={e=>Object.assign(e.target.style,focusSt)}
                onBlur={e=>Object.assign(e.target.style,blurSt)} />
            </div>
            <div>
              <label style={{ display:'block', fontSize:'12px', fontWeight:700, color:'#374151', marginBottom:'6px' }}>직책</label>
              <input value={role} onChange={e=>setRole(e.target.value)} placeholder="원장, 강사, 직원 등" style={inputSt}
                onFocus={e=>Object.assign(e.target.style,focusSt)}
                onBlur={e=>Object.assign(e.target.style,blurSt)} />
            </div>
          </div>

          {/* 색상 선택 */}
          <div>
            <label style={{ display:'block', fontSize:'12px', fontWeight:700, color:'#374151', marginBottom:'8px' }}>타임테이블 색상</label>
            <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  style={{
                    width:'32px', height:'32px', borderRadius:'10px', border:'none', cursor:'pointer',
                    background:c, outline: color===c ? `3px solid ${c}` : 'none',
                    outlineOffset:'2px', transition:'all 0.15s',
                    boxShadow: color===c ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : 'none',
                  }} />
              ))}
            </div>
          </div>

          {/* 요일별 근무시간 */}
          <div>
            <label style={{ display:'block', fontSize:'12px', fontWeight:700, color:'#374151', marginBottom:'10px' }}>근무 요일 및 시간</label>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {DAYS.map(d => {
                const ds = daySchedules[d.key]
                const isWeekend = d.key === 0 || d.key === 6
                return (
                  <div key={d.key} style={{
                    display:'flex', alignItems:'center', gap:'10px',
                    padding:'10px 12px', borderRadius:'12px',
                    background: ds.enabled ? '#F8FAFF' : '#F8FAFC',
                    border: ds.enabled ? '1.5px solid #C7D2FE' : '1.5px solid #E2E8F0',
                  }}>
                    {/* 요일 체크박스 */}
                    <input type="checkbox" checked={ds.enabled} onChange={() => toggleDay(d.key)}
                      style={{ width:'16px', height:'16px', cursor:'pointer', accentColor:'#6366F1' }} />
                    <span style={{
                      width:'28px', fontSize:'13px', fontWeight:700,
                      color: d.key===0 ? '#EF4444' : isWeekend ? '#D97706' : '#374151',
                    }}>{d.label}</span>

                    {ds.enabled ? (
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', flex:1 }}>
                        <input type="time" value={ds.start} onChange={e=>setTime(d.key,'start',e.target.value)}
                          style={{ ...inputSt, width:'auto', padding:'5px 8px', fontSize:'12px' }} />
                        <span style={{ color:'#94A3B8', fontSize:'12px', flexShrink:0 }}>~</span>
                        <input type="time" value={ds.end} onChange={e=>setTime(d.key,'end',e.target.value)}
                          style={{ ...inputSt, width:'auto', padding:'5px 8px', fontSize:'12px' }} />
                      </div>
                    ) : (
                      <span style={{ fontSize:'12px', color:'#CBD5E1' }}>휴무</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div style={{ display:'flex', gap:'10px', padding:'16px 24px', borderTop:'1px solid #F1F5F9' }}>
          <button onClick={onClose} style={{ flex:1, padding:'12px', borderRadius:'12px', border:'1.5px solid #E2E8F0', background:'#fff', fontSize:'14px', fontWeight:600, color:'#64748B', cursor:'pointer' }}>취소</button>
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

function DeleteDialog({ staff, onConfirm, onClose, loading }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50 }}>
      <div style={{ background:'#fff', borderRadius:'24px', width:'360px', padding:'28px 24px', boxShadow:'0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ textAlign:'center', marginBottom:'24px' }}>
          <div style={{ width:'52px', height:'52px', borderRadius:'16px', background:'#FEF2F2', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
            <AlertTriangle size={24} style={{ color:'#EF4444' }} />
          </div>
          <h3 style={{ fontSize:'16px', fontWeight:700, color:'#0F172A', marginBottom:'8px' }}>직원을 삭제할까요?</h3>
          <p style={{ fontSize:'13px', color:'#64748B', lineHeight:1.6 }}>
            <strong style={{ color:'#0F172A' }}>{staff.name}</strong> 직원의 근무 스케줄이<br />모두 삭제됩니다.
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

function Toast({ msg, type }) {
  return (
    <div style={{
      position:'fixed', top:'20px', right:'20px', zIndex:100,
      display:'flex', alignItems:'center', gap:'10px', padding:'12px 18px',
      borderRadius:'14px', background: type==='success' ? '#10B981' : '#EF4444',
      color:'#fff', fontSize:'13px', fontWeight:600, boxShadow:'0 8px 24px rgba(0,0,0,0.12)',
    }}>
      <CheckCircle size={15} /> {msg}
    </div>
  )
}
