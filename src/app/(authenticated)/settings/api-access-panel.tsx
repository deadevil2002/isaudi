"use client";

import { useEffect, useState } from "react";
import { Ban, BookOpen, Check, Copy, KeyRound, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppDialog } from "@/components/ui/app-dialog";
import { useLanguage } from "@/components/providers/language-provider";
import type { BusinessApiScope } from "@/lib/business-api/contracts";

type SafeKey = {
  id: string; name: string; prefix: string; scopes: BusinessApiScope[];
  status: "active" | "revoked"; createdAt: number; lastUsedAt: number | null; revokedAt: number | null;
};

type PendingKeyAction = { type: "revoke" | "rotate"; key: SafeKey };

const scopes: Array<{ id: BusinessApiScope; ar: string; en: string }> = [
  { id: "account:read", ar: "قراءة هوية الحساب", en: "Read account identity" },
  { id: "stores:read", ar: "قراءة المتاجر المتصلة", en: "Read connected stores" },
  { id: "reports:read", ar: "قراءة التقارير والتحليل", en: "Read reports and analysis" },
];

export function ApiAccessPanel({ enabled, preview = false }: { enabled: boolean; preview?: boolean }) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [keys, setKeys] = useState<SafeKey[]>(preview && enabled ? [{ id: "preview-key", name: "ERP", prefix: "isaudi_api_demo1234", scopes: ["account:read", "reports:read"], status: "active", createdAt: Date.now(), lastUsedAt: null, revokedAt: null }] : []);
  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<BusinessApiScope[]>(["account:read"]);
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingKeyAction | null>(null);

  const load = async () => {
    if (!enabled || preview) return;
    try {
      const response = await fetch("/api/business-api/keys", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const body = await response.json() as { keys?: SafeKey[] };
      setKeys(Array.isArray(body.keys) ? body.keys : []);
    } catch { setError(ar ? "تعذر تحميل مفاتيح API." : "API keys could not be loaded."); }
  };

  useEffect(() => { void load(); }, [enabled, preview]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutate = async (url: string, body?: unknown) => {
    if (preview || busy) return null;
    setBusy(true); setError(null); setCopied(false);
    try {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
      const data = await response.json().catch(() => ({})) as { secret?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "request_failed");
      if (data.secret) setSecret(data.secret);
      await load();
      return data;
    } catch { setError(ar ? "تعذر إكمال العملية. حاول مرة أخرى." : "The action could not be completed. Try again."); return null; }
    finally { setBusy(false); }
  };

  const create = async () => {
    if (!name.trim()) { setError(ar ? "أدخل اسمًا للمفتاح." : "Enter a key name."); return; }
    const result = await mutate("/api/business-api/keys", { name: name.trim(), scopes: selectedScopes });
    if (result) setName("");
  };

  const confirmKeyAction = async () => {
    if (!pendingAction) return;
    await mutate(`/api/business-api/keys/${pendingAction.key.id}/${pendingAction.type}`);
    setPendingAction(null);
  };

  const copySecret = async () => {
    if (!secret) return;
    await navigator.clipboard.writeText(secret);
    setCopied(true);
  };

  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0e1218] p-5 shadow-[0_18px_45px_rgba(0,0,0,.18)] sm:p-6" aria-labelledby="api-access-title">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#0fc9a7]/60 to-transparent" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#0fc9a7]/20 bg-[#0fc9a7]/10 text-[#0fc9a7]"><KeyRound className="h-5 w-5" aria-hidden="true" /></span><div><h2 id="api-access-title" className="font-bold text-white">{ar ? "وصول Business API" : "Business API access"}</h2><p className="mt-1 max-w-2xl text-sm leading-7 text-[#94a3b8]">{ar ? "اربط أنظمة ERP وBI الخاصة بك بواجهة iSaudi للقراءة فقط." : "Connect your ERP or BI systems to iSaudi's read-only API."}</p></div></div>
        <Button asChild variant="outline" className="min-h-11 rounded-xl border-white/10 bg-[#161c24] text-white hover:bg-[#1d252f] hover:text-white"><a href="/docs/api"><BookOpen className="h-4 w-4" aria-hidden="true" />{ar ? "وثائق API" : "API docs"}</a></Button>
      </div>
      {!enabled ? <div className="mt-5 rounded-xl border border-[#e6b95c]/20 bg-[#e6b95c]/5 p-4"><p className="text-sm leading-6 text-[#d8c28f]">{ar ? "هذه الميزة متاحة لخطة المؤسسات Business فقط." : "This feature is available on the Business plan only."}</p><a href="/billing" className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-[#e6b95c] px-4 font-bold text-[#06090c]">{ar ? "ترقية الخطة" : "Upgrade plan"}</a></div> : <>
        {secret && <div role="status" className="mt-5 rounded-xl border border-amber-300/30 bg-amber-300/10 p-4"><p className="font-bold text-amber-100">{ar ? "انسخ المفتاح الآن، لن تتمكن من رؤيته مرة أخرى." : "Copy this key now. You will not be able to see it again."}</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><code dir="ltr" className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-black/30 p-3 text-sm text-white">{secret}</code><Button type="button" onClick={() => void copySecret()} className="min-h-11 rounded-xl bg-[#e6b95c] text-[#06090c]"><Copy className="h-4 w-4" aria-hidden="true" />{copied ? (ar ? "تم النسخ" : "Copied") : (ar ? "نسخ" : "Copy")}</Button><Button type="button" variant="outline" onClick={() => { setSecret(null); setCopied(false); }} className="min-h-11 rounded-xl border-white/10 text-white">{ar ? "حفظت المفتاح" : "I've saved it"}</Button></div></div>}
        <div className="mt-5 rounded-xl border border-white/10 bg-[#161c24] p-4"><label htmlFor="api-key-name" className="text-sm font-semibold text-white">{ar ? "اسم المفتاح" : "Key name"}</label><input id="api-key-name" value={name} maxLength={64} onChange={event => setName(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#0e1218] px-3 text-white outline-none focus-visible:ring-2 focus-visible:ring-[#0fc9a7]" placeholder={ar ? "مثال: نظام ERP" : "Example: ERP system"} />
          <fieldset className="mt-4"><legend className="text-sm font-semibold text-white">{ar ? "صلاحيات القراءة" : "Read scopes"}</legend><div className="mt-2 grid gap-2 sm:grid-cols-3">{scopes.map(scope => <label key={scope.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-white/10 p-3 text-sm text-[#c7d0db]"><input type="checkbox" checked={selectedScopes.includes(scope.id)} onChange={event => setSelectedScopes(current => event.target.checked ? [...current, scope.id] : current.filter(value => value !== scope.id))} className="h-4 w-4 accent-[#0fc9a7]" />{ar ? scope.ar : scope.en}</label>)}</div></fieldset>
          <Button type="button" onClick={() => void create()} disabled={busy || !name.trim() || selectedScopes.length === 0} className="mt-4 min-h-11 w-full rounded-xl bg-[#0fc9a7] font-bold text-[#06110f] hover:bg-[#37d7b9] sm:w-auto">{busy ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}{ar ? "إنشاء مفتاح" : "Create key"}</Button>
        </div>
        <div className="mt-5 space-y-3">{keys.length === 0 ? <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-[#94a3b8]">{ar ? "لا توجد مفاتيح API بعد." : "No API keys yet."}</p> : keys.map(key => <article key={key.id} className="rounded-xl border border-white/10 bg-[#161c24] p-4"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-white">{key.name}</h3><span className={`rounded-full px-2 py-1 text-xs ${key.status === "active" ? "bg-[#0fc9a7]/10 text-[#72ead4]" : "bg-red-400/10 text-red-300"}`}>{key.status}</span></div><code dir="ltr" className="mt-2 block text-sm text-[#e6b95c]">{key.prefix}••••••••</code><p className="mt-2 text-xs leading-5 text-[#64748b]">{key.scopes.join(" · ")}</p></div>{key.status === "active" && <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setPendingAction({ type: "rotate", key })} className="min-h-11 rounded-xl border-white/10 text-white"><RefreshCw className="h-4 w-4" aria-hidden="true" />{ar ? "تدوير" : "Rotate"}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => setPendingAction({ type: "revoke", key })} className="min-h-11 rounded-xl border-red-400/20 text-red-300"><Ban className="h-4 w-4" aria-hidden="true" />{ar ? "إلغاء" : "Revoke"}</Button></div>}</div></article>)}</div>
        {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
        {copied && <span className="sr-only" aria-live="polite"><Check />{ar ? "تم نسخ المفتاح" : "API key copied"}</span>}
      </>}
      <AppDialog
        open={pendingAction !== null}
        variant={pendingAction?.type === "revoke" ? "destructive" : "warning"}
        title={pendingAction?.type === "revoke" ? (ar ? "إلغاء مفتاح API؟" : "Revoke API key?") : (ar ? "تدوير مفتاح API؟" : "Rotate API key?")}
        description={pendingAction ? (pendingAction.type === "revoke" ? (ar ? `سيتوقف المفتاح ${pendingAction.key.name} عن العمل فورًا.` : `${pendingAction.key.name} will stop working immediately.`) : (ar ? `سيتوقف المفتاح القديم ${pendingAction.key.name} فورًا وسيُنشأ بديل جديد.` : `The old ${pendingAction.key.name} key will stop working immediately and a replacement will be created.`)) : undefined}
        actionLabel={pendingAction?.type === "revoke" ? (ar ? "إلغاء المفتاح" : "Revoke key") : (ar ? "تدوير المفتاح" : "Rotate key")}
        cancelLabel={ar ? "تراجع" : "Cancel"}
        closeLabel={ar ? "إغلاق نافذة التأكيد" : "Close confirmation dialog"}
        busy={busy}
        direction={ar ? "rtl" : "ltr"}
        onAction={confirmKeyAction}
        onClose={() => setPendingAction(null)}
      />
    </section>
  );
}
