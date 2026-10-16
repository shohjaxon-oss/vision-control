import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutGrid,
  Users,
  Camera,
  Building2,
  UserX,
  FileText,
  Settings,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
  { to: '/', icon: LayoutGrid, key: 'nav.today', roles: ['owner', 'manager', 'observer'] },
  { to: '/employees', icon: Users, key: 'nav.employees', roles: ['owner', 'manager', 'observer'] },
  { to: '/cameras', icon: Camera, key: 'nav.cameras', roles: ['owner', 'manager', 'observer'] },
  { to: '/object', icon: Building2, key: 'nav.object', roles: ['owner', 'manager', 'observer'] },
  { to: '/unknown', icon: UserX, key: 'nav.unknown', roles: ['owner', 'manager', 'observer'] },
  { to: '/reports', icon: FileText, key: 'nav.reports', roles: ['owner', 'manager', 'observer'] },
  { to: '/settings', icon: Settings, key: 'nav.settings', roles: ['owner', 'manager'] },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userRole = user?.role || 'observer';

  const visibleItems = navItems.filter((item) => item.roles.includes(userRole));

  return (
    <nav className="flex h-full flex-col gap-1 p-3">
      <div className="flex items-center gap-2 px-3 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-control bg-ink">
          <Eye size={18} strokeWidth={1.5} className="text-white" />
        </div>
        <span className="text-sm font-semibold tracking-tight">
          {t('app.name')}
        </span>
      </div>

      <div className="mt-2 flex-1 space-y-0.5">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-control px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-surface font-semibold text-ink border border-line shadow-xs'
                  : 'text-text2 font-medium hover:bg-surface-hover hover:text-ink'
              )
            }
          >
            <item.icon size={18} strokeWidth={1.5} />
            {t(item.key)}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
