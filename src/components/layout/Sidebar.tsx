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

const navItems = [
  { to: '/', icon: LayoutGrid, key: 'nav.today' },
  { to: '/employees', icon: Users, key: 'nav.employees' },
  { to: '/cameras', icon: Camera, key: 'nav.cameras' },
  { to: '/object', icon: Building2, key: 'nav.object' },
  { to: '/unknown', icon: UserX, key: 'nav.unknown' },
  { to: '/reports', icon: FileText, key: 'nav.reports' },
  { to: '/settings', icon: Settings, key: 'nav.settings' },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();

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
        {navItems.map((item) => (
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
