import { useTranslation } from 'react-i18next';
import { Construction } from 'lucide-react';

export function PlaceholderPage({ titleKey, hint }: { titleKey: string; hint?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <Construction size={32} strokeWidth={1.5} className="text-mutedtext" />
      <h1 className="mt-4 text-lg font-semibold tracking-tight">{t(titleKey)}</h1>
      {hint && <p className="mt-1 text-sm text-text2">{hint}</p>}
      <p className="mt-4 text-xs text-mutedtext">Ushbu sahifa keyingi bosqichda tayyor bo'ladi</p>
    </div>
  );
}
