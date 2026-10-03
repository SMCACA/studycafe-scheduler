// ================================================================
// 📁 src/pages/Apply.jsx  (공개 신청서 — 로그인 없이 누구나 작성)
// ================================================================
// [변경] 이용권(평일권/주말권/풀타임권) 선택 + 요일별 교시 선택 추가
//   - 교시 수와 시간은 "스케줄 관리"에서 설정한 값을 서버에서 받아와 보여줘요.
//     (스케줄 관리에서 교시/시간을 바꾸면 신청서에도 자동으로 반영돼요)
//   - 저장 모양이 스케줄 관리와 똑같아서, 나중에 학생으로 전환할 때 그대로 옮겨져요.
// ================================================================

import { useState, useEffect } from 'react'
import SlotPicker from '../components/SlotPicker'
import {
  MEMBERSHIP_OPTIONS, DEFAULT_SLOT_CONFIG, emptySlots, cleanSlots, countSlots,
} from '../lib/applySchedule'

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
    membership_type: '',      // '평일' | '주말' | '풀'
    desired_slots: emptySlots(),
    desired_start_date: '',
    desired_schedule_text: '',
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false) // 제출 완료 화면 표시 여부

  // 교시 설정 (서버에서 받아옴, 실패하면 기본값)
  const [slotConfig, setSlotConfig] = useState(DEFAULT_SLOT_CONFIG)
  const [timeConfig, setTimeConfig] = useState(null)

  useEffect(() => {
    fetch('/api/submit-application?mode=config')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(cfg => {
        if (cfg.slotConfig) setSlotConfig(cfg.slotConfig)
        if (cfg.timeConfig) setTimeConfig(cfg.timeConfig)
      })
      .catch(() => { /* 기본값으로 진행 */ })
  }, [])

  const set = (key, value) => {
    setForm(f => ({ ...f, [key]: value }))
    if (errors[key]) setErrors(e => ({ ...e, [key]: '' }))
  }

  // 이용권을 바꾸면, 새 이용권으로 못 오는 요일의 선택은 자동으로 지워요
  const setMembership = (value) => {
    setForm(f => ({
      ...f,
      membership_type: value,
      desired_slots: cleanSlots(f.desired_slots, value, slotConfig),
    }))
    setErrors(e => ({ ...e, membership_type: '', desired_slots: '' }))
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = '이름을 입력해주세요'
    if (!form.grade) e.grade = '학년을 선택해주세요'
    if (form.is_academy_student === null) e.is_academy_student = '재원 여부를 선택해주세요'
    if (!form.parent_phone.trim() && !form.student_phone.trim())
      e.parent_phone = '학부모 또는 학생 연락처 중 하나는 꼭 입력해주세요'
    if (!form.membership_type) e.membership_type = '이용권을 선택해주세요'
    else if (countSlots(cleanSlots(form.desired_slots, form.membership_type, slotConfig)) === 0)
      e.desired_slots = '오는 요일과 교시를 최소 1개 이상 선택해주세요'
    return e
  }

  const handleSubmit = async () => {
    const e = validate()
    if (Object.keys(e).length > 0) {
      setErrors(e)
      // 첫 번째 오류 칸으로 화면 이동
      const firstKey = Object.keys(e)[0]
      document.getElementById(`field-${firstKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/submit-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          desired_slots: cleanSlots(form.desired_slots, form.membership_type, slotConfig),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || '제출에 실패했어요')
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
      <div style={{ maxWidth:'520px', margin:'0 auto', background:'#fff', borderRadius:'20px', boxShadow:'0 8px 24px rgba(0,0,0,0.06)', overflow:'hidden' }}>

        <div style={{ padding:'28px 24px 16px', borderBottom:'1px solid #F1F5F9' }}>
          <h1 style={{ fontSize:'19px', fontWeight:700, color:'#0F172A', margin:0 }}>SMC 스터디카페 입학/등록 신청서</h1>
          <p style={{ fontSize:'13px', color:'#94A3B8', marginTop:'6px' }}>아래 정보를 입력해주시면 확인 후 연락드릴게요.</p>
        </div>

        <div style={{ padding:'24px', display:'flex', flexDirection:'column', gap:'18px' }}>

          <SectionTitle n="1" text="학생 정보" />

          {/* 이름 */}
          <Field id="name" label="학생 이름" required error={errors.name}>
            <input type="text" value={form.name} onChange={e=>set('name', e.target.value)}
              placeholder="홍길동" style={inputStyle(!!errors.name)} />
          </Field>

          {/* 학년 */}
          <Field id="grade" label="학년" required error={errors.grade}>
            <select value={form.grade} onChange={e=>set('grade', e.target.value)}
              style={{ ...inputStyle(!!errors.grade), appearance:'none' }}>
              <option value="">학년 선택</option>
              {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </Field>

          {/* SMC 재원 여부 */}
          <Field id="is_academy_student" label="현재 SMC학원에 재원 중이신가요?" required error={errors.is_academy_student}>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {ACADEMY_OPTIONS.map(opt => (
                <ChoiceButton key={String(opt.value)} active={form.is_academy_student === opt.value}
                  onClick={() => set('is_academy_student', opt.value)}>
                  {opt.label}
                </ChoiceButton>
              ))}
            </div>
          </Field>

          {/* 학교 */}
          <Field id="school" label="재학 중인 학교">
            <input type="text" value={form.school} onChange={e=>set('school', e.target.value)}
              placeholder="한빛고등학교" style={inputStyle(false)} />
          </Field>

          {/* 학부모 전화 */}
          <Field id="parent_phone" label="학부모 연락처" error={errors.parent_phone}>
            <input type="tel" value={form.parent_phone} onChange={e=>set('parent_phone', e.target.value)}
              placeholder="010-0000-0000" style={inputStyle(!!errors.parent_phone)} />
          </Field>

          {/* 학생 전화 */}
          <Field id="student_phone" label="학생 본인 연락처">
            <input type="tel" value={form.student_phone} onChange={e=>set('student_phone', e.target.value)}
              placeholder="010-0000-0000" style={inputStyle(false)} />
          </Field>

          <SectionTitle n="2" text="이용권 · 스케줄" />

          {/* 이용권 */}
          <Field id="membership_type" label="이용권 구분" required error={errors.membership_type}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'8px' }}>
              {MEMBERSHIP_OPTIONS.map(opt => (
                <ChoiceButton key={opt.value} active={form.membership_type === opt.value}
                  onClick={() => setMembership(opt.value)} center>
                  <div style={{ fontSize:'15px', fontWeight:700 }}>{opt.label}</div>
                  <div style={{ fontSize:'11.5px', fontWeight:500, opacity:0.8, marginTop:'2px' }}>{opt.desc}</div>
                </ChoiceButton>
              ))}
            </div>
          </Field>

          {/* 요일별 교시 */}
          <Field id="desired_slots" label="오는 요일과 시간을 눌러서 골라주세요" required>
            <SlotPicker
              membership={form.membership_type}
              slots={form.desired_slots}
              onChange={v => set('desired_slots', v)}
              slotConfig={slotConfig}
              timeConfig={timeConfig}
              error={errors.desired_slots}
            />
          </Field>

          {/* 희망 첫등원일 */}
          <Field id="desired_start_date" label="희망 시작일">
            <input type="date" value={form.desired_start_date} onChange={e=>set('desired_start_date', e.target.value)}
              style={inputStyle(false)} />
          </Field>

          {/* 추가 요청사항 */}
          <Field id="desired_schedule_text" label="추가 요청사항 (선택)">
            <textarea value={form.desired_schedule_text} onChange={e=>set('desired_schedule_text', e.target.value)}
              placeholder="예: 학원 수업 있는 화요일은 8시 이후 도착해요"
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

function SectionTitle({ n, text }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'8px', marginTop: n === '1' ? 0 : '6px' }}>
      <span style={{ width:'22px', height:'22px', borderRadius:'50%', background:'#6366F1', color:'#fff', fontSize:'12px', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>{n}</span>
      <span style={{ fontSize:'15px', fontWeight:700, color:'#0F172A' }}>{text}</span>
    </div>
  )
}

function ChoiceButton({ active, onClick, children, center }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        padding:'12px 14px', borderRadius:'10px', fontSize:'14px', fontWeight:600,
        textAlign: center ? 'center' : 'left', cursor:'pointer',
        border: active ? '2px solid #6366F1' : '1.5px solid #E2E8F0',
        background: active ? '#EEF2FF' : '#F8FAFC',
        color: active ? '#4F46E5' : '#475569',
      }}>
      {children}
    </button>
  )
}

function Field({ id, label, required, error, children }) {
  return (
    <div id={`field-${id}`}>
      <label style={{ display:'block', fontSize:'13px', fontWeight:700, color:'#374151', marginBottom:'7px' }}>
        {label}{required && <span style={{ color:'#EF4444', marginLeft:'2px' }}>*</span>}
      </label>
      {children}
      {error && <p style={{ fontSize:'12px', color:'#EF4444', marginTop:'5px' }}>{error}</p>}
    </div>
  )
}
