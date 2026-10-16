import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { ShieldCheck, Copy, Check } from 'lucide-react';

interface Setup2FAModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function Setup2FAModal({ open, onOpenChange, onSuccess }: Setup2FAModalProps) {
  const [loading, setLoading] = useState(false);
  const [setupData, setSetupData] = useState<{ secret: string; otpauth_url: string; backup_codes: string[] } | null>(null);
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      api.setup2fa()
        .then((data) => setSetupData(data))
        .catch(() => toast.error("2FA sozlamalarini yuklab bo'lmadi"))
        .finally(() => setLoading(false));
    } else {
      setCode('');
      setCopied(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!setupData || code.length !== 6) {
      toast.error("6 xonali tasdiqlash kodini to'liq kiriting");
      return;
    }
    setLoading(true);
    try {
      await api.confirm2fa(setupData.secret, code);
      toast.success("2FA muvaffaqiyatli faollashtirildi!");
      onOpenChange(false);
      onSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Tasdiqlash kodi xato";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    if (setupData?.secret) {
      navigator.clipboard.writeText(setupData.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Kalit nusxalandi");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white border border-slate-200 text-slate-900 shadow-xl">
        <DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-900 mb-2">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center text-lg font-bold text-slate-900">
            Ikki bosqichli autentifikatsiyani (2FA) yoqish
          </DialogTitle>
          <DialogDescription className="text-center text-xs text-slate-600 font-medium">
            Hisobingizni himoyalash uchun Google Authenticator yoki boshqa TOTP ilovasidan foydalaning.
          </DialogDescription>
        </DialogHeader>

        {loading && !setupData ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
          </div>
        ) : setupData ? (
          <div className="space-y-4">
            <div className="flex justify-center p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
              <QRCodeSVG value={setupData.otpauth_url} size={160} level="M" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Qo'lda kiritish kaliti:</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-slate-100 px-2.5 py-1.5 font-mono text-xs font-bold text-slate-900 select-all border border-slate-200">
                  {setupData.secret}
                </code>
                <Button type="button" size="sm" variant="outline" onClick={copySecret} className="h-8 border-slate-300">
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">6 xonali tasdiqlash kodi:</label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="text-center font-mono text-lg tracking-widest border-slate-300 focus:border-slate-900"
                maxLength={6}
              />
            </div>

            <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200">
              <span className="block text-[11px] font-bold text-slate-700 mb-1">Zaxira kodlari (saqlab qo'ying):</span>
              <div className="grid grid-cols-2 gap-1 font-mono text-[10px] text-slate-600">
                {setupData.backup_codes.map((c, i) => (
                  <span key={i} className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-center font-semibold">{c}</span>
                ))}
              </div>
            </div>

            <Button
              onClick={handleConfirm}
              disabled={loading || code.length !== 6}
              className="w-full bg-slate-900 text-white hover:bg-slate-800"
            >
              {loading ? "Tasdiqlanmoqda..." : "Faollashtirish"}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
