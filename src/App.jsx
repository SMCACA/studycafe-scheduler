import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import StudentManagement from './pages/StudentManagement'
import ScheduleManagement from './pages/ScheduleManagement'
import AttendanceManagement from './pages/AttendanceManagement'
import StudentViewer from './pages/StudentViewer'
import RewardNotification from './pages/RewardNotification'
import StudentPoints from './pages/StudentPoints'   // ✅ 신규: 상벌점 관리
import StaffManagement from './pages/StaffManagement'   // ✅ 신규
import PublicScheduleView from './pages/PublicScheduleView' // ✅ 공개 시간표 뷰
import Apply from './pages/Apply' // ✅ [신규] 신청서 공개 페이지
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/dashboard" element={
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        } />

        <Route path="/students" element={
          <ProtectedRoute><StudentManagement /></ProtectedRoute>
        } />

        <Route path="/schedules" element={
          <ProtectedRoute><ScheduleManagement /></ProtectedRoute>
        } />
        <Route path="/schedules/attendance" element={
          <ProtectedRoute><AttendanceManagement /></ProtectedRoute>
        } />

        {/* 알림톡 */}
        <Route path="/notifications" element={<Navigate to="/notifications/schedule" replace />} />
        <Route path="/notifications/schedule" element={
          <ProtectedRoute><StudentViewer /></ProtectedRoute>
        } />
        <Route path="/notifications/rewards" element={
          <ProtectedRoute><RewardNotification /></ProtectedRoute>
        } />

        {/* ✅ 상벌점 관리 */}
        <Route path="/points" element={
          <ProtectedRoute><StudentPoints /></ProtectedRoute>
        } />

        {/* ✅ 직원 근무표 */}
        <Route path="/staff" element={
          <ProtectedRoute><StaffManagement /></ProtectedRoute>
        } />

        {/* ✅ 공개 시간표 뷰 - 로그인 없이 접근 가능 */}
        <Route path="/view" element={<PublicScheduleView />} />

        {/* ✅ [신규] 신청서 공개 페이지 - 로그인 없이 접근 가능 */}
        <Route path="/apply" element={<Apply />} />

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}