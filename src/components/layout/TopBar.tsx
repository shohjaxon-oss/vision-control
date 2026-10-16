import { useTranslation } from 'react-i18next';
import { useConnectionState, type ConnectionState } from '@/hooks/use-connection';
import { useAuth } from '@/contexts/AuthContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Wifi, WifiOff, RefreshCw, Menu, Sparkles, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

const stateConfig: Record<ConnectionState, { key: string; icon: typeof Wifi; dotClass: string }> = {
  online: { key: 'connection.online', icon: Wifi, dotClass: 'status-dot--online' },
  offline: { key: 'connection.offline', icon: WifiOff, dotClass: 'status-dot--offline' },
  reconnecting: { key: 'connection.offline', icon: RefreshCw, dotClass: 'status-dot--offline' },
};

interface TopBarProps {
  onMenuClick?: () => void;
  onAskClick?: () => void;
}

export function TopBar({ onMenuClick, onAskClick }: TopBarProps) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const connState = useConnectionState();
  const config = stateConfig[connState];
  const Icon = config.icon;

  return (
    <header className="flex h-14 items-center justify-between border-b border-line bg-white px-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-md p-1.5 hover:bg-surface md:hidden text-ink"
          aria-label="Menu"
        >
          <Menu size={20} strokeWidth={1.5} />
        </button>

        <div className="flex items-center gap-2 text-xs text-text2">
          <span className={cn('h-2 w-2 rounded-full', connState === 'online' ? 'bg-[#16A34A]' : 'bg-[#DC2626]')} />
          <Icon
            size={14}
            strokeWidth={1.5}
            className={connState === 'reconnecting' ? 'animate-spin' : ''}
          />
          <span className="hidden sm:inline font-mono font-medium">{t(config.key)}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Global Natural Language Query Trigger */}
        <button
          onClick={onAskClick}
          className="inline-flex items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-surface-hover transition-colors shadow-xs"
          title="Tabiiy tilda savol berish (Bosish yoki / tugmasi)"
        >
          <Sparkles size={14} className="text-ink" />
          <span className="hidden sm:inline">Savol-javob</span>
          <kbd className="hidden sm:inline-block rounded border border-line bg-white px-1.5 py-0.5 font-mono text-[10px] text-text2 font-medium shadow-xs">
            /
          </kbd>
        </button>

        <LanguageSwitcher />

        <button
          onClick={logout}
          className="rounded-md p-1.5 text-text2 hover:bg-surface hover:text-[#DC2626] transition-colors"
          title="Chiqish"
        >
          <LogOut size={16} strokeWidth={1.5} />
        </button>
      </div>
    </header>
  );
}
