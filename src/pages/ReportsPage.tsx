import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api, isMockMode } from '@/lib/api';
import { mockApi } from '@/dev-mock/mockApi';
import { format, subDays } from 'date-fns';
import { Download, Printer, Calendar as CalendarIcon, FileSpreadsheet, Filter } from 'lucide-react';
import { toast } from 'sonner';

const getApiClient = () => (isMockMode() ? mockApi : api);

interface ReportRow {
  id: string;
  employee_id: string;
  employee_name: string;
  department?: string;
  date: string;
  first_seen?: string | null;
  last_seen?: string | null;
  status: string;
  late_minutes: number;
  total_present_minutes: number;
}

export function ReportsPage() {
  const { t } = useTranslation();
  const [fromDate, setFromDate] = useState<string>(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  const { data: records = [], isLoading } = useQuery<ReportRow[]>({
    queryKey: ['report', fromDate, toDate],
    queryFn: () => getApiClient().getReport(fromDate, toDate, 'json') as Promise<ReportRow[]>,
  });

  const handleDownloadCSV = () => {
    if (records.length === 0) {
      toast.error('Yuklab olish uchun ma\'lumot yo\'q');
      return;
    }
    const headers = ['Xodim ID', 'Ism Familiya', 'Sana', 'Kelgan vaqti', 'Ketgan vaqti', 'Holati', 'Kechikish (daq)', 'Jami vaqt (daq)'];
    const rows = records.map((r: ReportRow) => [
      r.employee_id,
      `"${r.employee_name}"`,
      r.date,
      r.first_seen ? format(new Date(r.first_seen), 'HH:mm') : '-',
      r.last_seen ? format(new Date(r.last_seen), 'HH:mm') : '-',
      r.status === 'present' ? 'Ishda' : r.status === 'missing' ? 'Ko\'rinmadi' : 'Kelmagan',
      r.late_minutes,
      r.total_present_minutes,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e: (string | number)[]) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `davomat_hisoboti_${fromDate}_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV fayli yuklab olindi');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 p-6 print:p-0">
      {/* Top Header - hidden in print mode */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-4 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{t('nav.reports')}</h1>
          <p className="text-sm text-muted">
            Xodimlar davomati, smena intizomi va ish soatlari bo'yicha rasmiy hisobot
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-2 text-xs font-medium text-ink hover:bg-line/50 transition-colors"
          >
            <Printer size={14} strokeWidth={1.5} />
            Chop etish
          </button>
          <button
            onClick={handleDownloadCSV}
            className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-2 text-xs font-medium text-white hover:bg-ink/90 transition-colors"
          >
            <Download size={14} strokeWidth={1.5} />
            CSV yuklab olish
          </button>
        </div>
      </div>

      {/* Date Filter Bar - hidden in print mode */}
      <div className="rounded-xl border border-line bg-surface p-4 flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <CalendarIcon size={16} className="text-text2" strokeWidth={1.5} />
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-text2">Dan:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-md border border-line bg-white px-2.5 py-1 text-xs font-medium text-ink focus:border-ink focus:outline-none"
            />
            <span className="font-semibold text-text2">Gacha:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-md border border-line bg-white px-2.5 py-1 text-xs font-medium text-ink focus:border-ink focus:outline-none"
            />
          </div>
        </div>

        {/* Quick presets */}
        <div className="flex items-center gap-1 text-xs">
          <button
            onClick={() => {
              const today = format(new Date(), 'yyyy-MM-dd');
              setFromDate(today);
              setToDate(today);
            }}
            className="rounded px-2.5 py-1 hover:bg-white text-text2 font-semibold hover:text-ink transition-colors"
          >
            Bugun
          </button>
          <button
            onClick={() => {
              setFromDate(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
              setToDate(format(new Date(), 'yyyy-MM-dd'));
            }}
            className="rounded px-2.5 py-1 hover:bg-white text-text2 font-semibold hover:text-ink transition-colors"
          >
            Oxirgi 7 kun
          </button>
          <button
            onClick={() => {
              setFromDate(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
              setToDate(format(new Date(), 'yyyy-MM-dd'));
            }}
            className="rounded px-2.5 py-1 hover:bg-white text-text2 font-semibold hover:text-ink transition-colors"
          >
            Shu oy
          </button>
        </div>
      </div>

      {/* Printable Report Header */}
      <div className="hidden print:block mb-6 border-b border-black pb-3">
        <h2 className="text-xl font-bold uppercase tracking-wider text-black">Workforce Vision Platform</h2>
        <p className="text-xs text-gray-700">
          Davomat va Mehnat Intizomi Hisoboti · Oraliq: {fromDate} dan {toDate} gacha
        </p>
      </div>

      {/* Report Table */}
      <div className="rounded-xl border border-line bg-white shadow-xs overflow-hidden print:border-none print:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-line bg-surface text-text2 font-semibold print:bg-transparent print:border-black print:text-black">
              <tr>
                <th className="py-3 px-4 font-semibold">Xodim</th>
                <th className="py-3 px-4 font-semibold">Sana</th>
                <th className="py-3 px-4 font-semibold">Kelgan vaqti</th>
                <th className="py-3 px-4 font-semibold">Oxirgi kadr</th>
                <th className="py-3 px-4 font-semibold">Holat</th>
                <th className="py-3 px-4 font-semibold">Kechikish</th>
                <th className="py-3 px-4 font-semibold text-right">Ish soati</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line print:divide-gray-300">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-text2 font-medium">Yuklanmoqda...</td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-text2 font-medium">Belgilangan oraliqda ma'lumot topilmadi</td>
                </tr>
              ) : (
                records.map((r: any) => (
                  <tr key={r.id} className="hover:bg-surface-hover/70 transition-colors">
                    <td className="py-3 px-4 font-semibold text-ink print:text-black">
                      {r.employee_name}
                    </td>
                    <td className="py-3 px-4 font-mono text-text2 font-medium print:text-black">{r.date}</td>
                    <td className="py-3 px-4 font-mono tabular-nums text-ink font-semibold print:text-black">
                      {r.first_seen ? format(new Date(r.first_seen), 'HH:mm') : '—'}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-ink font-semibold print:text-black">
                      {r.last_seen ? format(new Date(r.last_seen), 'HH:mm') : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1.5 font-semibold ${
                        r.status === 'present' ? 'text-[#16A34A]' : r.status === 'missing' ? 'text-amber-700' : 'text-[#DC2626]'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          r.status === 'present' ? 'bg-[#16A34A]' : r.status === 'missing' ? 'bg-amber-500' : 'bg-[#DC2626]'
                        }`} />
                        {r.status === 'present' ? 'Vaqtida kelgan' : r.status === 'missing' ? 'Kadrda yo\'q' : 'Kelmagan'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-text2 font-medium print:text-black">
                      {r.late_minutes > 0 ? `${r.late_minutes} daqiqa` : '—'}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-right text-ink print:text-black font-semibold">
                      {(r.total_present_minutes / 60).toFixed(1)} soat
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
