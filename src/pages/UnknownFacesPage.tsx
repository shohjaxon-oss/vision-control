import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, isMockMode } from '@/lib/api';
import { mockApi } from '@/dev-mock/mockApi';
import type { UnknownFace, Employee } from '@/types';
import { format } from 'date-fns';
import { 
  HelpCircle, Camera as CameraIcon, Link2, 
  UserCheck, EyeOff, CheckCircle2, Clock 
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

const getApiClient = () => (isMockMode() ? mockApi : api);

export function UnknownFacesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedFace, setSelectedFace] = useState<UnknownFace | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'resolved'>('all');

  const { data: unknownFaces = [], isLoading } = useQuery({
    queryKey: ['unknownFaces'],
    queryFn: () => getApiClient().getUnknownFaces(),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => getApiClient().getEmployees(),
  });

  const handleResolve = async (id: string, action: 'link' | 'guest' | 'ignore', employeeId?: string) => {
    try {
      await getApiClient().resolveUnknownFace(id, action, employeeId);
      toast.success(
        action === 'link' 
          ? "Shaxs xodimga muvaffaqiyatli biriktirildi" 
          : action === 'guest' 
          ? "Mehmon sifatida belgilandi" 
          : "E'tiborsiz qoldirildi"
      );
      setSelectedFace(null);
      setSelectedEmployeeId('');
      queryClient.invalidateQueries({ queryKey: ['unknownFaces'] });
    } catch {
      toast.error('Amalni bajarishda xatolik yuz berdi');
    }
  };

  const filteredFaces = unknownFaces.filter((face) => {
    if (filter === 'pending') return face.resolution === 'pending';
    if (filter === 'resolved') return face.resolution !== 'pending';
    return true;
  });

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{t('nav.unknown')}</h1>
          <p className="text-sm text-muted">
            Tizim tanimagan yuzlar kadrlar ro'yxati. Har bir holat insoniy nazoratdan o'tishi shart.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-1">
          <button
            onClick={() => setFilter('all')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === 'all' ? 'bg-white text-ink shadow-xs border border-line' : 'text-text2 hover:text-ink hover:bg-surface-hover'
            }`}
          >
            Hammasi ({unknownFaces.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === 'pending' ? 'bg-white text-ink shadow-xs border border-line' : 'text-text2 hover:text-ink hover:bg-surface-hover'
            }`}
          >
            Kutilmoqda ({unknownFaces.filter((f) => f.resolution === 'pending').length})
          </button>
          <button
            onClick={() => setFilter('resolved')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === 'resolved' ? 'bg-white text-ink shadow-xs border border-line' : 'text-text2 hover:text-ink hover:bg-surface-hover'
            }`}
          >
            Ko'rib chiqilgan ({unknownFaces.filter((f) => f.resolution !== 'pending').length})
          </button>
        </div>
      </div>

      {/* Grid of Unknown Face Cards */}
      {isLoading ? (
        <div className="p-12 text-center text-sm font-medium text-text2">Yuklanmoqda...</div>
      ) : filteredFaces.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line p-12 text-center bg-surface">
          <CheckCircle2 size={32} className="mx-auto mb-3 text-[#16A34A]" strokeWidth={1.5} />
          <h3 className="text-sm font-semibold text-ink">Barcha tanilmagan shaxslar ko'rib chiqilgan</h3>
          <p className="text-xs text-text2 mt-1">Yangi tanilmagan yuz aniqlanganda shu yerda paydo bo'ladi.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredFaces.map((face) => {
            const isPending = face.resolution === 'pending';

            return (
              <div
                key={face.id}
                className="rounded-xl border border-line bg-white shadow-xs overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Snapshot Thumbnail / Box */}
                  <div className="relative aspect-video w-full bg-surface border-b border-line flex items-center justify-center overflow-hidden">
                    <div className="text-center p-4">
                      <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 text-ink">
                        <CameraIcon size={24} strokeWidth={1.5} />
                      </div>
                      <span className="text-xs font-mono font-medium text-text2">{face.camera_name}</span>
                    </div>

                    <div className="absolute top-2 left-2 rounded bg-ink/80 px-2 py-0.5 text-[10px] font-mono text-white flex items-center gap-1 shadow-xs">
                      <Clock size={10} />
                      {format(new Date(face.detected_at), 'HH:mm · dd/MM')}
                    </div>

                    <div className="absolute top-2 right-2">
                      <span
                        className={`rounded px-2.5 py-0.5 text-[10px] uppercase font-mono font-semibold shadow-xs ${
                          isPending
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : face.resolution === 'linked'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : face.resolution === 'guest'
                            ? 'bg-blue-50 text-blue-800 border border-blue-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {face.resolution === 'pending'
                          ? 'Kutilmoqda'
                          : face.resolution === 'linked'
                          ? 'Bog\'langan'
                          : face.resolution === 'guest'
                          ? 'Mehmon'
                          : 'E\'tiborsiz'}
                      </span>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="p-4 space-y-1">
                    <div className="text-sm font-semibold text-ink">Noma'lum shaxs aniqlandi</div>
                    <div className="text-xs text-text2 font-medium">
                      Kamera: <span className="text-ink font-semibold">{face.camera_name}</span>
                    </div>
                  </div>
                </div>

                {/* Actions Bar */}
                <div className="border-t border-line bg-surface p-3 flex items-center gap-2">
                  {isPending ? (
                    <>
                      <button
                        onClick={() => setSelectedFace(face)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-ink py-2 text-xs font-semibold text-white hover:bg-ink-hover shadow-xs transition-colors"
                      >
                        <Link2 size={13} strokeWidth={1.5} />
                        Xodimga bog'lash
                      </button>
                      <button
                        onClick={() => handleResolve(face.id, 'guest')}
                        className="inline-flex items-center justify-center gap-1.5 rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold text-ink hover:bg-surface-hover shadow-xs transition-colors"
                        title="Mehmon deb belgilash"
                      >
                        Mehmon
                      </button>
                      <button
                        onClick={() => handleResolve(face.id, 'ignore')}
                        className="inline-flex items-center justify-center gap-1.5 rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold text-text2 hover:text-ink hover:bg-surface-hover shadow-xs transition-colors"
                        title="E'tiborsiz qoldirish"
                      >
                        <EyeOff size={13} strokeWidth={1.5} />
                      </button>
                    </>
                  ) : (
                    <div className="w-full text-center text-xs text-text2 font-medium py-1">
                      Qaror qabul qilingan: <span className="font-semibold text-ink capitalize">{face.resolution}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Link to Employee Modal */}
      <Dialog open={!!selectedFace} onOpenChange={() => setSelectedFace(null)}>
        <DialogContent className="max-w-md rounded-2xl border border-line bg-white p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-ink">Xodimga bog'lash</DialogTitle>
            <DialogDescription className="text-xs text-muted">
              Ushbu kadr qaysi xodimga tegishli ekanligini tanlang
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-medium text-ink block mb-1">Xodimni tanlang</label>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-xs text-ink focus:border-ink focus:outline-none"
              >
                <option value="">Ro'yxatdan tanlang...</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name} ({emp.position})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <button
              onClick={() => setSelectedFace(null)}
              className="rounded-md border border-line bg-white px-4 py-2 text-xs font-medium text-ink hover:bg-surface"
            >
              Bekor qilish
            </button>
            <button
              onClick={() => {
                if (!selectedFace || !selectedEmployeeId) {
                  toast.error('Xodimni tanlang');
                  return;
                }
                handleResolve(selectedFace.id, 'link', selectedEmployeeId);
              }}
              disabled={!selectedEmployeeId}
              className="rounded-md bg-ink px-4 py-2 text-xs font-medium text-white hover:bg-ink/90 disabled:opacity-40"
            >
              Tasdiqlash va bog'lash
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
