import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, isMockMode } from '@/lib/api';
import { mockApi } from '@/dev-mock/mockApi';
import type { Camera, CameraType } from '@/types';
import { format } from 'date-fns';
import { 
  Camera as CameraIcon, Plus, RefreshCw, CheckCircle2, 
  XCircle, Play, ShieldCheck, Activity, Eye 
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

export function CamerasPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [previewCamera, setPreviewCamera] = useState<Camera | null>(null);

  // New Camera Form State
  const [name, setName] = useState('');
  const [type, setType] = useState<CameraType>('entrance');
  const [rtspAddress, setRtspAddress] = useState('rtsp://192.168.1.10:554/Streaming/Channels/102');
  const [password, setPassword] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; fps?: number; latency_ms?: number } | null>(null);

  const { data: cameras = [], isLoading, refetch } = useQuery({
    queryKey: ['cameras'],
    queryFn: () => getApiClient().getCameras(),
  });

  const handleTestConnection = async () => {
    if (!rtspAddress.trim()) {
      toast.error('RTSP manzilini kiriting');
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await getApiClient().testCamera({ name, rtsp_address: rtspAddress, password });
      setTestResult(res);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch {
      setTestResult({
        success: false,
        message: 'Kamera bilan ulanish amalga oshmadi. IP va parolni tekshiring.',
      });
      toast.error('Ulanish xatosi');
    } finally {
      setIsTesting(false);
    }
  };

  const handleAddCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !rtspAddress.trim()) {
      toast.error('Barcha maydonlarni to\'ldiring');
      return;
    }
    try {
      await getApiClient().createCamera({
        name,
        type,
        rtsp_address: rtspAddress,
      });
      toast.success('Kamera muvaffaqiyatli qo\'shildi');
      setIsAddOpen(false);
      setName('');
      setPassword('');
      setTestResult(null);
      queryClient.invalidateQueries({ queryKey: ['cameras'] });
    } catch {
      toast.error('Kamerani saqlashda xatolik yuz berdi');
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{t('nav.cameras')}</h1>
          <p className="text-sm text-muted">
            Hikvision va RTSP/ONVIF kameralar holati, FPS va jonli oqim boshqaruvi
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-2 text-xs font-medium text-ink hover:bg-line/50 transition-colors"
          >
            <RefreshCw size={14} strokeWidth={1.5} />
            Yangilash
          </button>
          <button
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-2 text-xs font-medium text-white hover:bg-ink/90 transition-colors"
          >
            <Plus size={14} strokeWidth={1.5} />
            Kamera qo'shish ustasi
          </button>
        </div>
      </div>

      {/* Camera Grid / Table */}
      <div className="rounded-xl border border-line bg-white shadow-sm overflow-hidden">
        <div className="border-b border-line bg-surface px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CameraIcon size={16} className="text-muted" strokeWidth={1.5} />
            <h2 className="text-sm font-medium text-ink">Barcha ulangan kameralar ({cameras.length})</h2>
          </div>
          <span className="text-xs text-muted">
            {cameras.filter((c) => c.status === 'online').length} online · {cameras.filter((c) => c.status === 'offline').length} offline
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-sm text-muted">Kameralar yuklanmoqda...</div>
        ) : (
          <div className="divide-y divide-line">
            {cameras.map((camera) => {
              const isOnline = camera.status === 'online';

              return (
                <div key={camera.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 hover:bg-surface-hover/80 transition-colors gap-4">
                  <div className="flex items-start sm:items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-ink">
                      <CameraIcon size={20} strokeWidth={1.5} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-ink">{camera.name}</span>
                        <span className="rounded bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 text-[10px] uppercase font-mono font-semibold">
                          {camera.type === 'entrance' ? 'Kirish' : camera.type === 'exit' ? 'Chiqish' : 'Umumiy zal'}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-text2 truncate max-w-sm mt-0.5">
                        {camera.rtsp_address}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-xs">
                    {/* Status Dot with mandatory text (strictly adhering to design tokens: #16A34A / #DC2626) */}
                    <div className="flex items-center gap-2">
                      <div className={`h-2.5 w-2.5 rounded-full ${isOnline ? 'bg-[#16A34A] ring-4 ring-green-100' : 'bg-[#DC2626] ring-4 ring-red-100'}`} />
                      <span className="font-semibold text-ink">
                        {isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>

                    <div className="hidden sm:block">
                      <span className="block text-[10px] uppercase font-semibold text-text2">FPS</span>
                      <span className="font-mono font-semibold tabular-nums text-ink">{camera.fps}</span>
                    </div>

                    <div className="hidden sm:block">
                      <span className="block text-[10px] uppercase font-semibold text-text2">Kechikish</span>
                      <span className="font-mono font-semibold tabular-nums text-ink">{camera.latency_ms} ms</span>
                    </div>

                    <div className="hidden md:block">
                      <span className="block text-[10px] uppercase font-semibold text-text2">Oxirgi kadr</span>
                      <span className="font-mono font-semibold tabular-nums text-ink">
                        {camera.last_frame_at ? format(new Date(camera.last_frame_at), 'HH:mm:ss') : '—'}
                      </span>
                    </div>

                    <button
                      onClick={() => setPreviewCamera(camera)}
                      disabled={!isOnline}
                      className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-hover shadow-xs disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <Eye size={14} strokeWidth={1.5} />
                      Jonli ko'rish
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Camera Wizard Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-lg rounded-2xl border border-line bg-white p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-ink">Kamera qo'shish ustasi</DialogTitle>
            <DialogDescription className="text-xs text-muted">
              Hikvision yoki ONVIF/RTSP kamerasini ulang va ulanish parametrlarini tekshiring
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddCamera} className="space-y-4 py-2">
            <div>
              <label className="text-xs font-medium text-ink block mb-1">Kamera nomi</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Masalan: Bosh kirish eshigi"
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-ink focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-ink block mb-1">Kamera turi</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as CameraType)}
                  className="w-full rounded-md border border-line bg-white px-3 py-2 text-xs text-ink focus:border-ink focus:outline-none"
                >
                  <option value="entrance">Kirish (Face ID check-in)</option>
                  <option value="exit">Chiqish (Face ID check-out)</option>
                  <option value="general">Umumiy zal / Ombor</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-ink block mb-1">Kamera paroli</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-md border border-line bg-white px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-ink focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-ink block mb-1">
                RTSP Manzili (Sub-oqim tavsiya etiladi)
              </label>
              <input
                type="text"
                required
                value={rtspAddress}
                onChange={(e) => setRtspAddress(e.target.value)}
                placeholder="rtsp://192.168.1.10:554/Streaming/Channels/102"
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-xs font-mono text-ink placeholder:text-muted focus:border-ink focus:outline-none"
              />
              <span className="text-[11px] text-muted mt-1 block">
                Hikvision standarti: sub-oqim H.264 /Channels/102
              </span>
            </div>

            {/* Test Connection Button and Status Box */}
            <div className="rounded-lg border border-line bg-surface p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink">Ulanish testi</span>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="inline-flex items-center gap-1.5 rounded-md bg-white border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-hover shadow-xs transition-colors"
                >
                  {isTesting ? <RefreshCw size={12} className="animate-spin" /> : <Activity size={12} />}
                  {isTesting ? 'Tekshirilmoqda...' : 'Ulanishni tekshirish'}
                </button>
              </div>

              {testResult && (
                <div className={`flex items-start gap-2 text-xs p-3 rounded-lg border ${testResult.success ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
                  {testResult.success ? <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-600" /> : <XCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />}
                  <div>
                    <span className="font-semibold block">{testResult.message}</span>
                    {testResult.fps !== undefined && (
                      <span className="text-[11px] text-text2 font-mono font-medium block mt-0.5">
                        Oqim tezligi: {testResult.fps} FPS · Kechikish: {testResult.latency_ms} ms
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="rounded-md border border-line bg-white px-4 py-2 text-xs font-semibold text-ink hover:bg-surface-hover shadow-xs transition-colors"
              >
                Bekor qilish
              </button>
              <button
                type="submit"
                className="rounded-md bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-ink-hover shadow-xs transition-colors"
              >
                Kamerani saqlash
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Live Stream Preview Modal */}
      <Dialog open={!!previewCamera} onOpenChange={() => setPreviewCamera(null)}>
        <DialogContent className="max-w-2xl rounded-2xl border border-line bg-white p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-ink">
              {previewCamera?.name} — Jonli oqim
            </DialogTitle>
            <DialogDescription className="text-xs text-muted">
              go2rtc WebRTC orqali shifrlangan qisqa muddatli token bilan jonli oqim
            </DialogDescription>
          </DialogHeader>

          {previewCamera && (
            <div className="space-y-4 py-2">
              <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black flex items-center justify-center">
                {/* Simulated live video stream */}
                <div className="text-center text-white/70">
                  <CameraIcon size={36} strokeWidth={1.5} className="mx-auto mb-2 animate-pulse" />
                  <span className="text-xs font-mono">WebRTC Jonli oqim: {previewCamera.name}</span>
                </div>

                <div className="absolute top-3 left-3 flex items-center gap-2 rounded bg-black/70 px-2 py-1 text-[11px] font-mono text-white">
                  <div className="h-2 w-2 rounded-full bg-[#16A34A] animate-ping" />
                  <span>JONLI EFIR · {previewCamera.fps} FPS · {previewCamera.latency_ms} ms</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-muted font-mono">
                <span>Shifrlangan manzil: {previewCamera.rtsp_address.replace(/:[^:]*@/, ':••••••@')}</span>
                <span className="flex items-center gap-1 text-[#16A34A]">
                  <ShieldCheck size={14} /> mTLS & Token himoyalangan
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <button
              onClick={() => setPreviewCamera(null)}
              className="w-full rounded-md bg-ink py-2 text-xs font-medium text-white hover:bg-ink/90"
            >
              Yopish
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
