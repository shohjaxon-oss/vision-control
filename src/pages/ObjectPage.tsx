import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api, isMockMode } from '@/lib/api';
import { mockApi } from '@/dev-mock/mockApi';
import type { Camera } from '@/types';
import { format } from 'date-fns';
import { 
  Building, Camera as CameraIcon, Eye, Activity, 
  RotateCcw, ShieldCheck, Layers, Info 
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

const getApiClient = () => (isMockMode() ? mockApi : api);

export function ObjectPage() {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [rotationAngle, setRotationAngle] = useState(45);
  const [zoom, setZoom] = useState(1);

  const { data: cameras = [], isLoading } = useQuery({
    queryKey: ['cameras'],
    queryFn: () => getApiClient().getCameras(),
  });

  // Camera Spatial Coordinates on Building Model
  const cameraNodes = [
    { id: 'cam-001', x: 260, y: 320, z: 20, angle: 45, range: 70, name: 'Bosh kirish' },
    { id: 'cam-002', x: 540, y: 310, z: 20, angle: 135, range: 65, name: 'Chiqish eshigi' },
    { id: 'cam-003', x: 380, y: 220, z: 80, angle: 90, range: 90, name: 'Sotuv zali' },
    { id: 'cam-004', x: 490, y: 160, z: 80, angle: 220, range: 60, name: 'Ombor' },
  ];

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
    ctx.translate(-width / 2, -height / 2);

    // 1. Draw Grid Base
    ctx.strokeStyle = '#E4E4E4';
    ctx.lineWidth = 1;
    for (let x = 100; x <= 700; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 100);
      ctx.lineTo(x, 500);
      ctx.stroke();
    }
    for (let y = 100; y <= 500; y += 40) {
      ctx.beginPath();
      ctx.moveTo(100, y);
      ctx.lineTo(700, y);
      ctx.stroke();
    }

    // 2. Draw Isometric Building Blocks (Floor 1 & Floor 2)
    // Ground Floor: Main Hall & Entrance
    ctx.fillStyle = '#F8FAFC';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;

    // Room 1: Entrance Lobby
    ctx.beginPath();
    ctx.rect(200, 240, 180, 140);
    ctx.fill();
    ctx.stroke();

    // Room 2: Main Sales Floor
    ctx.beginPath();
    ctx.rect(380, 180, 240, 200);
    ctx.fill();
    ctx.stroke();

    // Room 3: Warehouse / Back office
    ctx.beginPath();
    ctx.rect(460, 120, 160, 80);
    ctx.fill();
    ctx.stroke();

    // Room Labels
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('1-ZAL (KIRISH)', 220, 260);
    ctx.fillText('2-ZAL (SOTUV)', 400, 205);
    ctx.fillText('OMBORXONA', 475, 145);

    // 3. Draw Cameras and Vision Cones
    cameraNodes.forEach((node) => {
      const cam = cameras.find((c) => c.id === node.id);
      const isOnline = cam ? cam.status === 'online' : true;

      // Draw Vision Cone
      ctx.save();
      ctx.translate(node.x, node.y);
      const rad = (node.angle * Math.PI) / 180;
      ctx.rotate(rad);

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, node.range, -0.4, 0.4);
      ctx.closePath();
      ctx.fillStyle = isOnline ? 'rgba(15, 23, 42, 0.08)' : 'rgba(100, 116, 139, 0.05)';
      ctx.fill();
      ctx.strokeStyle = isOnline ? 'rgba(15, 23, 42, 0.4)' : 'rgba(100, 116, 139, 0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();

      // Draw Camera Body
      ctx.beginPath();
      ctx.arc(node.x, node.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = isOnline ? '#0F172A' : '#64748B';
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Camera label badge
      ctx.fillStyle = isOnline ? '#0F172A' : '#64748B';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(node.name, node.x - 20, node.y - 12);
    });

    ctx.restore();
  }, [cameras, zoom, rotationAngle]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / zoom;
    const clickY = (e.clientY - rect.top) / zoom;

    // Check hit test for camera nodes
    for (const node of cameraNodes) {
      const dist = Math.hypot(node.x - clickX, node.y - clickY);
      if (dist <= 25) {
        const cam = cameras.find((c) => c.id === node.id) || {
          id: node.id,
          name: node.name,
          type: 'general' as const,
          status: 'online' as const,
          fps: 25,
          latency_ms: 45,
          last_frame_at: new Date().toISOString(),
          rtsp_address: 'rtsp://192.168.1.10:554/stream1',
          organization_id: 'org-001'
        };
        setSelectedCamera(cam);
        return;
      }
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{t('nav.object')}</h1>
          <p className="text-sm text-muted">
            Bino izometrik 3D xaritasi va kameralarning fazoviy ko'rish konuslari
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom((z) => Math.max(0.7, z - 0.15))}
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-line/50 transition-colors"
          >
            Kichiklashtirish
          </button>
          <button
            onClick={() => setZoom(1)}
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-line/50 transition-colors"
          >
            100%
          </button>
          <button
            onClick={() => setZoom((z) => Math.min(1.6, z + 0.15))}
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-line/50 transition-colors"
          >
            Kattalashtirish
          </button>
        </div>
      </div>

      {/* 3D Map Container */}
      <div className="relative rounded-2xl border border-line bg-white shadow-sm overflow-hidden flex flex-col items-center justify-center p-4">
        {/* Helper Badge */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2 rounded-lg border border-line bg-white/95 backdrop-blur-sm px-3.5 py-2 text-xs text-text2 font-medium shadow-xs">
          <Info size={14} className="text-ink" />
          <span>Kamerani tekshirish uchun ustiga bosing</span>
        </div>

        {/* Legend */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-4 rounded-lg border border-line bg-white/95 backdrop-blur-sm px-3.5 py-2 text-xs shadow-xs">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-ink" />
            <span className="text-ink font-semibold">Online kamera</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
            <span className="text-text2 font-medium">Offline kamera</span>
          </div>
        </div>

        {/* Isometric Canvas */}
        <canvas
          ref={canvasRef}
          width={800}
          height={540}
          onClick={handleCanvasClick}
          className="cursor-crosshair max-w-full h-auto"
        />
      </div>

      {/* Selected Camera Inspect Sheet */}
      <Sheet open={!!selectedCamera} onOpenChange={() => setSelectedCamera(null)}>
        <SheetContent side="right" className="w-80 sm:w-96 border-l border-line p-6">
          <SheetHeader>
            <SheetTitle className="text-lg font-semibold text-ink flex items-center gap-2">
              <CameraIcon size={18} strokeWidth={1.5} />
              {selectedCamera?.name}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted">
              Fazoviy joylashuv va jonli ko'rish oqimi
            </SheetDescription>
          </SheetHeader>

          {selectedCamera && (
            <div className="space-y-5 py-6">
              {/* Mini Video Feed */}
              <div className="relative aspect-video w-full rounded-xl bg-surface border border-line flex items-center justify-center overflow-hidden">
                <div className="text-center text-text2">
                  <CameraIcon size={32} className="mx-auto mb-1 animate-pulse text-ink" strokeWidth={1.5} />
                  <span className="text-xs font-mono font-medium">go2rtc WebRTC oqimi</span>
                </div>
                <div className="absolute top-2 left-2 rounded bg-ink/80 px-2 py-0.5 text-[10px] font-mono text-white">
                  JONLI
                </div>
              </div>

              {/* Status details */}
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between border-b border-line pb-2">
                  <span className="text-text2 font-semibold">Holati</span>
                  <span className="flex items-center gap-1.5 font-semibold text-ink">
                    <span className={`h-2.5 w-2.5 rounded-full ${selectedCamera.status === 'online' ? 'bg-[#16A34A] ring-4 ring-green-100' : 'bg-[#DC2626] ring-4 ring-red-100'}`} />
                    {selectedCamera.status === 'online' ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-line pb-2">
                  <span className="text-text2 font-semibold">Kamera turi</span>
                  <span className="font-mono uppercase font-semibold text-ink">{selectedCamera.type}</span>
                </div>
                <div className="flex items-center justify-between border-b border-line pb-2">
                  <span className="text-text2 font-semibold">Kadrlar tezligi</span>
                  <span className="font-mono font-semibold text-ink tabular-nums">{selectedCamera.fps} FPS</span>
                </div>
                <div className="flex items-center justify-between border-b border-line pb-2">
                  <span className="text-text2 font-semibold">Tarmoq kechikishi</span>
                  <span className="font-mono font-semibold text-ink tabular-nums">{selectedCamera.latency_ms} ms</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text2 font-semibold">Protokol</span>
                  <span className="font-mono font-semibold text-ink">RTSP / H.264</span>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
