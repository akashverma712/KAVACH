import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import { PageLoader } from './components/ui';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SosAlertProvider } from './context/SosAlertContext';
import { ToastProvider, useToast } from './context/ToastContext';
import Login from './pages/Login';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const SosAlerts = lazy(() => import('./pages/SosAlerts'));
const Problems = lazy(() => import('./pages/Problems'));
const Reports = lazy(() => import('./pages/Reports'));
const Fundraisers = lazy(() => import('./pages/Fundraisers'));
const Students = lazy(() => import('./pages/Students'));
const Users = lazy(() => import('./pages/Users'));
const Chatbot = lazy(() => import('./pages/Chatbot'));
const Settings = lazy(() => import('./pages/Settings'));

function RequireAdmin({ children }) {
  const { admin, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <PageLoader />;
  if (!admin) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return children;
}

function Notice() {
  const { notice, clearNotice } = useAuth();
  const toast = useToast();
  useEffect(() => { if (notice) { toast.info(notice); clearNotice(); } }, [notice, toast, clearNotice]);
  return null;
}

function LoginRoute() {
  const { admin } = useAuth();
  return admin ? <Navigate to="/" replace /> : <Login />;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Notice />
        <SosAlertProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<LoginRoute />} />
              <Route element={<RequireAdmin><Layout /></RequireAdmin>}>
                <Route index element={<Dashboard />} />
                <Route path="sos" element={<SosAlerts />} />
                <Route path="problems" element={<Problems />} />
                <Route path="reports" element={<Reports />} />
                <Route path="fundraisers" element={<Fundraisers />} />
                <Route path="students" element={<Students />} />
                <Route path="users" element={<Users />} />
                <Route path="chatbot" element={<Chatbot />} />
                <Route path="settings" element={<Settings />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </SosAlertProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
