'use client';

import { FormEvent, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type PortalData = {
  admin: { email: string; role: string };
  overview: Record<string, number>;
  users: Record<string, unknown>[];
  subscriptions: Record<string, unknown>[];
  payments: Record<string, unknown>[];
  connections: Record<string, unknown>[];
  reports: Record<string, unknown>[];
  audit: Record<string, unknown>[];
};

const tabs = [
  ['overview', 'نظرة عامة'], ['users', 'المستخدمون'], ['subscriptions', 'الاشتراكات'],
  ['payments', 'المدفوعات'], ['connections', 'الاتصالات'], ['reports', 'التقارير واستخدام AI'],
  ['audit', 'سجل التدقيق'], ['settings', 'الإعدادات'],
] as const;

async function api(action: string, payload?: Record<string, unknown>) {
  const response = await fetch(`/admin/api/${action}`, {
    method: payload ? 'POST' : 'GET',
    credentials: 'same-origin',
    headers: payload ? { 'Content-Type': 'application/json' } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
    cache: 'no-store',
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'تعذر إكمال الطلب');
  return result;
}

function Field({ label, name, type = 'text' }: { label: string; name: string; type?: string }) {
  return <label className="block text-sm font-medium text-slate-700">{label}
    <input name={name} type={type} required className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-700" />
  </label>;
}

function FormBox({ children, onSubmit, button }: {
  children: React.ReactNode; onSubmit: (data: FormData) => Promise<void>; button: string;
}) {
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);
  return <form className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm" onSubmit={async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(''); setDone('');
    try { await onSubmit(new FormData(event.currentTarget)); setDone('تمت العملية بنجاح'); }
    catch (e) { setError(e instanceof Error ? e.message : 'تعذر إكمال الطلب'); }
    finally { setBusy(false); }
  }}>
    {children}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {done && <p className="text-sm text-emerald-700">{done}</p>}
    <button disabled={busy} className="w-full rounded-xl bg-emerald-800 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'جارٍ التنفيذ…' : button}</button>
  </form>;
}

function DataTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) return <div className="rounded-2xl border bg-white p-8 text-center text-slate-500">لا توجد بيانات</div>;
  const columns = Object.keys(rows[0]).filter((key) => !key.includes('json'));
  return <div className="overflow-x-auto rounded-2xl border bg-white">
    <table className="min-w-full text-sm"><thead className="bg-slate-50"><tr>
      {columns.map((column) => <th key={column} className="whitespace-nowrap px-4 py-3 text-right">{column}</th>)}
    </tr></thead><tbody>{rows.map((row, index) => <tr key={String(row.id ?? index)} className="border-t">
      {columns.map((column) => <td key={column} className="max-w-xs whitespace-nowrap px-4 py-3 text-slate-700">
        {column.toLowerCase().includes('email') ? String(row[column] ?? '') :
          column.includes('At') || column.includes('_at') ? (row[column] ? new Date(Number(row[column])).toLocaleString('ar-SA') : '—') :
          String(row[column] ?? '—')}
      </td>)}
    </tr>)}</tbody></table>
  </div>;
}

