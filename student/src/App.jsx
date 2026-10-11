import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import AppShell from './components/AppShell';
import { PageLoader } from './components/ui';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LocationProvider } from './context/LocationContext';
import { SosProvider } from './context/SosContext';
import { ToastProvider, useToast } from './context/ToastContext';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';

const Home = lazy(() => import('./pages/Home'));
const Sos = lazy(() => import('./pages/Sos'));
const Community = lazy(() => import('./pages/Community'));
const PostDetail = lazy(() => import('./pages/PostDetail'));
const Fundraisers = lazy(() => import('./pages/Fundraisers'));
const FundraiserDetail = lazy(() => import('./pages/FundraiserDetail'));
const NewFundraiser = lazy(() => import('./pages/NewFundraiser'));
const Chat = lazy(() => import('./pages/Chat'));
const Profile = lazy(() => import('./pages/Profile'));
const NotFound = lazy(() => import('./pages/NotFound'));

function RequireAuth({ children }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return children;
}

function GuestOnly({ children }) {
  const { user } = useAuth();
  return user ? <Navigate to="/app" replace /> : children;
}

function SessionNotice() {
  const { sessionMessage, clearSessionMessage } = useAuth();
  const toast = useToast();
  useEffect(() => {
    if (sessionMessage) { toast.info(sessionMessage); clearSessionMessage(); }
  }, [sessionMessage, toast, clearSessionMessage]);
  return null;
}

function Providers({ children }) {
  const { user } = useAuth();
  return (
    <LocationProvider enabled={Boolean(user)}>
      <SosProvider>{children}</SosProvider>
    </LocationProvider>
  );
}

export default function App() {
  useEffect(() => {
    // Service worker: precaches the app shell so Kavach opens without internet
    registerSW({ immediate: true });
  }, []);

  return (
    <ToastProvider>
      <AuthProvider>
        <SessionNotice />
        <Providers>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<GuestOnly><Landing /></GuestOnly>} />
              <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
              <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
              <Route path="/app" element={<RequireAuth><AppShell /></RequireAuth>}>
                <Route index element={<Home />} />
                <Route path="sos" element={<Sos />} />
                <Route path="community" element={<Community />} />
                <Route path="community/:id" element={<PostDetail />} />
                <Route path="fundraisers" element={<Fundraisers />} />
                <Route path="fundraisers/new" element={<NewFundraiser />} />
                <Route path="fundraisers/:id" element={<FundraiserDetail />} />
                <Route path="chat" element={<Chat />} />
                <Route path="profile" element={<Profile />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </Providers>
      </AuthProvider>
    </ToastProvider>
  );
}
