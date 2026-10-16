import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, AlertCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiClientError } from '@/lib/api';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const codeSchema = z.object({
  code: z.string().length(6),
});

type LoginForm = z.infer<typeof loginSchema>;
type CodeForm = z.infer<typeof codeSchema>;

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login, verify2fa, pending2fa } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const codeForm = useForm<CodeForm>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: '' },
  });

  const onLogin = async (data: LoginForm) => {
    setError('');
    setLoading(true);
    try {
      const res = await login(data.email, data.password);
      if (!res.requires2fa) {
        navigate('/');
      }
    } catch (e) {
      if (e instanceof ApiClientError) {
        setError(e.message);
      } else if (e && typeof e === 'object' && 'message' in e) {
        setError((e as { message: string }).message);
      } else {
        setError(t('login.errorInvalid'));
      }
    } finally {
      setLoading(false);
    }
  };

  const onVerify = async (data: CodeForm) => {
    setError('');
    setLoading(true);
    try {
      await verify2fa(data.code);
      navigate('/');
    } catch (e) {
      if (e instanceof ApiClientError) {
        setError(e.message);
      } else if (e && typeof e === 'object' && 'message' in e) {
        setError((e as { message: string }).message);
      } else {
        setError(t('login.error2fa'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <div className="relative hidden flex-1 items-center justify-center overflow-hidden bg-surface md:flex">
        <div className="flex flex-col items-center gap-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-panel border border-line bg-white">
            <Eye size={32} strokeWidth={1.5} />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">Workforce Vision</h1>
            <p className="mt-2 text-sm text-text2">
              Xodimlar davomati va kamera nazorati
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3" aria-hidden>
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="h-20 w-20 rounded-control border border-line bg-white"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.15, duration: 0.4 }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-control bg-ink md:hidden">
                <Eye size={16} strokeWidth={1.5} className="text-white" />
              </div>
              <span className="text-sm font-semibold">Workforce Vision</span>
            </div>
            <LanguageSwitcher />
          </div>

          <AnimatePresence mode="wait">
            {!pending2fa ? (
              <motion.div
                key="login"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <h2 className="text-xl font-semibold tracking-tight">{t('login.title')}</h2>
                <form onSubmit={loginForm.handleSubmit(onLogin)} className="mt-6 space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">{t('login.email')}</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder={t('login.emailPlaceholder')}
                      {...loginForm.register('email')}
                    />
                    {loginForm.formState.errors.email && (
                      <p className="text-xs text-destructive">{t('login.errorInvalid')}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="password">{t('login.password')}</Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder={t('login.passwordPlaceholder')}
                      {...loginForm.register('password')}
                    />
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 rounded-control border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 font-medium shadow-xs">
                      <AlertCircle size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-rose-600" />
                      <span>{error}</span>
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? t('common.loading') : t('login.submit')}
                  </Button>
                </form>

                {import.meta.env.VITE_API_MODE === 'mock' && import.meta.env.DEV && (
                  <p className="mt-4 text-center text-xs text-text2 font-medium">
                    Sinov rejimi: kod — 123456
                  </p>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="2fa"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
              >
                <h2 className="text-xl font-bold tracking-tight text-ink">{t('login.2fa')}</h2>
                <form onSubmit={codeForm.handleSubmit(onVerify)} className="mt-6 space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="code" className="font-semibold text-ink">{t('login.2fa')}</Label>
                    <Input
                      id="code"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder={t('login.2faPlaceholder')}
                      className="text-center text-lg tracking-widest tabular-nums font-semibold text-ink"
                      {...codeForm.register('code')}
                    />
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 rounded-control border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 font-medium shadow-xs">
                      <AlertCircle size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-rose-600" />
                      <span>{error}</span>
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? t('common.loading') : t('login.2faSubmit')}
                  </Button>

                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      codeForm.reset();
                      window.location.reload();
                    }}
                    className="flex items-center gap-1.5 text-xs text-text2 hover:text-ink"
                  >
                    <ArrowLeft size={14} strokeWidth={1.5} />
                    {t('login.back')}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