export default function AdminPortal({ mode }: { mode?: 'reset' | 'transfer' }) {
  const router = useRouter();
  const [status, setStatus] = useState<{
    authenticated: boolean;
    setupAvailable: boolean;
    databaseUnavailable?: boolean;
  } | null>(null);
  const [data, setData] = useState<PortalData | null>(null);
  const [tab, setTab] = useState('overview');
  const token = useMemo(() => typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('token') || '', []);

  const load = async () => {
    const state = await api('status');
    setStatus(state);
    if (state.authenticated) {
      const portalData = await api('data');
      setData(portalData);
      if (portalData.admin.role !== 'super_admin') setTab('settings');
    }
  };
  useLayoutEffect(() => {
    if (token) window.history.replaceState(null, '', window.location.pathname);
  }, [token]);
  useEffect(() => {
    let active = true;
    void api('status')
      .then(async (state) => ({
        state,
        portalData: state.authenticated ? await api('data') : null,
      }))
      .then(({ state, portalData }) => {
        if (!active) return;
        setStatus(state);
        if (portalData) {
          setData(portalData);
          if (portalData.admin.role !== 'super_admin') setTab('settings');
        }
      })
      .catch(() => {
        if (active) setStatus({ authenticated: false, setupAvailable: false });
      });
    return () => { active = false; };
  }, []);

  if (mode === 'reset') return <Shell title="إعادة تعيين كلمة المرور">
    <FormBox button="حفظ كلمة المرور" onSubmit={async (form) => {
      await api('confirm-reset', { token, password: form.get('password') }); router.replace('/admin');
    }}><Field label="كلمة المرور الجديدة (14 حرفاً على الأقل)" name="password" type="password" /></FormBox>
  </Shell>;

  if (mode === 'transfer') return <Shell title="تأكيد نقل الإدارة">
    <FormBox button="تأكيد النقل" onSubmit={async (form) => {
      await api('confirm-transfer', { token, code: form.get('code'), password: form.get('password') }); router.replace('/admin');
    }}>
      <Field label="رمز التأكيد المرسل للبريد" name="code" />
      <Field label="أنشئ كلمة مرور إدارية (14 حرفاً على الأقل)" name="password" type="password" />
    </FormBox>
  </Shell>;

  if (!status) return <Shell title="بوابة الإدارة"><p className="text-center text-slate-500">جارٍ التحميل…</p></Shell>;
  if (!status.authenticated) return <Shell title={status.setupAvailable ? 'الإعداد الأول للمدير الأعلى' : 'تسجيل دخول الإدارة'}>
    {status.databaseUnavailable && <p role="alert" className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      قاعدة البيانات المحلية غير متاحة حالياً. يمكنك عرض شاشة الدخول، وستعمل العمليات بعد ربط D1.
    </p>}
    {status.setupAvailable ? <FormBox button="إنشاء حساب الإدارة" onSubmit={async (form) => {
      await api('setup', { password: form.get('password') }); await load();
    }}><p className="text-sm text-slate-600">يلزم تسجيل الدخول أولاً بالحساب العادي الموثق والمخوّل.</p>
      <Field label="كلمة مرور إدارية مستقلة (14 حرفاً على الأقل)" name="password" type="password" />
    </FormBox> : <>
      <FormBox button="تسجيل الدخول" onSubmit={async (form) => {
        await api('login', { email: form.get('email'), password: form.get('password') }); await load();
      }}><Field label="البريد الإلكتروني" name="email" type="email" /><Field label="كلمة المرور" name="password" type="password" /></FormBox>
      <details className="mt-5 rounded-xl border bg-white p-4"><summary className="cursor-pointer">نسيت كلمة المرور؟</summary>
        <div className="mt-4"><FormBox button="إرسال رابط الاستعادة" onSubmit={async (form) => { await api('request-reset', { email: form.get('email') }); }}>
          <Field label="البريد الإلكتروني" name="email" type="email" />
        </FormBox></div>
      </details>
    </>}
  </Shell>;

  if (!data) return <Shell title="بوابة الإدارة"><p>جارٍ تحميل البيانات…</p></Shell>;
  const availableTabs = data.admin.role === 'super_admin'
    ? tabs
    : tabs.filter(([id]) => id === 'settings');
  const rows = tab === 'users' ? data.users : tab === 'subscriptions' ? data.subscriptions :
    tab === 'payments' ? data.payments : tab === 'connections' ? data.connections :
    tab === 'reports' ? data.reports : data.audit;

  return <main className="min-h-screen bg-slate-100 text-slate-950">
    <header className="border-b bg-slate-950 text-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5">
      <div><h1 className="text-xl font-bold">isaudi.ai — الإدارة</h1><p className="text-xs text-slate-400">{data.admin.email} · {data.admin.role}</p></div>
      <button className="rounded-lg border border-slate-600 px-4 py-2 text-sm" onClick={async () => { await api('logout', {}); router.replace('/admin'); router.refresh(); }}>تسجيل الخروج</button>
    </div></header>
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[220px_1fr]">
      <nav className="flex gap-2 overflow-x-auto lg:flex-col">{availableTabs.map(([id, label]) =>
        <button key={id} onClick={() => setTab(id)} className={`whitespace-nowrap rounded-xl px-4 py-3 text-right text-sm ${tab === id ? 'bg-emerald-800 text-white' : 'bg-white'}`}>{label}</button>
      )}</nav>
      <section>
        <h2 className="mb-5 text-2xl font-bold">{availableTabs.find(([id]) => id === tab)?.[1] ?? 'الإعدادات'}</h2>
        {tab === 'overview' ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Object.entries(data.overview).map(([key, value]) => <div key={key} className="rounded-2xl border bg-white p-6"><p className="text-sm text-slate-500">{key}</p><p className="mt-2 text-3xl font-bold">{Number(value).toLocaleString('ar-SA')}</p></div>)}
        </div> : tab === 'settings' ? <Settings superAdmin={data.admin.role === 'super_admin'} /> : <DataTable rows={rows} />}
      </section>
    </div>
  </main>;
}

function Settings({ superAdmin }: { superAdmin: boolean }) {
  const router = useRouter();
  return <div className="grid gap-6 xl:grid-cols-2">
    <FormBox button="تغيير كلمة المرور" onSubmit={async (form) => {
      await api('change-password', { currentPassword: form.get('current'), newPassword: form.get('next') });
      router.replace('/admin');
      router.refresh();
    }}><Field label="كلمة المرور الحالية" name="current" type="password" /><Field label="كلمة المرور الجديدة" name="next" type="password" /></FormBox>
    {superAdmin && <FormBox button="إرسال طلب النقل" onSubmit={async (form) => {
      await api('request-transfer', { targetEmail: form.get('email'), currentPassword: form.get('password') });
    }}><h3 className="font-bold">نقل صلاحية المدير الأعلى</h3><p className="text-sm text-amber-700">لن يكتمل النقل إلا بعد تحقق البريد المستهدف.</p>
      <Field label="البريد الإلكتروني المستهدف" name="email" type="email" /><Field label="كلمة المرور الحالية لإعادة التحقق" name="password" type="password" />
    </FormBox>}
  </div>;
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return <main className="min-h-screen bg-slate-100 px-4 py-12 text-slate-950"><div className="mx-auto max-w-md">
    <div className="mb-8 text-center"><div className="mb-3 text-2xl font-bold text-emerald-800">isaudi.ai</div><h1 className="text-2xl font-bold">{title}</h1></div>{children}
  </div></main>;
}