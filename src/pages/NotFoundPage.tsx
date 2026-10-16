import { Link } from 'react-router-dom';
import { Home, Compass } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface border border-line text-text2 mb-4 shadow-xs">
        <Compass size={28} />
      </div>
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">404</h1>
      <h2 className="mt-1 text-base font-semibold text-ink">Sahifa topilmadi</h2>
      <p className="mt-2 max-w-sm text-xs text-text2 leading-relaxed">
        Siz qidirayotgan sahifa ko'chirilgan, o'chirilgan yoki manzili noto'g'ri kiritilgan bo'lishi mumkin.
      </p>
      <div className="mt-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-ink-hover shadow-sm transition-colors"
        >
          <Home size={14} />
          Bosh sahifaga qaytish
        </Link>
      </div>
    </div>
  );
}
