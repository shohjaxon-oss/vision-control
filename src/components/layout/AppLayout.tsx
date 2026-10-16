import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { CommandPalette } from '@/components/CommandPalette';
import { AskDrawer } from '@/components/AskDrawer';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { isMockMode } from '@/lib/api';
import { AlertTriangle } from 'lucide-react';

export function AppLayout() {
  const { t } = useTranslation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isAskOpen, setIsAskOpen] = useState(false);
  const mockMode = isMockMode() && import.meta.env.DEV;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/') {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          setIsAskOpen(true);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <aside className="hidden w-60 shrink-0 border-r border-line md:block">
        <Sidebar />
      </aside>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-60 border-r border-line p-0">
          <Sidebar onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar
          onMenuClick={() => setMobileNavOpen(true)}
          onAskClick={() => setIsAskOpen(true)}
        />
        {mockMode && (
          <div className="flex items-center gap-2 bg-yellow-50 px-4 py-1.5 text-xs text-yellow-800 border-b border-yellow-200">
            <AlertTriangle size={14} strokeWidth={1.5} />
            {t('mock.banner')}
          </div>
        )}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <CommandPalette />
      <AskDrawer open={isAskOpen} onOpenChange={setIsAskOpen} />
    </div>
  );
}
