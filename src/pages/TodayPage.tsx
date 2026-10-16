import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { TimelineEvent } from '@/types';
import { format } from 'date-fns';
import { 
  Clock, 
  Camera as CameraIcon, CheckCircle2, XCircle, 
  ZoomIn, ZoomOut
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

export function TodayPage() {
  const { t } = useTranslation();
  const [selectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);
  const [snapshotBlobUrl, setSnapshotBlobUrl] = useState<string | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);

  const { data: attendance = [], isLoading } = useQuery({
    queryKey: ['attendance', selectedDate],
    queryFn: () => api.getAttendance(selectedDate),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.getEmployees(),
  });

  // Calculate Headcount Stats
  const presentCount = attendance.filter((a) => a.status === 'present').length;
  const missingCount = attendance.filter((a) => a.status === 'missing').length;
  const absentCount = employees.length - (presentCount + missingCount);

  // Time axis labels: 08:00 to 20:00
  const hours = Array.from({ length: 13 }, (_, i) => i + 8);

  useEffect(() => {
    if (!isEvidenceOpen && snapshotBlobUrl) {
      URL.revokeObjectURL(snapshotBlobUrl);
      setSnapshotBlobUrl(null);
    }
  }, [isEvidenceOpen, snapshotBlobUrl]);

  const handleEventClick = async (event: TimelineEvent) => {
    setSelectedEvent(event);
    setIsEvidenceOpen(true);
    setLoadingSnapshot(true);
    try {
      const blobUrl = await api.getEventSnapshot(event.id);
      setSnapshotBlobUrl(blobUrl);
    } catch {
      setSnapshotBlobUrl(null);
    } finally {
      setLoadingSnapshot(false);
    }
  };

  const handleFeedback = async (correct: boolean) => {
    if (!selectedEvent) return;
    try {
      await api.submitFeedback(selectedEvent.id, correct);
      toast.success(correct ? "Baholash qabul qilindi: To'g'ri" : "Baholash qabul qilindi: Noto'g'ri");
      setIsEvidenceOpen(false);
    } catch {
      toast.error('Fikr-mulohazani saqlashda xatolik yuz berdi');
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Top Header & Date Navigation */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{t('nav.today')}</h1>
          <p className="text-sm font-medium text-muted">
            {format(new Date(selectedDate), 'EEEE, d-MMMM, yyyy')} · Real vaqtli xodimlar oqimi va kun chizig'i
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoomLevel((z) => Math.max(0.75, z - 0.25))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface text-ink hover:bg-surface-hover transition-colors shadow-xs"
            title="Kichiklashtirish"
          >
            <ZoomOut size={16} strokeWidth={1.5} />
          </button>
          <span className="text-xs font-mono font-semibold tabular-nums text-text2 px-1">{Math.round(zoomLevel * 100)}%</span>
          <button
            onClick={() => setZoomLevel((z) => Math.min(2, z + 0.25))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface text-ink hover:bg-surface-hover transition-colors shadow-xs"
            title="Kattalashtirish"
          >
            <ZoomIn size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Headcount Bar (Non-generic, subtle clean design tokens) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-surface p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text2">Ish joyida</span>
            <div className="h-2.5 w-2.5 rounded-full bg-[#16A34A] ring-4 ring-green-100" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums text-ink">{presentCount}</span>
            <span className="text-xs font-medium text-text2">xodim faol</span>
          </div>
        </div>

        <div className="rounded-lg border border-line bg-surface p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text2">Ko'rinmayapti</span>
            <div className="h-2.5 w-2.5 rounded-full bg-amber-500 ring-4 ring-amber-100" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums text-ink">{missingCount}</span>
            <span className="text-xs font-medium text-text2">10+ daqiqa kadrda yo'q</span>
          </div>
        </div>

        <div className="rounded-lg border border-line bg-surface p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text2">Kelmagan</span>
            <div className="h-2.5 w-2.5 rounded-full bg-[#DC2626] ring-4 ring-red-100" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums text-ink">{Math.max(0, absentCount)}</span>
            <span className="text-xs font-medium text-text2">smenada ko'rinmadi</span>
          </div>
        </div>
      </div>

      {/* Main Interactive Timeline (Kun chizig'i) */}
      <div className="rounded-xl border border-line bg-white shadow-xs overflow-hidden">
        <div className="border-b border-line bg-surface px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-text2" strokeWidth={1.5} />
            <h2 className="text-sm font-semibold text-ink">Kun chizig'i (Timeline)</h2>
          </div>
          <div className="flex items-center gap-4 text-xs text-text2 font-medium">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-6 rounded-sm bg-line border border-slate-300" />
              <span>Smena oralig'i (09:00 - 18:00)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-6 rounded-sm bg-ink" />
              <span className="text-ink font-semibold">Aniqlangan vaqt</span>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-sm font-medium text-text2">Yuklanmoqda...</div>
        ) : (
          <div className="overflow-x-auto p-6" style={{ minWidth: `${100 * zoomLevel}%` }}>
            {/* Timeline Header Hour Marks */}
            <div className="flex border-b border-line pb-2 mb-4 text-xs font-mono font-medium tabular-nums text-text2">
              <div className="w-48 shrink-0 font-sans font-semibold text-ink">Xodim</div>
              <div className="flex-1 flex justify-between px-2">
                {hours.map((h) => (
                  <span key={h} className="text-center w-8">
                    {String(h).padStart(2, '0')}:00
                  </span>
                ))}
              </div>
            </div>

            {/* Employee Timeline Rows */}
            <div className="space-y-4">
              {employees.slice(0, 6).map((emp) => {
                const att = attendance.find((a) => a.employee_id === emp.id);
                const isPresent = att?.status === 'present';
                const isMissing = att?.status === 'missing';

                return (
                  <div key={emp.id} className="flex items-center group hover:bg-surface/50 rounded-md py-1.5 transition-colors">
                    {/* Employee Info Column */}
                    <div className="w-48 shrink-0 pr-4">
                      <div className="text-sm font-medium text-ink truncate">
                        {emp.first_name} {emp.last_name}
                      </div>
                      <div className="text-xs text-muted truncate">{emp.position}</div>
                    </div>

                    {/* Timeline Canvas Bar */}
                    <div className="flex-1 relative h-7 bg-surface rounded border border-line flex items-center px-1">
                      {/* Scheduled Shift Window (09:00 to 18:00 = 8.33% to 83.33%) */}
                      <div 
                        className="absolute top-1 bottom-1 bg-line/60 rounded border border-dashed border-muted/30"
                        style={{ left: '8.33%', width: '75%' }}
                        title="Rejalashtirilgan smena: 09:00 - 18:00"
                      />

                      {/* Actual Presence Blocks (qora rang) */}
                      {isPresent && (
                        <div
                          className="absolute top-1.5 bottom-1.5 bg-ink rounded cursor-pointer hover:opacity-90 transition-opacity"
                          style={{ left: '9.5%', width: '68%' }}
                          onClick={() => handleEventClick({
                            id: `evt-${emp.id}`,
                            employee_id: emp.id,
                            camera_id: 'cam-001',
                            camera_name: 'Bosh kirish',
                            timestamp: att?.first_seen || new Date().toISOString(),
                            event_type: 'seen',
                            confidence: 0.98
                          })}
                          title={`${emp.first_name}: 09:02 dan buyon ishda (Bosib dalilni ko'rish)`}
                        />
                      )}

                      {isMissing && (
                        <div
                          className="absolute top-1.5 bottom-1.5 bg-ink rounded cursor-pointer hover:opacity-90 transition-opacity"
                          style={{ left: '11%', width: '18%' }}
                          onClick={() => handleEventClick({
                            id: `evt-missing-${emp.id}`,
                            employee_id: emp.id,
                            camera_id: 'cam-003',
                            camera_name: 'Sotuv zali',
                            timestamp: att?.last_seen || new Date().toISOString(),
                            event_type: 'seen',
                            confidence: 0.94
                          })}
                          title={`${emp.first_name}: 10:45 da ko'rilgan, hozir kadrda yo'q`}
                        />
                      )}

                      {/* Event Keyframes (Check-in Dots) */}
                      {isPresent && (
                        <button
                          onClick={() => handleEventClick({
                            id: `evt-entry-${emp.id}`,
                            employee_id: emp.id,
                            camera_id: 'cam-001',
                            camera_name: 'Bosh kirish',
                            timestamp: att?.first_seen || new Date().toISOString(),
                            event_type: 'enter',
                            confidence: 0.98
                          })}
                          className="absolute h-3 w-3 rounded-full bg-white border-2 border-ink z-10 hover:scale-125 transition-transform"
                          style={{ left: '9.2%' }}
                          title="Kirish qaydi: 09:02 (Bosib dalilni ko'ring)"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Dalil Oynasi (Evidence Dialog) */}
      <Dialog open={isEvidenceOpen} onOpenChange={setIsEvidenceOpen}>
        <DialogContent className="max-w-md rounded-2xl border border-line bg-white p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-ink">Dalil ko'rinishi (Evidence Snapshot)</DialogTitle>
            <DialogDescription className="text-xs text-muted">
              AI model tomonidan olingan kadr va ishonch koeffitsienti
            </DialogDescription>
          </DialogHeader>

          {selectedEvent && (
            <div className="space-y-4 py-2">
              {/* Snapshot Simulation Frame */}
              <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-surface border border-line flex items-center justify-center">
                {snapshotBlobUrl ? (
                  <img src={snapshotBlobUrl} alt="Snapshot dalili" className="h-full w-full object-cover" />
                ) : loadingSnapshot ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
                    <span className="text-xs text-text2">Snapshot yuklanmoqda...</span>
                  </div>
                ) : (
                  <div className="text-center p-4">
                    <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 text-ink">
                      <CameraIcon size={24} strokeWidth={1.5} />
                    </div>
                    <span className="text-xs font-mono font-medium text-text2">Kamera oqimi: {selectedEvent.camera_name}</span>
                  </div>
                )}

                {/* Bounding Box Visual Overlay */}
                <div className="absolute inset-x-1/4 inset-y-1/6 rounded border border-ink/40 pointer-events-none">
                  <span className="absolute -top-5 left-0 rounded bg-ink px-1.5 py-0.5 text-[10px] font-mono font-medium text-white shadow-xs">
                    {Math.round(selectedEvent.confidence * 100)}% ishonch
                  </span>
                </div>

                <div className="absolute bottom-2 left-2 rounded bg-ink/80 px-2 py-0.5 text-[10px] font-mono text-white">
                  {format(new Date(selectedEvent.timestamp), 'HH:mm:ss · dd/MM/yyyy')}
                </div>
              </div>

              {/* Event Metadata */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-line bg-surface p-2.5">
                  <span className="text-text2 font-semibold block text-[11px] uppercase">Kamera</span>
                  <span className="font-semibold text-ink text-sm">{selectedEvent.camera_name}</span>
                </div>
                <div className="rounded-lg border border-line bg-surface p-2.5">
                  <span className="text-text2 font-semibold block text-[11px] uppercase">Ishonch darajasi</span>
                  <span className="font-semibold text-ink tabular-nums text-sm">
                    {Math.round(selectedEvent.confidence * 100)}% ({selectedEvent.confidence >= 0.9 ? 'Yuqori' : 'O\'rta'})
                  </span>
                </div>
              </div>

              {/* Human-in-the-loop: To'g'ri / Noto'g'ri Feedback */}
              <div className="rounded-lg border border-line p-3 bg-surface">
                <span className="text-xs font-semibold text-ink block mb-2">
                  Ushbu aniqlash to'g'rimi? (AI modelni kalibrovka qilish uchun)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleFeedback(true)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-line bg-white py-2 text-xs font-semibold text-ink hover:bg-surface-hover shadow-xs transition-colors"
                  >
                    <CheckCircle2 size={14} className="text-[#16A34A]" />
                    To'g'ri
                  </button>
                  <button
                    onClick={() => handleFeedback(false)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-line bg-white py-2 text-xs font-semibold text-ink hover:bg-surface-hover shadow-xs transition-colors"
                  >
                    <XCircle size={14} className="text-[#DC2626]" />
                    Noto'g'ri
                  </button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <button
              onClick={() => setIsEvidenceOpen(false)}
              className="w-full rounded-md bg-ink py-2 text-xs font-semibold text-white hover:bg-ink-hover shadow-xs transition-colors"
            >
              Yopish
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
