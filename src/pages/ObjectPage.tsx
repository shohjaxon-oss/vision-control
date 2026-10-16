import { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Camera } from '@/types';
import { 
  Camera as CameraIcon, 
  Info, ZoomIn, ZoomOut, RotateCw
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

export function ObjectPage() {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [rotationAngle, setRotationAngle] = useState(0);
  const [zoom, setZoom] = useState(1);

  const { data: cameras = [] } = useQuery({
    queryKey: ['cameras'],
    queryFn: () => api.getCameras(),
  });

  // Dynamically map cameras from API with their 3D positions
  const cameraNodes = useMemo(() => {
    return cameras.map((c, idx) => {
      const defaultPositions = [
        { x: 260, y: 320, z: 20, angle: 45, range: 70 },
        { x: 540, y: 310, z: 20, angle: 135, range: 65 },
        { x: 380, y: 220, z: 80, angle: 90, range: 90 },
        { x: 490, y: 160, z: 80, angle: 220, range: 60 },
      ];
      const fallback = defaultPositions[idx % defaultPositions.length];
      return {
        id: c.id,
        name: c.name,
        type: c.type,
        status: c.status,
        x: c.position?.x && c.position.x > 0 ? c.position.x : fallback.x,
        y: c.position?.y && c.position.y > 0 ? c.position.y : fallback.y,
        angle: c.position?.yaw || fallback.angle,
        range: c.position?.fov || fallback.range,
        raw: c,
      };
    });
  }, [cameras]);

  // Render 2.5D / Isometric Canvas with Building Wireframe & Cones
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(zoom, zoom);
    ctx.rotate((rotationAngle * Math.PI) / 180);
    ctx.translate(-width / 2, -height / 2);

    // 1. Draw Grid Base
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    for (let x = 50; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 50);
      ctx.lineTo(x, height - 50);
      ctx.stroke();
    }
    for (let y = 50; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(50, y);
      ctx.lineTo(width - 50, y);
      ctx.stroke();
    }

    // 2. Draw Floor Plan (Clean Architectural Wireframe)
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(150, 100, 500, 300);

    // Interior walls & rooms
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(350, 100);
    ctx.lineTo(350, 400);
    ctx.moveTo(150, 250);
    ctx.lineTo(350, 250);
    ctx.stroke();

    // Room Labels
    ctx.fillStyle = '#64748B';
    ctx.font = '600 11px sans-serif';
    ctx.fillText('KIRISH ZONASI (A)', 170, 130);
    ctx.fillText('OMBOR (B)', 170, 280);
    ctx.fillText('ASOSIY ZAL & OFIS (C)', 370, 130);

    // 3. Draw Camera Nodes & Vision FOV Cones
    cameraNodes.forEach((cam) => {
      const isOnline = cam.status === 'online';

      // FOV Arc / Cone
      const rad = (cam.angle * Math.PI) / 180;
      const fovRad = (cam.range * Math.PI) / 180;

      ctx.save();
      ctx.translate(cam.x, cam.y);

      // Vision Coverage Gradient Cone
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 90, rad - fovRad / 2, rad + fovRad / 2);
      ctx.closePath();

      ctx.fillStyle = isOnline ? 'rgba(15, 23, 42, 0.08)' : 'rgba(100, 116, 139, 0.04)';
      ctx.fill();

      ctx.strokeStyle = isOnline ? '#0F172A' : '#94A3B8';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Camera Dot Marker
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fillStyle = isOnline ? '#0F172A' : '#94A3B8';
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.restore();

      // Camera Name Tag
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(cam.name, cam.x - 20, cam.y - 12);
    });

    ctx.restore();
  }, [cameraNodes, rotationAngle, zoom]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / zoom;
    const clickY = (e.clientY - rect.top) / zoom;

    // Check hit radius
    const hit = cameraNodes.find(
      (c) => Math.hypot(c.x - clickX, c.y - clickY) < 25
    );

    if (hit) {
      setSelectedCamera(hit.raw);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">{t('nav.object')}</h1>
          <p className="text-sm font-medium text-muted">
            Binoning me'moriy xaritasi va kameralar ko'rish burchagi (FOV)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setRotationAngle((r) => (r + 45) % 360)}
            className="inline-flex h-9 items-center gap-1.5 px-3 rounded-md border border-line bg-surface text-ink hover:bg-surface-hover transition-colors text-xs font-semibold shadow-xs"
            title="Aylantirish"
          >
            <RotateCw size={14} />
            {rotationAngle}°
          </button>

          <button
            onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface text-ink hover:bg-surface-hover transition-colors shadow-xs"
            title="Kichiklashtirish"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs font-mono font-bold tabular-nums text-text2 px-1">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(2.0, z + 0.2))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface text-ink hover:bg-surface-hover transition-colors shadow-xs"
            title="Kattalashtirish"
          >
            <ZoomIn size={16} />
          </button>
        </div>
      </div>

      {/* Main Architectural Canvas */}
      <div className="relative rounded-2xl border border-line bg-white shadow-xs overflow-hidden flex items-center justify-center p-4">
        <canvas
          ref={canvasRef}
          width={800}
          height={500}
          onClick={handleCanvasClick}
          className="cursor-crosshair max-w-full h-auto"
        />

        <div className="absolute bottom-4 left-4 rounded-lg border border-line bg-white/90 backdrop-blur-xs p-3 text-xs space-y-1.5 shadow-xs">
          <span className="font-bold text-ink block mb-1">Xarita belgilari:</span>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-900" />
            <span className="text-text2 font-medium">Faol kamera (Online FOV)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
            <span className="text-text2 font-medium">O'chiq kamera (Offline)</span>
          </div>
        </div>
      </div>

      {/* Camera Detail Sheet */}
      <Sheet open={!!selectedCamera} onOpenChange={(open) => !open && setSelectedCamera(null)}>
        <SheetContent className="sm:max-w-md bg-white border-l border-line p-6">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold text-ink flex items-center gap-2">
              <CameraIcon size={20} />
              {selectedCamera?.name}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted">
              Kameraning real vaqt holati va fazoviy parametrlari
            </SheetDescription>
          </SheetHeader>

          {selectedCamera && (
            <div className="mt-6 space-y-4 text-xs font-medium">
              <div className="rounded-lg border border-line p-3 bg-surface space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted">Holat:</span>
                  <span className={`font-bold ${selectedCamera.status === 'online' ? 'text-emerald-700' : 'text-slate-500'}`}>
                    {selectedCamera.status.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Turi:</span>
                  <span className="font-semibold text-ink uppercase">{selectedCamera.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">FPS / Kechikish:</span>
                  <span className="font-mono text-ink">{selectedCamera.fps} FPS · {selectedCamera.latency_ms} ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">RTSP:</span>
                  <span className="font-mono text-slate-700 truncate max-w-[200px]">
                    {selectedCamera.rtsp_masked || selectedCamera.rtsp_address}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-line p-3 bg-white space-y-2">
                <span className="font-bold text-ink flex items-center gap-1.5">
                  <Info size={14} /> Koordinatalar & FOV
                </span>
                <div className="grid grid-cols-2 gap-2 font-mono text-[11px] text-text2 pt-1">
                  <div>X: {selectedCamera.position?.x || 260}px</div>
                  <div>Y: {selectedCamera.position?.y || 320}px</div>
                  <div>Burchak: {selectedCamera.position?.yaw || 45}°</div>
                  <div>Qamrov (FOV): {selectedCamera.position?.fov || 70}°</div>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
