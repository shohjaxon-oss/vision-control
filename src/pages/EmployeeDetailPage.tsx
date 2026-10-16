import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api, isMockMode } from '@/lib/api';
import { mockApi } from '@/dev-mock/mockApi';
import { ConsentBadge, EnrollmentBadge } from '@/components/badges';
import { format, subDays } from 'date-fns';
import { ArrowLeft, Clock, Calendar as CalendarIcon, ShieldAlert, CheckCircle2, UserX } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

const getApiClient = () => (isMockMode() ? mockApi : api);

export function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isRevokeOpen, setIsRevokeOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');

  const { data: employee, isLoading, refetch } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => getApiClient().getEmployee(id || ''),
    enabled: !!id,
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ['timeline', id],
    queryFn: () => getApiClient().getTimeline(id || '', format(new Date(), 'yyyy-MM-dd')),
    enabled: !!id,
  });

  if (isLoading || !employee) {
    return <div className="p-12 text-center text-sm text-muted">Xodim ma'lumotlari yuklanmoqda...</div>;
  }

  const fullName = `${employee.first_name} ${employee.last_name}`;

  const handleRevokeConsent = async () => {
    if (confirmName.trim().toLowerCase() !== fullName.toLowerCase()) {
      toast.error('Tasdiqlash uchun xodim ismini to\'liq va to\'g\'ri kiriting');
      return;
    }
    try {
      await getApiClient().revokeConsent(employee.id);
      toast.success(t('revoke.success'));
      setIsRevokeOpen(false);
      refetch();
    } catch {
      toast.error('Rozilikni bekor qilishda xatolik yuz berdi');
    }
  };

  // 30 days mock attendance blocks for calendar view
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const d = subDays(new Date(), 29 - i);
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    return {
      date: d,
      status: isWeekend ? 'off' : i % 7 === 2 ? 'late' : i % 9 === 0 ? 'absent' : 'present',
    };
  });

  return (
    <div className="space-y-6 p-6">
      {/* Top back navigation */}
      <button
        onClick={() => navigate('/employees')}
        className="inline-flex items-center gap-2 text-xs font-semibold text-text2 hover:text-ink transition-colors"
      >
        <ArrowLeft size={14} strokeWidth={1.5} />
        Xodimlar ro'yxatiga qaytish
      </button>

      {/* Employee Profile Header */}
      <div className="rounded-xl border border-line bg-surface p-6 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-200 text-lg font-bold text-ink shadow-xs">
              {employee.first_name[0]}{employee.last_name[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-ink">{fullName}</h1>
                <span className="text-xs font-mono font-medium text-text2">ID: {employee.id}</span>
              </div>
              <p className="text-sm font-medium text-text2 mt-0.5">
                {employee.position} · {employee.department} · {employee.phone}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ConsentBadge status={employee.consent_status} />
            <EnrollmentBadge status={employee.enrollment_status} samples={employee.enrollment_samples} />
            {employee.consent_status === 'granted' && (
              <button
                onClick={() => setIsRevokeOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#DC2626]/40 bg-white px-3 py-1.5 text-xs font-semibold text-[#DC2626] hover:bg-red-50 shadow-xs transition-colors"
              >
                <UserX size={14} strokeWidth={1.5} />
                Rozilikni qaytarish
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Punctuality Statistics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-line bg-white p-4 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-text2">Davomat ko'rsatkichi</span>
          <div className="mt-2 text-2xl font-bold tabular-nums text-ink">96%</div>
          <span className="text-xs font-medium text-text2">So'nggi 30 kun ichida</span>
        </div>
        <div className="rounded-lg border border-line bg-white p-4 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-text2">Kechikishlar soni</span>
          <div className="mt-2 text-2xl font-bold tabular-nums text-ink">2 marta</div>
          <span className="text-xs font-medium text-text2">Jami 14 daqiqa kechikkan</span>
        </div>
        <div className="rounded-lg border border-line bg-white p-4 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-text2">O'rtacha ish soati</span>
          <div className="mt-2 text-2xl font-bold tabular-nums text-ink">8.2 soat/kun</div>
          <span className="text-xs font-medium text-text2">Smenaga to'liq mos</span>
        </div>
        <div className="rounded-lg border border-line bg-white p-4 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-text2">Biometrik holat</span>
          <div className="mt-2 text-2xl font-bold tabular-nums text-ink">
            {employee.enrollment_samples}/5 namuna
          </div>
          <span className="text-xs font-medium text-text2">OpenCV SFace 128-d</span>
        </div>
      </div>

      {/* Monthly Attendance Calendar */}
      <div className="rounded-xl border border-line bg-white p-6">
        <div className="flex items-center justify-between border-b border-line pb-4 mb-4">
          <div className="flex items-center gap-2">
            <CalendarIcon size={16} className="text-muted" strokeWidth={1.5} />
            <h2 className="text-sm font-medium text-ink">Oylik davomat kalendari (30 kun)</h2>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#16A34A]" /> Vaqtida
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-yellow-500" /> Kechikkan
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#DC2626]" /> Kelmagan
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-line" /> Dam olish kuni
            </span>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {last30Days.map((item, idx) => (
            <div
              key={idx}
              className={`rounded-lg border p-3 text-xs transition-colors ${
                item.status === 'present'
                  ? 'border-[#16A34A]/20 bg-green-50/40 text-ink'
                  : item.status === 'late'
                  ? 'border-yellow-200 bg-yellow-50/50 text-ink'
                  : item.status === 'absent'
                  ? 'border-red-200 bg-red-50/40 text-ink'
                  : 'border-line bg-surface text-muted'
              }`}
            >
              <div className="font-mono tabular-nums text-muted">{format(item.date, 'dd MMM')}</div>
              <div className="mt-1 font-medium">
                {item.status === 'present'
                  ? '09:02'
                  : item.status === 'late'
                  ? '09:12'
                  : item.status === 'absent'
                  ? 'Kelmagan'
                  : 'Dam olish'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Revoke Consent Modal */}
      <Dialog open={isRevokeOpen} onOpenChange={setIsRevokeOpen}>
        <DialogContent className="max-w-md rounded-2xl border border-line bg-white p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[#DC2626] flex items-center gap-2">
              <ShieldAlert size={20} />
              {t('revoke.title')}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted pt-2 leading-relaxed">
              O'zbekiston Qonunchiligi (ZRU-1125) talabiga asosan: rozilik qaytarilganda xodimning 
              <strong className="text-ink"> barcha yuz embeddinglari bazadan butunlay o'chiriladi</strong> va qayta tiklab bo'lmaydi.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <label className="text-xs font-medium text-ink block">
              Tasdiqlash uchun xodim ismini yozing: <span className="font-semibold text-ink">{fullName}</span>
            </label>
            <input
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={fullName}
              className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-ink focus:outline-none"
            />
          </div>

          <DialogFooter className="gap-2">
            <button
              onClick={() => setIsRevokeOpen(false)}
              className="rounded-md border border-line bg-white px-4 py-2 text-xs font-medium text-ink hover:bg-surface"
            >
              Bekor qilish
            </button>
            <button
              onClick={handleRevokeConsent}
              className="rounded-md bg-[#DC2626] px-4 py-2 text-xs font-medium text-white hover:bg-red-700"
            >
              Yuz ma'lumotlarini butunlay o'chirish
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
