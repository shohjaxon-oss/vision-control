import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Command as CommandPrimitive } from 'cmdk';
import {
  Users,
  LayoutGrid,
  Camera,
  FileText,
  Settings,
  UserPlus,
  Globe,
  Search,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const languages = [
  { code: 'uz', label: 'lang.uzLatn' },
  { code: 'uz_cyrl', label: 'lang.uzCyrl' },
  { code: 'ru', label: 'lang.ru' },
  { code: 'en', label: 'lang.en' },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const toggleOpen = useCallback(() => setOpen((o) => !o), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggleOpen();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleOpen]);

  const go = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  const switchLang = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('wfv_lang', lang);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="radius-modal border border-line bg-white p-0 shadow-lg overflow-hidden [&>button:last-child]:hidden">
        <CommandPrimitive className="flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3 bg-surface/50">
            <Search size={18} strokeWidth={1.5} className="text-text2" />
            <CommandPrimitive.Input
              placeholder={t('command.placeholder')}
              className="flex-1 bg-transparent text-sm font-medium text-ink outline-none placeholder:text-muted"
            />
          </div>
          <CommandPrimitive.List className="max-h-[400px] overflow-y-auto p-2">
            <CommandPrimitive.Empty className="p-4 text-center text-sm font-medium text-text2">
              {t('common.error')}
            </CommandPrimitive.Empty>

            <CommandPrimitive.Group heading={t('command.goto')} className="mb-2">
              <CommandItem onSelect={() => go('/')} icon={LayoutGrid} label={t('command.gotoToday')} />
              <CommandItem onSelect={() => go('/employees')} icon={Users} label={t('command.gotoEmployees')} />
              <CommandItem onSelect={() => go('/cameras')} icon={Camera} label={t('command.gotoCameras')} />
              <CommandItem onSelect={() => go('/reports')} icon={FileText} label={t('command.gotoReports')} />
              <CommandItem onSelect={() => go('/settings')} icon={Settings} label={t('command.gotoSettings')} />
            </CommandPrimitive.Group>

            <CommandPrimitive.Group heading={t('command.action')}>
              <CommandItem onSelect={() => go('/employees/new')} icon={UserPlus} label={t('command.addEmployee')} />
            </CommandPrimitive.Group>

            <CommandPrimitive.Group heading={t('command.lang')}>
              {languages.map((lang) => (
                <CommandItem
                  key={lang.code}
                  onSelect={() => switchLang(lang.code)}
                  icon={Globe}
                  label={t(lang.label)}
                />
              ))}
            </CommandPrimitive.Group>
          </CommandPrimitive.List>
        </CommandPrimitive>
      </DialogContent>
    </Dialog>
  );
}

function CommandItem({
  onSelect,
  icon: Icon,
  label,
}: {
  onSelect: () => void;
  icon: typeof Users;
  label: string;
}) {
  return (
    <CommandPrimitive.Item
      onSelect={onSelect}
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-control px-3 py-2 text-sm text-text2 font-medium transition-colors',
        'data-[selected=true]:bg-surface-hover data-[selected=true]:text-ink hover:bg-surface-hover hover:text-ink'
      )}
    >
      <Icon size={18} strokeWidth={1.5} />
      {label}
    </CommandPrimitive.Item>
  );
}
