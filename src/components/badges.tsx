import { useTranslation } from 'react-i18next';
import type { ConsentStatus, EnrollmentStatus } from '@/types';
import { cn } from '@/lib/utils';

export function ConsentBadge({ status }: { status: ConsentStatus }) {
  const { t } = useTranslation();
  const styles: Record<ConsentStatus, string> = {
    granted: 'border-emerald-200 bg-emerald-50 text-emerald-800 font-medium',
    denied: 'border-rose-200 bg-rose-50 text-rose-800 font-medium',
    revoked: 'border-rose-200 bg-rose-50 text-rose-800 font-medium',
    pending: 'border-amber-200 bg-amber-50 text-amber-800 font-medium',
  };
  const labels: Record<ConsentStatus, string> = {
    granted: 'consent.granted',
    denied: 'consent.denied',
    revoked: 'consent.revoked',
    pending: 'consent.pending',
  };

  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-control border px-2.5 py-0.5 text-xs shadow-xs', styles[status])}>
      {status === 'granted' && <span className="h-2 w-2 rounded-full bg-emerald-600" />}
      {status === 'denied' && <span className="h-2 w-2 rounded-full bg-rose-600" />}
      {status === 'revoked' && <span className="h-2 w-2 rounded-full bg-rose-600" />}
      {status === 'pending' && <span className="h-2 w-2 rounded-full bg-amber-600" />}
      {t(labels[status])}
    </span>
  );
}

export function EnrollmentBadge({ status, samples }: { status: EnrollmentStatus; samples: number }) {
  const { t } = useTranslation();
  const labels: Record<EnrollmentStatus, string> = {
    enrolled: 'enrollment.enrolled',
    partial: 'enrollment.partial',
    none: 'enrollment.none',
  };
  const styles: Record<EnrollmentStatus, string> = {
    enrolled: 'text-ink font-semibold',
    partial: 'text-text2 font-medium',
    none: 'text-muted font-medium',
  };

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs tabular-nums', styles[status])}>
      {t(labels[status])}
      {status !== 'none' && <span className="font-semibold text-text2">({samples}/5)</span>}
    </span>
  );
}
