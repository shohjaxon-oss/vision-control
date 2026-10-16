import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Globe } from 'lucide-react';

const languages = [
  { code: 'uz', label: 'lang.uzLatn' },
  { code: 'uz_cyrl', label: 'lang.uzCyrl' },
  { code: 'ru', label: 'lang.ru' },
  { code: 'en', label: 'lang.en' },
];

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();

  return (
    <Select
      value={i18n.language}
      onValueChange={(val) => {
        i18n.changeLanguage(val);
        localStorage.setItem('wfv_lang', val);
      }}
    >
      <SelectTrigger className="h-8 w-[140px] text-xs">
        <Globe size={14} strokeWidth={1.5} className="mr-1.5" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {languages.map((lang) => (
          <SelectItem key={lang.code} value={lang.code} className="text-xs">
            {t(lang.label)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
