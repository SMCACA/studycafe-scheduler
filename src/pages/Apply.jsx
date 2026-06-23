import { useState } from 'react'

const GRADES = ['중1','중2','중3','고1','고2','고3','성인']

// ✅ SMC 재원생 구분 — "현재 다니고 있는지 아닌지"만 판단하면 됨
const ACADEMY_OPTIONS = [
  { value: true,  label: '예, 현재 SMC학원에 재원 중이에요' },
  { value: false, label: '아니요, 재원 중이 아니에요' },
]

export default function Apply() {
  const [form, setForm] = useState({
    name: '',
    grade: '',
    is_academy_student: null, // 아직 선택 안 한 상태를 구분하려고 null로 시작
    school: '',
    parent_phone: '',
    student_phone: '',
    desired_start_date: '',
    desired_schedule_text: '',
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false) // 제출 완료 화면 표시 여부

  const set = (key, value) => {
    setForm(f => ({ ...f, [key]: value }))
    if (errors[key]) setErrors(e => ({ ...e, [key]: '' }))
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = '이름을 입력해주세요'
    if (!form.grade) e.grade = '학년을 선택해주세요'
    if (form.is_academy_student === null) e.is_academy_student = '재원 여부를 선택해주세요'
    if (!form.parent_phone.trim() && !form.student_phone.trim())
      e.parent_phone = '학부모 또는 학생 연락처 중 하나는 꼭 입력해주세요'
    return e
  }

  const handleSubmit = async () => {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }

    setSubmitting(true)
    try {
      // ⚠️ 3단계에서 만들 API 주소예요. 지금은 파일이 없어서 에러가 날 수 있어요 (정상이에요!)
      const res = await fetch('/api/submit-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('제출에 실패했어요')
      setSubmitted(true)
    } catch (err) {
      alert(`제출 중 문제가 발생했어요: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle = (hasError) => ({
    width:'100%', padding:'12px 14px', borderRadius:'10px',
    border:`1.5px solid ${hasError ? '#FCA5A5' : '#E2E8F0'}`,
    background: hasError ? '#FEF2F2' : '#F8FAFC',
    fontSize:'15px', outline:'none', color:'#0F172A', boxSizing:'border-box',
  })

  // ✅ 제출 완료 화면 — 신청자가 보는 마지막 화면
  if (submitted) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#F8FAFC', padding:'24px' }}>
        <div style={{ background:'#fff', borderRadius:'20px', padding:'40px 28px', textAlign:'center', maxWidth:'400px', boxShadow:'0 8px 24px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize:'40px', marginBottom:'12px' }}>✅</div>
          <h2 style={{ fontSize:'18px', fontWeight:700, color:'#0F172A', marginBottom:'8px' }}>신청이 완료됐어요</h2>
          <p style={{ fontSize:'14px', color:'#64748B', lineHeight:1.6 }}>
            확인 후 등록 절차를 안내드릴게요.<br />감사합니다!
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight:'100vh', background:'#F8FAFC', padding:'24px 16px' }}>
      <div style={{ maxWidth:'480px', margin:'0 auto', background:'#fff', borderRadius:'20px', boxShadow:'0 8px 24px rgba(0,0,0,0.06)', overflow:'hidden' }}>

        <div style={{ padding:'28px 24px 16px', borderBottom:'1px solid #F1F5F9' }}>
          <h1 style={{ fontSize:'19px', fontWeight:700, color:'#0F172A', margin:0 }}>SMC 스터디카페 입학/등록 신청서</h1>
          <p style={{ fontSize:'13px', color:'#94A3B8', marginTop:'6px' }}>아래 정보를 입력해주시면 확인 후 연락드릴게요.</p>
        </div>

        <div style={{ padding:'24px', display:'flex', flexDirection:'column', gap:'18px' }}>

          {/* 이름 */}
          <Field label="학생 이름" required error={errors.name}>
            <input type="text" value={form.name} onChange={e=>set('name', e.target.value)}
              placeholder="홍길동" style={inputStyle(!!errors.name)} />
          </Field>

          {/* 학년 */}
          <Field label="학년" required error={errors.grade}>
            <select value={form.grade} onChange={e=>set('grade', e.target.value)}
              style={{ ...inputStyle(!!errors.grade), appearance:'none' }}>
              <option value="">학년 선택</option>
              {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </Field>

          {/* SMC 재원 여부 */}
          <Field label="현재 SMC학원에 재원 중이신가요?" required error={errors.is_academy_student}>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {ACADEMY_OPTIONS.map(opt => {
                const isActive = form.is_academy_student === opt.value
                return (
                  <button key={String(opt.value)} type="button" onClick={() => set('is_academy_student', opt.value)}
                    style={{
                      padding:'12px 14px', borderRadius:'10px', fontSize:'14px', fontWeight:600,
                      textAlign:'left', cursor:'pointer',
                      border: isActive ? '2px solid #6366F1' : '1.5px solid #E2E8F0',
                      background: isActive ? '#EEF2FF' : '#F8FAFC',
                      color: isActive ? '#4F46E5' : '#475569',
                    }}>
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </Field>

          {/* 학교 */}
          <Field label="재학 중인 학교">
            <input type="text" value={form.school} onChange={e=>set('school', e.target.value)}
              placeholder="한빛고등학교" style={inputStyle(false)} />
          </Field>

          {/* 학부모 전화 */}
          <Field label="학부모 연락처" error={errors.parent_phone}>
            <input type="tel" value={form.parent_phone} onChange={e=>set('parent_phone', e.target.value)}
              placeholder="010-0000-0000" style={inputStyle(!!errors.parent_phone)} />
          </Field>

          {/* 학생 전화 */}
          <Field label="학생 본인 연락처">
            <input type="tel" value={form.student_phone} onChange={e=>set('student_phone', e.target.value)}
              placeholder="010-0000-0000" style={inputStyle(false)} />
          </Field>

          {/* 희망 첫등원일 */}
          <Field label="희망 시작일">
            <input type="date" value={form.desired_start_date} onChange={e=>set('desired_start_date', e.target.value)}
              style={inputStyle(false)} />
          </Field>

          {/* 희망 스케줄 (참고용) */}
          <Field label="희망 요일/시간대 (참고용, 자유롭게 적어주세요)">
            <textarea value={form.desired_schedule_text} onChange={e=>set('desired_schedule_text', e.target.value)}
              placeholder="예: 평일 저녁 7시~10시, 주말은 오후 시간대 희망"
              rows={3} style={{ ...inputStyle(false), resize:'none', fontFamily:'inherit' }} />
          </Field>

        </div>

        <div style={{ padding:'0 24px 28px' }}>
          <button onClick={handleSubmit} disabled={submitting}
            style={{
              width:'100%', padding:'14px', borderRadius:'12px', border:'none',
              background: submitting ? '#A5B4FC' : 'linear-gradient(135deg,#6366F1,#7C3AED)',
              color:'#fff', fontSize:'15px', fontWeight:700, cursor: submitting ? 'not-allowed' : 'pointer',
            }}>
            {submitting ? '제출 중…' : '신청서 제출하기'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, required, error, children }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:'13px', fontWeight:700, color:'#374151', marginBottom:'7px' }}>
        {label}{required && <span style={{ color:'#EF4444', marginLeft:'2px' }}>*</span>}
      </label>
      {children}
      {error && <p style={{ fontSize:'12px', color:'#EF4444', marginTop:'5px' }}>{error}</p>}
    </div>
  )
}