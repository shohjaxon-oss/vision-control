import { useState } from 'react';
import { api } from '@/lib/api';
import type { AskResponse } from '@/types';
import { 
  Sparkles, Send, Clock, Camera as CameraIcon 
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

interface AskDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AskDrawer({ open, onOpenChange }: AskDrawerProps) {
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AskResponse | null>(null);
  const [history, setHistory] = useState<Array<{ q: string; res: AskResponse }>>([]);

  const sampleQuestions = [
    'Bekzod bugun ishga keldimi?',
    'Hozir nechta odam ishlayapti?',
    'Tanilmagan shaxslar bormi?',
    'Aziza so\'nggi marta qayerda ko\'rindi?',
  ];

  const handleAsk = async (textToAsk?: string) => {
    const q = textToAsk || question;
    if (!q.trim()) return;

    setIsLoading(true);
    setResult(null);

    try {
      const res = await api.ask(q);
      setResult(res);
      setHistory((prev) => [{ q, res }, ...prev.slice(0, 5)]);
      if (!textToAsk) setQuestion('');
    } catch {
      toast.error('Savolga javob olishda xatolik yuz berdi');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md border-l border-line p-6 flex flex-col justify-between">
        <div className="space-y-6">
          <SheetHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-ink text-white">
                <Sparkles size={14} />
              </div>
              <SheetTitle className="text-lg font-semibold text-ink">
                Tabiiy tilda savol-javob
              </SheetTitle>
            </div>
            <SheetDescription className="text-xs text-muted leading-relaxed">
              Tizim bazadagi real hodisalar va dalillarga tayanib xavfsiz javob beradi. 
              Biometrik ma'lumotlar tashqi servislarga chiqmaydi.
            </SheetDescription>
          </SheetHeader>

          {/* Quick Prompts */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text2">
              Tezkor savollar:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {sampleQuestions.map((sq, i) => (
                <button
                  key={i}
                  onClick={() => handleAsk(sq)}
                  disabled={isLoading}
                  className="rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface-hover shadow-xs transition-colors text-left"
                >
                  {sq}
                </button>
              ))}
            </div>
          </div>

          {/* Answer Area */}
          {isLoading ? (
            <div className="rounded-xl border border-line bg-surface p-6 text-center space-y-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-ink border-t-transparent mx-auto" />
              <p className="text-xs font-medium text-text2">Kamera va davomat bazasi tahlil qilinmoqda...</p>
            </div>
          ) : result ? (
            <div className="rounded-xl border border-line bg-white p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-ink">
                  AI Javobi:
                </span>
                {result.confidence !== null && result.confidence !== undefined && (
                  <span className="text-[11px] font-mono font-semibold text-text2 tabular-nums">
                    {Math.round(result.confidence * 100)}% ishonch
                  </span>
                )}
              </div>

              <p className="text-sm text-ink leading-relaxed font-normal">
                {result.text}
              </p>

              {/* Source Chips */}
              {result.sources && result.sources.length > 0 && (
                <div className="pt-2 border-t border-line space-y-1.5">
                  <span className="text-[10px] uppercase font-mono font-semibold text-text2 block">
                    Tasdiqlangan manbalar (Sources):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {result.sources.map((src, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-mono font-medium text-slate-800"
                      >
                        {src.type === 'camera' ? <CameraIcon size={11} /> : <Clock size={11} />}
                        {src.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Recent History */}
          {history.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-line">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text2">
                So'nggi savollar tarixi:
              </span>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {history.map((h, idx) => (
                  <div
                    key={idx}
                    onClick={() => setResult(h.res)}
                    className="cursor-pointer rounded-md border border-line p-2 hover:bg-surface-hover text-xs transition-colors"
                  >
                    <span className="font-semibold text-ink block truncate">{h.q}</span>
                    <span className="text-[11px] text-text2 font-medium block truncate mt-0.5">{h.res.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="pt-4 border-t border-line">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAsk();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Savolingizni yozing (masalan: Bekzod keldimi?)..."
              disabled={isLoading}
              className="flex-1 rounded-md border border-line bg-white px-3 py-2 text-xs font-medium text-ink placeholder:text-muted focus:border-ink focus:outline-none shadow-xs"
            />
            <button
              type="submit"
              disabled={isLoading || !question.trim()}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-ink text-white hover:bg-ink-hover shadow-xs disabled:opacity-40 transition-colors"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
