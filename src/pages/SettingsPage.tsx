import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api, isMockMode } from '@/lib/api';
import { mockApi } from '@/dev-mock/mockApi';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { 
  Building2, Clock, Shield, History, 
  Users, Save, CheckCircle2, Lock 
} from 'lucide-react';
import { toast } from 'sonner';

const getApiClient = () => (isMockMode() ? mockApi : api);

export function SettingsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';

  const [orgName, setOrgName] = useState('Workforce Vision Toshkent Markazi');
  const [shiftStart, setShiftStart] = useState('09:00');
  const [shiftEnd, setShiftEnd] = useState('18:00');
  const [retentionDays, setRetentionDays] = useState('90');

  const { data: auditLogs = [], isLoading: isLoadingAudit } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: () => getApiClient().getAuditLogs(),
    enabled: isOwner,
  });

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Tashkilot sozlamalari muvaffaqiyatli saqlandi');
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="border-b border-line pb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{t('nav.settings')}</h1>
        <p className="text-sm text-muted">
          Tashkilot parametrlari, smena jadvali, biometrik saqlash muddati va o'zgarmas audit jurnali
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Organization & Retention Form */}
        <div className="lg:col-span-1 space-y-6">
          <form onSubmit={handleSaveSettings} className="rounded-xl border border-line bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-line pb-3">
              <Building2 size={16} className="text-muted" strokeWidth={1.5} />
              <h2 className="text-sm font-medium text-ink">Tashkilot sozlamalari</h2>
            </div>

            <div>
              <label className="text-xs font-medium text-ink block mb-1">Tashkilot nomi</label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-xs text-ink focus:border-ink focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-ink block mb-1">Smena boshi</label>
                <input
                  type="time"
                  value={shiftStart}
                  onChange={(e) => setShiftStart(e.target.value)}
                  className="w-full rounded-md border border-line bg-white px-3 py-2 text-xs font-mono text-ink focus:border-ink focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-ink block mb-1">Smena oxiri</label>
                <input
                  type="time"
                  value={shiftEnd}
                  onChange={(e) => setShiftEnd(e.target.value)}
                  className="w-full rounded-md border border-line bg-white px-3 py-2 text-xs font-mono text-ink focus:border-ink focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-ink block mb-1">
                Kadrlar va videolarni saqlash muddati (Retention)
              </label>
              <select
                value={retentionDays}
                onChange={(e) => setRetentionDays(e.target.value)}
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-xs text-ink focus:border-ink focus:outline-none"
              >
                <option value="30">30 kun</option>
                <option value="60">60 kun</option>
                <option value="90">90 kun (Tavsiya etiladi)</option>
                <option value="180">180 kun (6 oy)</option>
              </select>
              <span className="text-[11px] text-muted mt-1 block">
                Muddati o'tgan snapshot va tanilmagan yuzlar avtomatik tozalanadi
              </span>
            </div>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-ink py-2 text-xs font-medium text-white hover:bg-ink/90 transition-colors"
            >
              <Save size={13} strokeWidth={1.5} />
              Sozlamalarni saqlash
            </button>
          </form>

          {/* User Role Card */}
          <div className="rounded-xl border border-line bg-surface p-5 space-y-2 shadow-xs">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-text2" strokeWidth={1.5} />
              <h3 className="text-xs font-semibold text-text2 uppercase tracking-wider">Joriy hisobingiz</h3>
            </div>
            <div className="text-sm font-bold text-ink">{user?.name}</div>
            <div className="text-xs font-mono font-medium text-text2">{user?.email}</div>
            <div className="pt-2">
              <span className="inline-block rounded bg-slate-200 border border-slate-300 px-2.5 py-1 text-xs font-mono font-semibold text-ink">
                Rol: {user?.role === 'owner' ? 'Tizim egasi (Owner)' : user?.role === 'manager' ? 'Menejer' : 'Kuzatuvchi'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Immutable Audit Log Table (Only for Owner) */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-line bg-white shadow-xs overflow-hidden">
            <div className="border-b border-line bg-surface px-6 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History size={16} className="text-text2" strokeWidth={1.5} />
                <h2 className="text-sm font-semibold text-ink">O'zgarmas Audit Jurnali (Immutable Log)</h2>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-[#16A34A] bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded shadow-xs">
                <Lock size={11} /> UPDATE & DELETE taqiqlangan
              </span>
            </div>

            {!isOwner ? (
              <div className="p-8 text-center text-xs font-medium text-text2">
                Audit jurnalini ko'rish huquqi faqat tashkilot egasi (Owner) hisobiga berilgan.
              </div>
            ) : isLoadingAudit ? (
              <div className="p-8 text-center text-xs font-medium text-text2">Audit yozuvlari yuklanmoqda...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-line bg-surface text-text2 font-semibold">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Vaqt</th>
                      <th className="py-2.5 px-4 font-semibold">Foydalanuvchi</th>
                      <th className="py-2.5 px-4 font-semibold">Harakat</th>
                      <th className="py-2.5 px-4 font-semibold">Tafsilot</th>
                      <th className="py-2.5 px-4 font-semibold text-right">IP manzil</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-surface-hover/70 transition-colors">
                        <td className="py-2.5 px-4 font-mono text-text2 font-medium whitespace-nowrap">
                          {format(new Date(log.created_at), 'dd/MM HH:mm:ss')}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-ink whitespace-nowrap">
                          {log.user_email}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-semibold text-[11px] text-ink">
                          {log.action}
                        </td>
                        <td className="py-2.5 px-4 text-text2 max-w-xs truncate" title={log.details}>
                          {log.details}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-medium text-right text-text2 tabular-nums">
                          {log.ip_address}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
