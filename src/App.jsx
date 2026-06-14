import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import StudentManagement from './pages/StudentManagement'
import ScheduleManagement from './pages/ScheduleManagement'
import AttendanceManagement from './pages/AttendanceManagement'
import StudentViewer from './pages/StudentViewer'
import RewardNotification from './pages/RewardNotification'
import StaffManagement from './pages/StaffManagement'   // ✅ 신규
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

        {/* ✅ 직원 근무표 */}
        <Route path="/staff" element={
          <ProtectedRoute><StaffManagement /></ProtectedRoute>
        } />

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
