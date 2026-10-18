import { lazy, Suspense } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Loader2 } from 'lucide-react'
import { AuthProvider, useAuth } from '@/lib/auth'
import Shell from '@/components/Shell'
import Login from '@/pages/Login'
import Today from '@/pages/Today'

// Heavier screens load on demand to keep the first paint fast on mobile.
const Medications = lazy(() => import('@/pages/Medications'))
const AIClinic = lazy(() => import('@/pages/AIClinic'))
const Appointments = lazy(() => import('@/pages/Appointments'))
const Symptoms = lazy(() => import('@/pages/Symptoms'))
const Doctors = lazy(() => import('@/pages/Doctors'))
const Report = lazy(() => import('@/pages/Report'))
const Emergency = lazy(() => import('@/pages/Emergency'))
const Profile = lazy(() => import('@/pages/Profile'))

const Spinner = () => (
  <div className="min-h-[50vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand" aria-label="Carregando" /></div>
)

function AppRoutes() {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen bg-bg"><Spinner /></div>
  if (!user) return <Login />
  return (
    <Shell>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/hoje" element={<Today />} />
          <Route path="/medicamentos" element={<Medications />} />
          <Route path="/ia" element={<AIClinic />} />
          <Route path="/agenda" element={<Appointments />} />
          <Route path="/diario" element={<Symptoms />} />
          <Route path="/medicos" element={<Doctors />} />
          <Route path="/relatorio" element={<Report />} />
          <Route path="/emergencia" element={<Emergency />} />
          <Route path="/perfil" element={<Profile />} />
          <Route path="*" element={<Navigate to="/hoje" replace />} />
        </Routes>
      </Suspense>
    </Shell>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-center" richColors closeButton toastOptions={{ style: { borderRadius: 16 } }} />
      </AuthProvider>
    </HashRouter>
  )
}
