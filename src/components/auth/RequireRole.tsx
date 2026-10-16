import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { Role } from '@/types';
import { ShieldAlert } from 'lucide-react';

interface RequireRoleProps {
  allowedRoles: Role[];
  children: ReactNode;
}

export function RequireRole({ allowedRoles, children }: RequireRoleProps) {
  const { user, isLoading, hasRole } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!hasRole(allowedRoles)) {
    return (
      <div className="flex min-h-[400px] w-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-800">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Ruxsat yetarli emas (403)</h2>
        <p className="max-w-md text-sm text-slate-600 font-medium">
          Sizning rolingiz (<strong>{user.role}</strong>) ushbu bo'lim yoki amalni ko'rish huquqiga ega emas. Ushbu ma'lumotlar faqat tizim menejeri yoki egasi uchun ochiq.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

export function Can({
  roles,
  children,
  fallback = null,
}: {
  roles: Role[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { hasRole } = useAuth();
  if (hasRole(roles)) {
    return <>{children}</>;
  }
  return <>{fallback}</>;
}
