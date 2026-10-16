import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { callApi } from '@/lib/apiFacade';
import type { Employee, EnrollmentSample, Camera as CameraType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Check, AlertCircle, Camera as CameraIcon, ArrowRight, ArrowLeft, ScanFace } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';

const steps = ['add.step1', 'add.step2', 'add.step3'] as const;

interface FormData {
  first_name: string;
  last_name: string;
  position: string;
  department: string;
  phone: string;
}

export function AddEmployeePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [consentGranted, setConsentGranted] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [samples, setSamples] = useState<EnrollmentSample[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    defaultValues: { first_name: '', last_name: '', position: '', department: '', phone: '' },
  });

  const { data: cameras } = useQuery<CameraType[]>({
    queryKey: ['cameras'],
    queryFn: () => callApi<CameraType[]>((a) => a.getCameras()),
  });

  const onlineCameras = cameras?.filter((c: CameraType) => c.status === 'online') || [];

  const formData = watch();

  const onStep1Submit = (data: FormData) => {
    setStep(1);
  };

  const captureSample = async () => {
    if (!selectedCamera) return;
    setCapturing(true);
    try {
      const res = await callApi<{ sample: EnrollmentSample; samples_count: number }>((a) =>
        a.captureEnrollment('temp', selectedCamera)
      );
      setSamples((prev) => [...prev, res.sample]);
      if (res.sample.status === 'rejected') {
        toast.error(t(`add.quality${res.sample.quality_issues[0]?.split(' ')[0] === 'Rasm' ? 'Blur' : 'Dark'}`));
      } else {
        toast.success(t('add.qualityOk'));
      }
    } catch {
      toast.error(t('common.error'));
    } finally {
      setCapturing(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const newEmp: Partial<Employee> = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        position: formData.position,
        department: formData.department,
        phone: formData.phone,
        consent_status: consentGranted ? 'granted' : 'pending',
        consent_date: consentGranted ? new Date().toISOString() : null,
        enrollment_status: samples.filter((s) => s.status === 'captured').length >= 5 ? 'enrolled' : samples.length > 0 ? 'partial' : 'none',
        enrollment_samples: samples.filter((s) => s.status === 'captured').length,
      };
      await callApi((a) => a.createEmployee(newEmp));
      toast.success(t('add.saved'));
      navigate('/employees');
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const canGoNext = step === 0 || (step === 1 && true) || (step === 2);
  const capturedCount = samples.filter((s) => s.status === 'captured').length;

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">{t('add.title')}</h1>

        <div className="mt-4 flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold transition-colors',
                  i < step && 'border-ink bg-ink text-white',
                  i === step && 'border-ink bg-surface text-ink',
                  i > step && 'border-line text-muted'
                )}
              >
                {i < step ? <Check size={14} strokeWidth={1.5} /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className={cn('h-px w-8', i < step ? 'bg-ink' : 'bg-line')} />
              )}
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs font-semibold text-text2">{t(steps[step])}</p>
      </div>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.form
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            onSubmit={handleSubmit(onStep1Submit)}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="first_name">{t('add.firstName')}</Label>
                <Input id="first_name" {...register('first_name', { required: true })} />
                {errors.first_name && <p className="text-xs text-destructive">{t('common.error')}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="last_name">{t('add.lastName')}</Label>
                <Input id="last_name" {...register('last_name', { required: true })} />
                {errors.last_name && <p className="text-xs text-destructive">{t('common.error')}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="position">{t('add.position')}</Label>
              <Input id="position" {...register('position', { required: true })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="department">{t('add.department')}</Label>
              <Input id="department" {...register('department', { required: true })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">{t('add.phone')}</Label>
              <Input id="phone" type="tel" {...register('phone')} />
            </div>
            <div className="flex justify-end pt-4">
              <Button type="submit">
                {t('add.step2')}
                <ArrowRight size={16} strokeWidth={1.5} />
              </Button>
            </div>
          </motion.form>
        )}

        {step === 1 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div className="rounded-panel border border-line bg-surface p-4 shadow-xs">
              <p className="text-sm font-semibold text-ink">{t('add.consentHint')}</p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setConsentGranted(true)}
                  className={cn(
                    'flex-1 rounded-control border px-4 py-3 text-sm transition-colors',
                    consentGranted
                      ? 'border-emerald-600 bg-emerald-600 text-white font-semibold shadow-xs'
                      : 'border-line bg-white text-text2 hover:bg-surface-hover font-medium'
                  )}
                >
                  <Check size={16} strokeWidth={1.5} className="mx-auto mb-1" />
                  {t('add.consentGrant')}
                </button>
                <button
                  onClick={() => setConsentGranted(false)}
                  className={cn(
                    'flex-1 rounded-control border px-4 py-3 text-sm transition-colors',
                    !consentGranted
                      ? 'border-slate-400 bg-white text-ink font-semibold shadow-xs'
                      : 'border-line bg-white text-text2 hover:bg-surface-hover font-medium'
                  )}
                >
                  <AlertCircle size={16} strokeWidth={1.5} className="mx-auto mb-1" />
                  {t('add.consentNone')}
                </button>
              </div>
            </div>

            {!consentGranted && (
              <div className="flex items-start gap-2 rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 font-medium shadow-xs">
                <AlertCircle size={14} strokeWidth={1.5} className="mt-0.5 shrink-0 text-amber-600" />
                {t('add.consentRequired')}
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(0)}>
                <ArrowLeft size={16} strokeWidth={1.5} />
                {t('add.step1')}
              </Button>
              <Button onClick={() => setStep(2)} disabled={!consentGranted}>
                {t('add.step3')}
                <ArrowRight size={16} strokeWidth={1.5} />
              </Button>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div className="rounded-panel border border-line p-4">
              <p className="text-sm text-text2">{t('add.enrollmentHint')}</p>

              <div className="mt-4 space-y-1.5">
                <Label>{t('add.selectCamera')}</Label>
                <Select value={selectedCamera} onValueChange={setSelectedCamera}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('add.selectCamera')} />
                  </SelectTrigger>
                  <SelectContent>
                    {onlineCameras.map((cam) => (
                      <SelectItem key={cam.id} value={cam.id}>
                        <span className="flex items-center gap-2">
                          <span className="status-dot status-dot--online" />
                          {cam.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="mt-4 flex justify-center">
                <div className="relative flex h-40 w-full max-w-xs items-center justify-center rounded-control border border-line bg-surface">
                  <CameraIcon size={48} strokeWidth={1} className="text-mutedtext" />
                  {selectedCamera && (
                    <Button
                      size="sm"
                      className="absolute bottom-3"
                      onClick={captureSample}
                      disabled={capturing || capturedCount >= 5}
                    >
                      <ScanFace size={14} strokeWidth={1.5} />
                      {capturing ? t('common.loading') : samples.length > 0 ? t('add.captureAgain') : t('add.capture')}
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-text2">
                <span>{t('add.sampleCount', { count: capturedCount })}</span>
              </div>

              {samples.length > 0 && (
                <div className="mt-3 grid grid-cols-5 gap-2">
                  {Array.from({ length: 5 }).map((_, i) => {
                    const sample = samples[i];
                    return (
                      <div
                        key={i}
                        className={cn(
                          'flex aspect-square items-center justify-center rounded-control border text-xs',
                          !sample && 'border-line bg-surface text-mutedtext',
                          sample?.status === 'captured' && 'border-ink bg-white text-ink',
                          sample?.status === 'rejected' && 'border-destructive bg-surface text-destructive'
                        )}
                      >
                        {sample?.status === 'captured' && <Check size={16} strokeWidth={1.5} />}
                        {sample?.status === 'rejected' && <AlertCircle size={16} strokeWidth={1.5} />}
                        {!sample && i + 1}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft size={16} strokeWidth={1.5} />
                {t('add.step2')}
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? t('common.loading') : t('add.save')}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
