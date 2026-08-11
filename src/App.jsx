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
import AdminStaff from './pages/admin/AdminStaff'
import AdminOrders from './pages/admin/AdminOrders'
import AdminRequests from './pages/admin/AdminRequests'
import AdminRequestTypes from './pages/admin/AdminRequestTypes'
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
        <Route path="locations" element={<AdminLocations />} />
        <Route path="areas" element={<AdminAreas />} />
        <Route path="tables" element={<AdminTables />} />
        <Route path="floor-plan" element={<AdminFloorPlan />} />
        <Route path="menu" element={<AdminMenu />} />
        <Route path="staff" element={<AdminStaff />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="requests" element={<AdminRequests />} />
        <Route path="request-types" element={<AdminRequestTypes />} />
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
