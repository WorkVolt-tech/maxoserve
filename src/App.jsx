import { Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import CreateBusiness from './pages/CreateBusiness'
import ProtectedRoute from './components/ProtectedRoute'
import AdminLayout from './layouts/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminLocations from './pages/admin/AdminLocations'
import AdminAreas from './pages/admin/AdminAreas'
import AdminTables from './pages/admin/AdminTables'
import AdminFloorPlan from './pages/admin/AdminFloorPlan'
import AdminMenu from './pages/admin/AdminMenu'
import AdminMenuItems from './pages/admin/AdminMenuItems'
import AdminModifiers from './pages/admin/AdminModifiers'
import AdminStaff from './pages/admin/AdminStaff'
import AdminAssignments from './pages/admin/AdminAssignments'
import AdminReservations from './pages/admin/AdminReservations'
import AdminOrders from './pages/admin/AdminOrders'
import AdminRequests from './pages/admin/AdminRequests'
import AdminRequestTypes from './pages/admin/AdminRequestTypes'
import RequireRole from './components/RequireRole'
import StaffDashboard from './pages/staff/StaffDashboard'
import TablePage from './pages/customer/TablePage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />

      <Route
        path="/admin/create-business"
        element={
          <ProtectedRoute>
            <CreateBusiness />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="locations" element={<RequireRole section="locations"><AdminLocations /></RequireRole>} />
        <Route path="areas" element={<RequireRole section="areas"><AdminAreas /></RequireRole>} />
        <Route path="tables" element={<RequireRole section="tables"><AdminTables /></RequireRole>} />
        <Route path="floor-plan" element={<RequireRole section="floorPlan"><AdminFloorPlan /></RequireRole>} />
        <Route path="menu" element={<RequireRole section="menu"><AdminMenu /></RequireRole>} />
        <Route path="menu/:categoryId" element={<RequireRole section="menu"><AdminMenuItems /></RequireRole>} />
        <Route path="modifiers" element={<RequireRole section="modifiers"><AdminModifiers /></RequireRole>} />
        <Route path="staff" element={<RequireRole section="staff"><AdminStaff /></RequireRole>} />
        <Route path="assignments" element={<RequireRole section="assignments"><AdminAssignments /></RequireRole>} />
        <Route path="reservations" element={<RequireRole section="reservations"><AdminReservations /></RequireRole>} />
        <Route path="orders" element={<RequireRole section="orders"><AdminOrders /></RequireRole>} />
        <Route path="requests" element={<RequireRole section="requests"><AdminRequests /></RequireRole>} />
        <Route path="request-types" element={<RequireRole section="requestTypes"><AdminRequestTypes /></RequireRole>} />
      </Route>

      <Route
        path="/staff"
        element={
          <ProtectedRoute>
            <StaffDashboard />
          </ProtectedRoute>
        }
      />

      <Route path="/t/:token" element={<TablePage />} />
    </Routes>
  )
}
