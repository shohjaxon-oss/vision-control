import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { EnrollmentSample, Camera as CameraType } from '@/types';
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
import { Check, Camera as CameraIcon, ArrowRight, ArrowLeft, ScanFace, FileCheck, UserPlus, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';

interface FormData {
  first_name: string;
  last_name: string;
  position: string;
  department: string;
  phone: string;
}

export function AddEmployeePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [createdEmployeeId, setCreatedEmployeeId] = useState<string | null>(null);
  const [employeeFullName, setEmployeeFullName] = useState<string>('');

  // Step 2: Consent state
  const [consentMethod, setConsentMethod] = useState<'electronic' | 'paper'>('electronic');
  const [documentRef, setDocumentRef] = useState('');
  const [savingConsent, setSavingConsent] = useState(false);

  // Step 3: Enrollment state
  const [selectedCamera, setSelectedCamera] = useState('');
  const [samples, setSamples] = useState<EnrollmentSample[]>([]);
  const [capturing, setCapturing] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    defaultValues: { first_name: '', last_name: '', position: '', department: '', phone: '' },
  });

  const { data: cameras = [] } = useQuery<CameraType[]>({
    queryKey: ['cameras'],
    queryFn: () => api.getCameras(),
  });

  // Step 1: Create Employee record in DB
  const [creating, setCreating] = useState(false);
  const onStep1Submit = async (data: FormData) => {
    setCreating(true);
    try {
      const created = await api.createEmployee({
        first_name: data.first_name,
        last_name: data.last_name,
        position: data.position,
        department: data.department,
        phone: data.phone,
      });
      setCreatedEmployeeId(created.id);
      setEmployeeFullName(`${created.first_name} ${created.last_name}`);
      toast.success("Xodim muvaffaqiyatli yaratildi. Endi biometrik rozilikni tasdiqlang.");
      setStep(2);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Xodimni yaratishda xatolik yuz berdi";
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  // Step 2: Submit Biometric Consent (ZRU-1125 Legal Requirement)
  const onStep2ConsentSubmit = async () => {
    if (!createdEmployeeId) return;
    setSavingConsent(true);
    try {
      await api.setConsent(createdEmployeeId, {
        granted: true,
        version: "1.0",
        method: consentMethod,
        document_ref: documentRef || undefined,
      });
      toast.success("Biometrik rozilik rasmiylashtirildi!");
      setStep(3);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Rozilikni saqlashda xatolik yuz berdi";
      toast.error(msg);
    } finally {
      setSavingConsent(false);
    }
  };

  // Step 3: Capture genuine biometric face samples
  const captureSample = async () => {
    if (!createdEmployeeId || !selectedCamera) {
      toast.error("Iltimos, kadr olish uchun kamerani tanlang");
      return;
    }
    setCapturing(true);
    try {
      const res = await api.captureEnrollment(createdEmployeeId, selectedCamera);
      setSamples((prev) => [...prev, res.sample]);
      if (res.sample.status === 'rejected') {
        const issue = res.sample.quality_issues[0] || "Sifat talablariga mos kelmadi";
        toast.error(`Kadr rad etildi: ${issue}`);
      } else {
        toast.success(`Namuna qabul qilindi (${res.samples_count}/5)`);
        if (res.samples_count >= 5) {
          toast.success("Barcha 5 ta namuna muvaffaqiyatli saqlandi!");
          setStep(4);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Namuna olishda xatolik";
      toast.error(msg);
    } finally {
      setCapturing(false);
    }
  };

  const capturedCount = samples.filter((s) => s.status === 'captured').length;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Wizard Progress Steps */}
      <div className="mb-8 flex items-center justify-between">
        {[
          { num: 1, label: "Ma'lumotlar", icon: UserPlus },
          { num: 2, label: "Rozilik (ZRU-1125)", icon: FileCheck },
          { num: 3, label: "Yuz namunasi", icon: ScanFace },
          { num: 4, label: "Yakun", icon: Check },
        ].map(({ num, label, icon: Icon }, idx) => (
          <div key={num} className="flex flex-1 items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold transition-all shadow-xs',
                  step === num
                    ? 'bg-slate-900 text-white ring-4 ring-slate-200'
                    : step > num
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                )}
              >
                {step > num ? <Check size={16} strokeWidth={2.5} /> : <Icon size={16} />}
              </div>
              <span className={cn('mt-2 text-xs font-semibold text-center', step === num ? 'text-slate-900' : 'text-slate-500')}>
                {label}
              </span>
            </div>
            {idx < 3 && (
              <div className={cn('mx-3 h-0.5 flex-1', step > num ? 'bg-emerald-600' : 'bg-slate-200')} />
            )}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* STEP 1: Employee Basic Data */}
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-lg font-bold text-slate-900 mb-1">1-qadam: Xodim asosiy ma'lumotlari</h2>
            <p className="text-xs text-slate-500 mb-6">Xodimni tizimda ro'yxatdan o'tkazish uchun ma'lumotlarni kiriting.</p>

            <form onSubmit={handleSubmit(onStep1Submit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name" className="text-xs font-semibold text-slate-700">Ism *</Label>
                  <Input id="first_name" {...register('first_name', { required: true })} className="mt-1" placeholder="Jasur" />
                  {errors.first_name && <p className="mt-1 text-xs text-rose-500 font-medium">Ism kiritilishi shart</p>}
                </div>
                <div>
                  <Label htmlFor="last_name" className="text-xs font-semibold text-slate-700">Familiya *</Label>
                  <Input id="last_name" {...register('last_name', { required: true })} className="mt-1" placeholder="Rahimov" />
                  {errors.last_name && <p className="mt-1 text-xs text-rose-500 font-medium">Familiya kiritilishi shart</p>}
                </div>
              </div>

              <div>
                <Label htmlFor="position" className="text-xs font-semibold text-slate-700">Lavozim *</Label>
                <Input id="position" {...register('position', { required: true })} className="mt-1" placeholder="Menejer" />
                {errors.position && <p className="mt-1 text-xs text-rose-500 font-medium">Lavozim kiritilishi shart</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="department" className="text-xs font-semibold text-slate-700">Bo'lim *</Label>
                  <Input id="department" {...register('department', { required: true })} className="mt-1" placeholder="Sotuv bo'limi" />
                </div>
                <div>
                  <Label htmlFor="phone" className="text-xs font-semibold text-slate-700">Telefon raqami</Label>
                  <Input id="phone" {...register('phone')} className="mt-1" placeholder="+998 90 123 45 67" />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={creating} className="bg-slate-900 text-white hover:bg-slate-800">
                  {creating ? "Saqlanmoqda..." : "Keyingisi"} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </form>
          </motion.div>
        )}

        {/* STEP 2: Biometric Consent (ZRU-1125 Compliance) */}
        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <h2 className="text-lg font-bold text-slate-900">2-qadam: Biometrik rozilikni tasdiqlash</h2>
            </div>
            <p className="text-xs text-slate-500 mb-6">
              O'zbekiston Respublikasi Qonuni (ZRU-1125) bo'yicha yuz biometrikasini olishdan oldin xodimning yozma yoki elektron roziligi olinishi qat'iy talab etiladi.
            </p>

            <div className="space-y-4">
              <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-200 text-xs text-slate-700 space-y-2">
                <p className="font-semibold text-slate-900">Xodim: {employeeFullName}</p>
                <p>
                  Ushbu orqali xodim korxona xavfsizlik va davomat nazorati tizimida yuz tasvirini saqlash va qayta ishlashga ixtiyoriy ravishda rozilik bildiradi. Xodim istalgan vaqtda ushbu rozilikni bekor qilish huquqiga ega bo'lib, bekor qilinganda barcha yuz belgilari butunlay yo'q qilinadi.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Rozilik shakli</Label>
                  <Select value={consentMethod} onValueChange={(val: 'electronic' | 'paper') => setConsentMethod(val)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="electronic">Elektron rozilik (SMS / Shaxsiy kabinet)</SelectItem>
                      <SelectItem value="paper">Qog'oz ariza shaklida (Imzolangan)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">Hujjat raqami / Ariza ID</Label>
                  <Input
                    value={documentRef}
                    onChange={(e) => setDocumentRef(e.target.value)}
                    placeholder="DOC-2026-001"
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(1)} className="border-slate-300">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Orqaga
                </Button>
                <Button onClick={onStep2ConsentSubmit} disabled={savingConsent} className="bg-slate-900 text-white hover:bg-slate-800">
                  {savingConsent ? "Tasdiqlanmoqda..." : "Rozilikni qabul qilish va davom etish"} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 3: Genuine Biometric Enrollment */}
        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-1">
              <ScanFace className="h-5 w-5 text-slate-900" />
              <h2 className="text-lg font-bold text-slate-900">3-qadam: Yuz namunalarini ro'yxatga olish</h2>
            </div>
            <p className="text-xs text-slate-500 mb-6">
              Kameraga qarab, 5 ta sifatli kadr oling. Model avtomatik ravishda xiralik, yorug'lik va burilish burchagini baholaydi.
            </p>

            <div className="space-y-5">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Ro'yxatga oluvchi kamera</Label>
                <Select value={selectedCamera} onValueChange={setSelectedCamera}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Kamerani tanlang..." />
                  </SelectTrigger>
                  <SelectContent>
                    {cameras.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sample dots progress */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700">Namunalar holati:</span>
                  <span className="text-xs font-mono font-bold text-slate-900">{capturedCount} / 5</span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {[0, 1, 2, 3, 4].map((idx) => {
                    const sample = samples[idx];
                    const isDone = sample?.status === 'captured';
                    const isRejected = sample?.status === 'rejected';
                    return (
                      <div
                        key={idx}
                        className={cn(
                          'flex h-12 flex-col items-center justify-center rounded-lg border text-xs font-bold transition-all',
                          isDone
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : isRejected
                            ? 'border-rose-300 bg-rose-50 text-rose-600'
                            : 'border-slate-200 bg-slate-50 text-slate-400'
                        )}
                      >
                        {isDone ? <Check size={18} /> : <span>#{idx + 1}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(2)} className="border-slate-300">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Orqaga
                </Button>

                <div className="flex gap-2">
                  <Button
                    onClick={captureSample}
                    disabled={capturing || !selectedCamera || capturedCount >= 5}
                    className="bg-slate-900 text-white hover:bg-slate-800"
                  >
                    <CameraIcon className="mr-2 h-4 w-4" />
                    {capturing ? "Kadr tahlil qilinmoqda..." : "Kadr olish"}
                  </Button>

                  {capturedCount >= 5 && (
                    <Button onClick={() => setStep(4)} className="bg-emerald-600 text-white hover:bg-emerald-700">
                      Yakunlash <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 4: Success Completion */}
        {step === 4 && (
          <motion.div
            key="step4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"
          >
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Check size={32} strokeWidth={2.5} />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Xodim muvaffaqiyatli ro'yxatga olindi!</h2>
            <p className="mt-2 text-sm text-slate-600 font-medium">
              <strong>{employeeFullName}</strong> uchun biometrik rozilik tasdiqlandi va 5 ta yuz namunasi saqlandi. Xodim endi kameralar orqali avtomatik taniladi.
            </p>

            <div className="mt-8 flex justify-center gap-3">
              <Button variant="outline" onClick={() => navigate('/employees')} className="border-slate-300">
                Xodimlar ro'yxatiga o'tish
              </Button>
              <Button
                onClick={() => {
                  setStep(1);
                  setCreatedEmployeeId(null);
                  setSamples([]);
                }}
                className="bg-slate-900 text-white hover:bg-slate-800"
              >
                Yana xodim qo'shish
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
