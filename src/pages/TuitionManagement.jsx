/**
 * 수납 관리 페이지
 *
 * ── Supabase 테이블 (처음 사용 전에 실행해주세요) ──────────────────────────
 *
 * -- ① 표준 이용료 테이블
 * CREATE TABLE IF NOT EXISTS tuition_standard_rates (
 *   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *   membership_type text NOT NULL,           -- '풀', '평일', '주말'
 *   is_academy_student boolean NOT NULL DEFAULT false,
 *   amount integer NOT NULL DEFAULT 0,
 *   description text DEFAULT '',
 *   updated_at timestamptz DEFAULT now(),
 *   UNIQUE(membership_type, is_academy_student)
 * );
 *
 * -- ② 학생별 수납 기록 (year=0, month=0 → 고정 기본료, 나머지 → 월별)
 * CREATE TABLE IF NOT EXISTS student_tuition (
 *   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *   student_id uuid REFERENCES students(id) ON DELETE CASCADE,
 *   year integer NOT NULL DEFAULT 0,
 *   month integer NOT NULL DEFAULT 0,
 *   amount integer NOT NULL DEFAULT 0,
 *   notes text DEFAULT '',
 *   created_at timestamptz DEFAULT now(),
 *   updated_at timestamptz DEFAULT now(),
 *   UNIQUE(student_id, year, month)
 * );
 * ───────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useMemo } from 'react'
import Layout from '../components/Layout'
import { createClient } from '@supabase/supabase-js'
import {
  Wallet, ChevronLeft, ChevronRight, Edit2, Check, X,
  BookOpen, AlertCircle, Save, RefreshCw, Plus,
} from 'lucide-react'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// 이용권 종류 (스케줄 관리에서 설정하는 값과 동일)
const MEMBERSHIP_TYPES = ['풀', '평일', '주말']

// 이용권 스타일 (비유: 각 이용권을 색깔 배지로 표시)
const MEMBERSHIP_STYLE = {
  풀:   { bg: '#ECFDF5', color: '#059669', border: '#A7F3D0', label: '풀타임' },
  평일: { bg: '#EEF2FF', color: '#4F46E5', border: '#C7D2FE', label: '평일권' },
  주말: { bg: '#FFF7ED', color: '#D97706', border: '#FDE68A', label: '주말권' },
}

// 학원 구분 스타일
const ACADEMY_STYLE = {
  true:  { bg: '#FFFBEB', color: '#D97706', border: '#FDE68A', label: 'SMC 재원생' },
  false: { bg: '#F1F5F9', color: '#64748B', border: '#E2E8F0', label: '비재원생' },
}

// 숫자를 "150,000원" 형식으로 변환
const formatKRW = (n) => {
  if (!n && n !== 0) return '–'
  return Number(n).toLocaleString('ko-KR') + '원'
}

// 월 이름
const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

// 표준 이용료 테이블의 모든 조합 (6가지)
const RATE_COMBINATIONS = [
  { membership_type: '풀',   is_academy_student: true  },
  { membership_type: '풀',   is_academy_student: false },
  { membership_type: '평일', is_academy_student: true  },
  { membership_type: '평일', is_academy_student: false },
  { membership_type: '주말', is_academy_student: true  },
  { membership_type: '주말', is_academy_student: false },
]

export default function TuitionManagement() {
  const today = new Date()
  const [selectedYear,  setSelectedYear]  = useState(today.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1)

  const [students,       setStudents]       = useState([])  // 재원생 + 예비원생
  const [schedules,      setSchedules]      = useState([])  // 스케줄 목록
  const [standardRates,  setStandardRates]  = useState([])  // 표준 이용료
  const [baseFees,       setBaseFees]       = useState([])  // 학생별 고정 기본료 (year=0, month=0)
  const [monthlyFees,    setMonthlyFees]    = useState([])  // 선택된 달의 월별 수납 기록

  const [showStdRates,   setShowStdRates]   = useState(false)  // 표준 이용료 패널 열림/닫힘

  // 인라인 편집 상태 (비유: 테이블 셀을 클릭하면 그 자리에서 바로 입력 가능)
  const [editingCell,    setEditingCell]    = useState(null)    // { studentId, type: 'base'|'monthly', field: 'amount'|'notes' }
  const [editValue,      setEditValue]      = useState('')

  // 표준 이용료 편집 상태
  const [editingRate,    setEditingRate]    = useState(null)    // { membership_type, is_academy_student }
  const [editRateValue,  setEditRateValue]  = useState('')

  const [toast,          setToast]          = useState(null)
  const [loading,        setLoading]        = useState(false)
  const [saving,         setSaving]         = useState(false)

  // 데이터 불러오기
  useEffect(() => { fetchAll() }, [selectedYear, selectedMonth])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [
        { data: sts },
        { data: schs },
        { data: rates },
        { data: bFees },
        { data: mFees },
      ] = await Promise.all([
        // 재원생 + 예비원생만 조회
        supabase.from('students').select('*').in('status', ['재원생', '예비원생']).order('name'),
        supabase.from('schedules').select('*'),
        supabase.from('tuition_standard_rates').select('*'),
        // 고정 기본료 (year=0, month=0)
        supabase.from('student_tuition').select('*').eq('year', 0).eq('month', 0),
        // 선택된 달의 월별 기록
        supabase.from('student_tuition').select('*')
          .eq('year', selectedYear).eq('month', selectedMonth),
      ])

      setStudents(sts || [])
      setSchedules(schs || [])
      setStandardRates(rates || [])
      setBaseFees(bFees || [])
      setMonthlyFees(mFees || [])
    } catch (err) {
      showToast('데이터를 불러오지 못했어요: ' + err.message, 'error')
    }
    setLoading(false)
  }

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // 학생의 스케줄 (이용권 종류) 조회
  const getSchedule = (studentId) => schedules.find(s => s.student_id === studentId)

  // 학생의 고정 기본료 레코드 조회
  const getBaseFee = (studentId) => baseFees.find(r => r.student_id === studentId)

  // 학생의 이번 달 수납 레코드 조회
  const getMonthlyFee = (studentId) => monthlyFees.find(r => r.student_id === studentId)

  // 이번 달 실제 적용 금액 (월별 기록이 있으면 그것, 없으면 기본료)
  const getEffectiveAmount = (studentId) => {
    const monthly = getMonthlyFee(studentId)
    if (monthly) return { amount: monthly.amount, isOverride: true }
    const base = getBaseFee(studentId)
    if (base) return { amount: base.amount, isOverride: false }
    return { amount: null, isOverride: false }
  }

  // 표준 이용료 조회
  const getStandardRate = (membershipType, isAcademy) => {
    return standardRates.find(r =>
      r.membership_type === membershipType && r.is_academy_student === isAcademy
    )
  }

  // ── 저장 함수들 ───────────────────────────────────────────

  // 고정 기본료 저장 (year=0, month=0)
  const saveBaseFee = async (studentId, amount, notes) => {
    setSaving(true)
    try {
      const { error } = await supabase.from('student_tuition').upsert({
        student_id: studentId,
        year: 0, month: 0,
        amount: Number(amount) || 0,
        notes: notes || '',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'student_id,year,month' })
      if (error) throw error
      showToast('고정 수강료가 저장됐어요 💾')
      await fetchAll()
    } catch (err) {
      showToast('저장 실패: ' + err.message, 'error')
    }
    setSaving(false)
  }

  // 이번 달 수납 저장
  const saveMonthlyFee = async (studentId, amount, notes) => {
    setSaving(true)
    try {
      const { error } = await supabase.from('student_tuition').upsert({
        student_id: studentId,
        year: selectedYear, month: selectedMonth,
        amount: Number(amount) || 0,
        notes: notes || '',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'student_id,year,month' })
      if (error) throw error
      showToast(`${selectedYear}년 ${selectedMonth}월 수납이 저장됐어요 ✅`)
      await fetchAll()
    } catch (err) {
      showToast('저장 실패: ' + err.message, 'error')
    }
    setSaving(false)
  }

  // 이번 달 기록을 기본료와 동일하게 초기화 (기본료로 되돌리기)
  const resetMonthlyToBase = async (studentId) => {
    const base = getBaseFee(studentId)
    const monthly = getMonthlyFee(studentId)
    if (!monthly) { showToast('이미 기본료가 적용 중이에요', 'success'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('student_tuition').delete()
        .eq('student_id', studentId).eq('year', selectedYear).eq('month', selectedMonth)
      if (error) throw error
      showToast('이번 달 수납이 기본료로 초기화됐어요 🔄')
      await fetchAll()
    } catch (err) {
      showToast('초기화 실패: ' + err.message, 'error')
    }
    setSaving(false)
  }

  // 표준 이용료 저장
  const saveStandardRate = async (membershipType, isAcademy, amount) => {
    setSaving(true)
    try {
      const { error } = await supabase.from('tuition_standard_rates').upsert({
        membership_type: membershipType,
        is_academy_student: isAcademy,
        amount: Number(amount) || 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'membership_type,is_academy_student' })
      if (error) throw error
      showToast('표준 이용료가 저장됐어요 📋')
      await fetchAll()
    } catch (err) {
      showToast('저장 실패: ' + err.message, 'error')
    }
    setSaving(false)
    setEditingRate(null)
  }

  // ── 인라인 편집 핸들러 ────────────────────────────────────

  const startEdit = (studentId, type, currentAmount, currentNotes) => {
    setEditingCell({ studentId, type, field: 'amount' })
    setEditValue(String(currentAmount || ''))
  }

  const confirmEdit = async (studentId, type) => {
    const notes = type === 'base'
      ? (getBaseFee(studentId)?.notes || '')
      : (getMonthlyFee(studentId)?.notes || getBaseFee(studentId)?.notes || '')

    if (type === 'base') {
      await saveBaseFee(studentId, editValue, notes)
    } else {
      await saveMonthlyFee(studentId, editValue, notes)
    }
    setEditingCell(null)
    setEditValue('')
  }

  const cancelEdit = () => { setEditingCell(null); setEditValue('') }

  // 비고 직접 저장 (blur 시)
  const saveNotes = async (studentId, type, notes) => {
    const record = type === 'base' ? getBaseFee(studentId) : getMonthlyFee(studentId)
    const amount = record?.amount || getBaseFee(studentId)?.amount || 0
    if (type === 'base') {
      await saveBaseFee(studentId, amount, notes)
    } else {
      await saveMonthlyFee(studentId, amount, notes)
    }
  }

  // ── 이번 달을 기본료로 일괄 생성 (달 이동 시 편의기능) ────

  const initMonthFromBase = async () => {
    if (!window.confirm(`${selectedYear}년 ${selectedMonth}월에 모든 학생의 고정 수강료를 복사할까요?\n(이미 이번 달 기록이 있는 학생은 건너뜁니다)`)) return
    setSaving(true)
    try {
      const toInsert = baseFees
        .filter(bf => !monthlyFees.find(mf => mf.student_id === bf.student_id))
        .map(bf => ({
          student_id: bf.student_id,
          year: selectedYear, month: selectedMonth,
          amount: bf.amount,
          notes: bf.notes || '',
        }))
      if (toInsert.length === 0) { showToast('이미 모든 학생의 이번 달 기록이 있어요', 'success'); setSaving(false); return }
      const { error } = await supabase.from('student_tuition').insert(toInsert)
      if (error) throw error
      showToast(`${toInsert.length}명의 이번 달 수납이 고정 수강료로 설정됐어요 ✅`)
      await fetchAll()
    } catch (err) {
      showToast('일괄 설정 실패: ' + err.message, 'error')
    }
    setSaving(false)
  }

  // 월 이동
  const prevMonth = () => {
    if (selectedMonth === 1) { setSelectedYear(y => y - 1); setSelectedMonth(12) }
    else setSelectedMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (selectedMonth === 12) { setSelectedYear(y => y + 1); setSelectedMonth(1) }
    else setSelectedMonth(m => m + 1)
  }

  // 총 수납 예정액 (이번 달)
  const totalThisMonth = useMemo(() => {
    return students.reduce((sum, s) => {
      const { amount } = getEffectiveAmount(s.id)
      return sum + (amount || 0)
    }, 0)
  }, [students, baseFees, monthlyFees])

  return (
    <Layout>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      <div style={{ padding: '28px 32px' }}>

        {/* ── 페이지 헤더 ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '46px', height: '46px', borderRadius: '14px', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wallet size={22} style={{ color: '#059669' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0F172A', margin: 0 }}>수납 관리</h1>
              <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '3px' }}>
                재원생 + 예비원생 {students.length}명 · {selectedYear}년 {selectedMonth}월 예상 수납액 {formatKRW(totalThisMonth)}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowStdRates(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '9px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                border: showStdRates ? '1.5px solid #059669' : '1.5px solid #E2E8F0',
                background: showStdRates ? '#ECFDF5' : '#fff',
                color: showStdRates ? '#059669' : '#64748B', cursor: 'pointer',
              }}
            >
              <BookOpen size={14} /> 표준 이용료
            </button>
            <button
              onClick={initMonthFromBase}
              disabled={saving}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '9px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                border: '1.5px solid #E2E8F0', background: '#F8FAFC',
                color: '#64748B', cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              <RefreshCw size={14} /> 기본료로 일괄 설정
            </button>
          </div>
        </div>

        {/* ── 표준 이용료 패널 (접을 수 있음) ── */}
        {showStdRates && (
          <div style={{
            background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0',
            padding: '20px 24px', marginBottom: '20px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', margin: '0 0 14px' }}>
              📋 표준 이용료 (참고용 — 학원에서 정한 기준 금액이에요)
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr>
                    {['이용권', 'SMC 구분', '금액', '수정'].map(h => (
                      <th key={h} style={{
                        padding: '8px 14px', background: '#F8FAFC', textAlign: 'left',
                        fontSize: '11px', fontWeight: 700, color: '#64748B',
                        border: '1px solid #E2E8F0', letterSpacing: '0.04em',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {RATE_COMBINATIONS.map(({ membership_type, is_academy_student }) => {
                    const rate = getStandardRate(membership_type, is_academy_student)
                    const mSty  = MEMBERSHIP_STYLE[membership_type]
                    const aSty  = ACADEMY_STYLE[is_academy_student]
                    const key   = `${membership_type}-${is_academy_student}`
                    const isEditingThis = editingRate?.key === key
                    return (
                      <tr key={key}>
                        <td style={{ padding: '10px 14px', border: '1px solid #E2E8F0' }}>
                          <span style={{
                            padding: '2px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
                            background: mSty.bg, color: mSty.color, border: `1px solid ${mSty.border}`,
                          }}>{mSty.label}</span>
                        </td>
                        <td style={{ padding: '10px 14px', border: '1px solid #E2E8F0' }}>
                          <span style={{
                            padding: '2px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
                            background: aSty.bg, color: aSty.color, border: `1px solid ${aSty.border}`,
                          }}>{aSty.label}</span>
                        </td>
                        <td style={{ padding: '10px 14px', border: '1px solid #E2E8F0', fontWeight: 700, color: '#0F172A' }}>
                          {isEditingThis ? (
                            <input
                              type="number"
                              value={editRateValue}
                              onChange={e => setEditRateValue(e.target.value)}
                              autoFocus
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveStandardRate(membership_type, is_academy_student, editRateValue)
                                if (e.key === 'Escape') setEditingRate(null)
                              }}
                              style={{
                                width: '140px', padding: '6px 10px', borderRadius: '8px',
                                border: '1.5px solid #059669', fontSize: '13px', outline: 'none',
                              }}
                              placeholder="금액 입력"
                            />
                          ) : (
                            rate ? formatKRW(rate.amount) : <span style={{ color: '#CBD5E1' }}>미설정</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px', border: '1px solid #E2E8F0' }}>
                          {isEditingThis ? (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                onClick={() => saveStandardRate(membership_type, is_academy_student, editRateValue)}
                                disabled={saving}
                                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '8px', border: 'none', background: '#059669', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                              ><Check size={11} /> 저장</button>
                              <button
                                onClick={() => setEditingRate(null)}
                                style={{ padding: '5px 10px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: '11px', cursor: 'pointer' }}
                              >취소</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditingRate({ key }); setEditRateValue(String(rate?.amount || '')) }}
                              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#64748B', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                            ><Edit2 size={10} /> 수정</button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '10px' }}>
              💡 표준 이용료는 참고용이에요. 각 학생별 실제 수강료는 아래 표에서 별도로 입력하세요.
            </p>
          </div>
        )}

        {/* ── 월 선택 ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px',
          background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0',
          padding: '14px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#374151' }}>수납 월 선택</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
            <button
              onClick={prevMonth}
              style={{ width: '30px', height: '30px', borderRadius: '8px', border: '1.5px solid #E2E8F0', background: '#F8FAFC', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronLeft size={15} style={{ color: '#64748B' }} />
            </button>
            <span style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', minWidth: '110px', textAlign: 'center' }}>
              {selectedYear}년 {selectedMonth}월
            </span>
            <button
              onClick={nextMonth}
              style={{ width: '30px', height: '30px', borderRadius: '8px', border: '1.5px solid #E2E8F0', background: '#F8FAFC', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronRight size={15} style={{ color: '#64748B' }} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {MONTHS.map((m, i) => (
              <button
                key={i}
                onClick={() => setSelectedMonth(i + 1)}
                style={{
                  padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  border: selectedMonth === i + 1 ? '1.5px solid #6366F1' : '1.5px solid #E2E8F0',
                  background: selectedMonth === i + 1 ? '#EEF2FF' : '#fff',
                  color: selectedMonth === i + 1 ? '#6366F1' : '#64748B',
                }}
              >{m}</button>
            ))}
          </div>
        </div>

        {/* ── 수납 안내 ── */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '10px',
          padding: '12px 16px', borderRadius: '10px',
          background: '#EFF8FF', border: '1px solid #BAE6FD',
          marginBottom: '16px', fontSize: '12px', color: '#0369A1',
        }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
          <div>
            <strong>수납 관리 사용 방법</strong><br />
            • <strong>고정 수강료</strong>: 매달 기본으로 적용되는 금액이에요. 학생 이름 왼쪽 열에서 설정하세요.<br />
            • <strong>이번 달 수강료</strong>: 해당 달에만 적용되는 금액이에요. 고정 수강료와 다를 때만 입력하면 돼요.<br />
            • 금액을 클릭하면 바로 수정할 수 있어요. 비고는 항상 입력 가능해요.
          </div>
        </div>

        {/* ── 학생 수납 테이블 ── */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#94A3B8', fontSize: '14px' }}>
            불러오는 중…
          </div>
        ) : students.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#94A3B8', fontSize: '14px' }}>
            <Wallet size={32} style={{ color: '#E2E8F0', display: 'block', margin: '0 auto 10px' }} />
            재원생·예비원생 학생이 없어요. 먼저 학생을 등록해주세요.
          </div>
        ) : (
          <div style={{
            background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0',
            overflowX: 'auto', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  {[
                    { label: '이름', width: '90px' },
                    { label: '좌석', width: '54px' },
                    { label: '학년', width: '60px' },
                    { label: '이용권', width: '80px' },
                    { label: 'SMC 구분', width: '90px' },
                    { label: '고정 수강료', width: '130px', tip: '매달 기본으로 적용되는 금액' },
                    { label: `${selectedMonth}월 수강료`, width: '160px', tip: '이번 달만 적용 (없으면 고정 수강료 사용)' },
                    { label: '비고', width: '' },
                  ].map(h => (
                    <th key={h.label} style={{
                      padding: '11px 14px', background: '#F8FAFC',
                      fontSize: '11px', fontWeight: 700, color: '#64748B',
                      letterSpacing: '0.04em', textAlign: 'left',
                      border: '1px solid #E2E8F0', whiteSpace: 'nowrap',
                      width: h.width || 'auto',
                    }} title={h.tip || ''}>{h.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((student, idx) => {
                  const sch     = getSchedule(student.id)
                  const baseFee = getBaseFee(student.id)
                  const monthly = getMonthlyFee(student.id)
                  const { amount: effectiveAmount, isOverride } = getEffectiveAmount(student.id)

                  const mType = sch?.membership_type || null
                  const mSty  = mType ? MEMBERSHIP_STYLE[mType] : null
                  const aSty  = ACADEMY_STYLE[!!student.is_academy_student]

                  const isEditingBase    = editingCell?.studentId === student.id && editingCell?.type === 'base'
                  const isEditingMonthly = editingCell?.studentId === student.id && editingCell?.type === 'monthly'

                  return (
                    <tr
                      key={student.id}
                      style={{ background: idx % 2 === 0 ? '#fff' : '#FAFBFF', transition: 'background 0.1s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#F0F4FF' }}
                      onMouseLeave={e => { e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#FAFBFF' }}
                    >
                      {/* 이름 */}
                      <td style={{ padding: '11px 14px', border: '1px solid #E2E8F0', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span>{student.name}</span>
                          <span style={{
                            fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '4px',
                            background: student.status === '재원생' ? '#ECFDF5' : '#EEF2FF',
                            color: student.status === '재원생' ? '#059669' : '#6366F1',
                            alignSelf: 'flex-start',
                          }}>{student.status}</span>
                        </div>
                      </td>

                      {/* 좌석 */}
                      <td style={{ padding: '11px 14px', border: '1px solid #E2E8F0', textAlign: 'center' }}>
                        {student.seat_number
                          ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '8px', background: '#EEF2FF', color: '#6366F1', fontSize: '12px', fontWeight: 700 }}>{student.seat_number}</span>
                          : <span style={{ color: '#CBD5E1' }}>–</span>
                        }
                      </td>

                      {/* 학년 */}
                      <td style={{ padding: '11px 14px', border: '1px solid #E2E8F0' }}>
                        {student.grade && (
                          <span style={{
                            padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
                            background: student.grade?.startsWith('고') ? '#EEF2FF' : '#ECFDF5',
                            color: student.grade?.startsWith('고') ? '#4F46E5' : '#059669',
                          }}>{student.grade}</span>
                        )}
                      </td>

                      {/* 이용권 */}
                      <td style={{ padding: '11px 14px', border: '1px solid #E2E8F0' }}>
                        {mSty ? (
                          <span style={{ padding: '2px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, background: mSty.bg, color: mSty.color, border: `1px solid ${mSty.border}`, whiteSpace: 'nowrap' }}>
                            {mSty.label}
                          </span>
                        ) : <span style={{ color: '#CBD5E1', fontSize: '11px' }}>미설정</span>}
                      </td>

                      {/* SMC 구분 */}
                      <td style={{ padding: '11px 14px', border: '1px solid #E2E8F0' }}>
                        <span style={{ padding: '2px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, background: aSty.bg, color: aSty.color, border: `1px solid ${aSty.border}`, whiteSpace: 'nowrap' }}>
                          {aSty.label}
                        </span>
                      </td>

                      {/* 고정 수강료 */}
                      <td style={{ padding: '8px 14px', border: '1px solid #E2E8F0' }}>
                        {isEditingBase ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input
                              type="number"
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              autoFocus
                              onKeyDown={e => {
                                if (e.key === 'Enter') confirmEdit(student.id, 'base')
                                if (e.key === 'Escape') cancelEdit()
                              }}
                              style={{
                                width: '90px', padding: '5px 8px', borderRadius: '8px',
                                border: '1.5px solid #6366F1', fontSize: '13px', outline: 'none',
                              }}
                            />
                            <button onClick={() => confirmEdit(student.id, 'base')} style={{ width: '24px', height: '24px', borderRadius: '6px', border: 'none', background: '#6366F1', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={12} /></button>
                            <button onClick={cancelEdit} style={{ width: '24px', height: '24px', borderRadius: '6px', border: '1px solid #E2E8F0', background: '#fff', color: '#94A3B8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={12} /></button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(student.id, 'base', baseFee?.amount, baseFee?.notes)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '5px',
                              padding: '4px 8px', borderRadius: '8px',
                              border: '1px dashed #CBD5E1', background: baseFee ? '#F8FAFC' : 'transparent',
                              color: baseFee ? '#0F172A' : '#CBD5E1',
                              fontSize: '13px', fontWeight: baseFee ? 700 : 400,
                              cursor: 'pointer', width: '100%', justifyContent: 'space-between',
                            }}
                          >
                            <span>{baseFee ? formatKRW(baseFee.amount) : '클릭해서 입력'}</span>
                            <Edit2 size={10} style={{ color: '#CBD5E1', flexShrink: 0 }} />
                          </button>
                        )}
                      </td>

                      {/* 이번 달 수강료 */}
                      <td style={{ padding: '8px 14px', border: '1px solid #E2E8F0' }}>
                        {isEditingMonthly ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input
                              type="number"
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              autoFocus
                              onKeyDown={e => {
                                if (e.key === 'Enter') confirmEdit(student.id, 'monthly')
                                if (e.key === 'Escape') cancelEdit()
                              }}
                              style={{
                                width: '90px', padding: '5px 8px', borderRadius: '8px',
                                border: '1.5px solid #059669', fontSize: '13px', outline: 'none',
                              }}
                            />
                            <button onClick={() => confirmEdit(student.id, 'monthly')} style={{ width: '24px', height: '24px', borderRadius: '6px', border: 'none', background: '#059669', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={12} /></button>
                            <button onClick={cancelEdit} style={{ width: '24px', height: '24px', borderRadius: '6px', border: '1px solid #E2E8F0', background: '#fff', color: '#94A3B8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={12} /></button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <button
                              onClick={() => startEdit(student.id, 'monthly', effectiveAmount, monthly?.notes || baseFee?.notes)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '5px',
                                padding: '4px 8px', borderRadius: '8px',
                                border: `1px ${isOverride ? 'solid' : 'dashed'} ${isOverride ? '#A7F3D0' : '#CBD5E1'}`,
                                background: isOverride ? '#ECFDF5' : (baseFee ? '#F8FAFC' : 'transparent'),
                                color: isOverride ? '#059669' : (effectiveAmount !== null ? '#0F172A' : '#CBD5E1'),
                                fontSize: '13px', fontWeight: (effectiveAmount !== null) ? 700 : 400,
                                cursor: 'pointer', flex: 1, justifyContent: 'space-between',
                              }}
                            >
                              <span>
                                {effectiveAmount !== null
                                  ? formatKRW(effectiveAmount)
                                  : '클릭해서 입력'
                                }
                              </span>
                              <Edit2 size={10} style={{ color: '#CBD5E1', flexShrink: 0 }} />
                            </button>
                            {isOverride && (
                              <button
                                onClick={() => resetMonthlyToBase(student.id)}
                                title="기본료로 되돌리기"
                                style={{ width: '22px', height: '22px', borderRadius: '6px', border: '1px solid #E2E8F0', background: '#fff', color: '#94A3B8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                              ><X size={11} /></button>
                            )}
                            {!isOverride && effectiveAmount !== null && (
                              <span style={{ fontSize: '10px', color: '#94A3B8', whiteSpace: 'nowrap' }}>기본료</span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 비고 */}
                      <td style={{ padding: '8px 14px', border: '1px solid #E2E8F0', minWidth: '160px' }}>
                        <NoteCell
                          value={monthly?.notes !== undefined ? monthly.notes : (baseFee?.notes || '')}
                          onChange={async (val) => {
                            if (monthly) {
                              await saveMonthlyFee(student.id, monthly.amount, val)
                            } else {
                              await saveBaseFee(student.id, baseFee?.amount || 0, val)
                            }
                          }}
                        />
                      </td>
                    </tr>
                  )
                })}

                {/* 합계 행 */}
                <tr style={{ background: '#F8FAFC', borderTop: '2px solid #E2E8F0' }}>
                  <td colSpan={6} style={{ padding: '12px 14px', border: '1px solid #E2E8F0', fontSize: '13px', fontWeight: 700, color: '#374151', textAlign: 'right' }}>
                    {selectedYear}년 {selectedMonth}월 수납 예상 합계
                  </td>
                  <td style={{ padding: '12px 14px', border: '1px solid #E2E8F0', fontSize: '15px', fontWeight: 800, color: '#059669' }}>
                    {formatKRW(totalThisMonth)}
                  </td>
                  <td style={{ border: '1px solid #E2E8F0' }} />
                </tr>
              </tbody>
            </table>
          </div>
        )}

      </div>
    </Layout>
  )
}

// ── 비고 인라인 편집 컴포넌트 ──────────────────────────────
function NoteCell({ value, onChange }) {
  const [local, setLocal] = useState(value || '')
  const [editing, setEditing] = useState(false)

  useEffect(() => { setLocal(value || '') }, [value])

  return editing ? (
    <textarea
      value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => { setEditing(false); if (local !== value) onChange(local) }}
      autoFocus
      rows={2}
      style={{
        width: '100%', padding: '5px 8px', borderRadius: '8px',
        border: '1.5px solid #6366F1', fontSize: '12px', outline: 'none',
        resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box',
      }}
    />
  ) : (
    <button
      onClick={() => setEditing(true)}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '4px 8px', borderRadius: '8px',
        border: local ? '1px solid #E2E8F0' : '1px dashed #CBD5E1',
        background: 'transparent', cursor: 'pointer',
        fontSize: '12px', color: local ? '#374151' : '#CBD5E1',
        lineHeight: 1.5,
      }}
    >
      {local || '비고 입력…'}
    </button>
  )
}

// ── 토스트 알림 컴포넌트 ──────────────────────────────────
function Toast({ msg, type }) {
  return (
    <div style={{
      position: 'fixed', top: '20px', right: '20px', zIndex: 100,
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '12px 18px', borderRadius: '14px',
      background: type === 'error' ? '#EF4444' : '#10B981',
      color: '#fff', fontSize: '13px', fontWeight: 600,
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
    }}>
      {msg}
    </div>
  )
}
