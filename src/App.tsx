import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { RequireRole } from '@/components/auth/RequireRole';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Route Code-Splitting with React.lazy
const LoginPage = lazy(() => import('@/pages/LoginPage').then(m => ({ default: m.LoginPage })));
const TodayPage = lazy(() => import('@/pages/TodayPage').then(m => ({ default: m.TodayPage })));
const EmployeesPage = lazy(() => import('@/pages/EmployeesPage').then(m => ({ default: m.EmployeesPage })));
const AddEmployeePage = lazy(() => import('@/pages/AddEmployeePage').then(m => ({ default: m.AddEmployeePage })));
const EmployeeDetailPage = lazy(() => import('@/pages/EmployeeDetailPage').then(m => ({ default: m.EmployeeDetailPage })));
const CamerasPage = lazy(() => import('@/pages/CamerasPage').then(m => ({ default: m.CamerasPage })));
const ObjectPage = lazy(() => import('@/pages/ObjectPage').then(m => ({ default: m.ObjectPage })));
const UnknownFacesPage = lazy(() => import('@/pages/UnknownFacesPage').then(m => ({ default: m.UnknownFacesPage })));
const ReportsPage = lazy(() => import('@/pages/ReportsPage').then(m => ({ default: m.ReportsPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })));

function PageFallback() {
  return (
    <div className="flex h-[60vh] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink border-t-transparent" />
        <span className="text-xs font-mono font-medium text-text2">Yuklanmoqda...</span>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-ink border-t-transparent" />
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-ink border-t-transparent" />
      </div>
    );
  }

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
        />
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<TodayPage />} />
          <Route path="/employees" element={<EmployeesPage />} />
          <Route
            path="/employees/new"
            element={
              <RequireRole allowedRoles={['owner', 'manager']}>
                <AddEmployeePage />
              </RequireRole>
            }
          />
          <Route path="/employees/:id" element={<EmployeeDetailPage />} />
          <Route path="/cameras" element={<CamerasPage />} />
          <Route path="/object" element={<ObjectPage />} />
          <Route path="/unknown" element={<UnknownFacesPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route
            path="/settings"
            element={
              <RequireRole allowedRoles={['owner', 'manager']}>
                <SettingsPage />
              </RequireRole>
            }
          />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
