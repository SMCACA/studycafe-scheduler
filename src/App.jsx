import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import StudentManagement from './pages/StudentManagement'
import TuitionManagement from './pages/TuitionManagement'
import ScheduleManagement from './pages/ScheduleManagement'
import AttendanceManagement from './pages/AttendanceManagement'
import StudentViewer from './pages/StudentViewer'
import RewardNotification from './pages/RewardNotification'
import StudentPoints from './pages/StudentPoints'
import StaffManagement from './pages/StaffManagement'
import PublicScheduleView from './pages/PublicScheduleView'
import Apply from './pages/Apply'
import NotificationLogs from './pages/NotificationLogs'
import Manuals from './pages/Manuals'
import Calendar from './pages/Calendar'
import SavedMessages from './pages/SavedMessages'
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
        <Route path="/students/tuition" element={
          <ProtectedRoute><TuitionManagement /></ProtectedRoute>
        } />

        <Route path="/schedules" element={
          <ProtectedRoute><ScheduleManagement /></ProtectedRoute>
        } />
        <Route path="/schedules/attendance" element={
          <ProtectedRoute><AttendanceManagement /></ProtectedRoute>
        } />

        <Route path="/notifications" element={<Navigate to="/notifications/schedule" replace />} />
        <Route path="/notifications/schedule" element={
          <ProtectedRoute><StudentViewer /></ProtectedRoute>
        } />
        <Route path="/notifications/rewards" element={
          <ProtectedRoute><RewardNotification /></ProtectedRoute>
        } />
        <Route path="/notifications/logs" element={
          <ProtectedRoute><NotificationLogs /></ProtectedRoute>
        } />
        <Route path="/notifications/messages" element={
          <ProtectedRoute><SavedMessages /></ProtectedRoute>
        } />

        <Route path="/points" element={
          <ProtectedRoute><StudentPoints /></ProtectedRoute>
        } />

        <Route path="/staff" element={
          <ProtectedRoute><StaffManagement /></ProtectedRoute>
        } />

        <Route path="/manuals" element={
          <ProtectedRoute><Manuals /></ProtectedRoute>
        } />

        <Route path="/calendar" element={
          <ProtectedRoute><Calendar /></ProtectedRoute>
        } />

        <Route path="/view" element={<PublicScheduleView />} />
        <Route path="/apply" element={<Apply />} />

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
