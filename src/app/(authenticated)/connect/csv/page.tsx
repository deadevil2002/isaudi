"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileUp, Check, AlertCircle, Loader2, UploadCloud, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/providers/language-provider";
import { createTranslator } from "@/lib/i18n/translations";

function FilePicker({
  label,
  help,
  file,
  onFileSelect,
  onFileClear,
  selectLabel,
  emptyLabel,
  removeLabel,
  accept = ".csv"
}: {
  label: string;
  help: string;
  file: File | null;
  onFileSelect: (f: File | null) => void;
  onFileClear: () => void;
  selectLabel: string;
  emptyLabel: string;
  removeLabel: string;
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  const handleClear = () => {
    onFileClear();
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#161c24] p-5 sm:p-6">
      <h3 className="mb-1 font-bold text-white">{label}</h3>
      <p className="mb-4 text-sm leading-6 text-[#94a3b8]">{help}</p>

      <div
        className={`relative rounded-xl border-2 transition duration-200 focus-within:border-[#e6b95c] focus-within:ring-2 focus-within:ring-[#e6b95c]/20 ${
          file
            ? "border-[#0fc9a7]/30 bg-[#0e1218] shadow-sm"
            : dragActive
              ? "border-[#e6b95c] bg-[#e6b95c]/5"
              : "border-dashed border-white/15 bg-[#0e1218]/50 hover:border-[#e6b95c]/50 hover:bg-[#0e1218]"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
          aria-label={selectLabel}
        />

        {!file ? (
          <div className="flex flex-col items-center justify-center p-6">
          <UploadCloud className="mb-2 h-8 w-8 text-[#e6b95c]" />
          <span className="text-sm font-medium text-white">
            {selectLabel}
          </span>
          <span className="mt-1 text-xs text-[#64748b]">
            {emptyLabel}
          </span>
          </div>
        ) : (
          <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0fc9a7]/10 text-[#0fc9a7]">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="overflow-hidden">
              <div className="truncate text-sm font-semibold text-white">{file.name}</div>
              <div className="text-xs text-[#64748b]">{(file.size / 1024).toFixed(1)} KB</div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="relative z-20 shrink-0 bg-[#161c24] text-[#94a3b8] hover:bg-red-400/10 hover:text-red-300"
            onClick={handleClear}
            aria-label={removeLabel}
            type="button"
          >
            <X className="w-4 h-4" />
          </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ConnectCsvPage() {
  const router = useRouter();
  const { lang } = useLanguage();
  const t = createTranslator(lang);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [productsFile, setProductsFile] = useState<File | null>(null);
  const [ordersFile, setOrdersFile] = useState<File | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const handleRun = async () => {
    if (!productsFile || !ordersFile) {
      setError(t("connect.csv.error.filesRequired"));
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    setWarnings([]);
    try {
      const form = new FormData();
      form.append('productsFile', productsFile);
      form.append('ordersFile', ordersFile);
      const uploadRes = await fetch('/api/connect/csv/upload', { method: 'POST', body: form });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        throw new Error(uploadData.error || t("connect.csv.error.uploadFailed"));
      }
      setWarnings(uploadData.warnings || []);
      const genRes = await fetch('/api/analysis/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: uploadData.reportId })
      });
      const genData = await genRes.json();
      if (!genRes.ok) {
        throw new Error(genData.error || t("connect.csv.error.analysisFailed"));
      }
      setSuccess(t("connect.csv.success.analysisStarted"));
      setTimeout(() => {
        router.push('/dashboard?refresh=true');
      }, 1500);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : t("connect.csv.error.unexpected"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl" dir={lang === "ar" ? "rtl" : "ltr"}>
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0e1218] p-6 shadow-[0_25px_60px_rgba(0,0,0,.25)] md:p-8">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e6b95c] to-transparent" />
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#e6b95c]/20 bg-[#e6b95c]/10 text-[#e6b95c]">
             <FileSpreadsheet className="w-8 h-8" />
          </div>
          <h1 className="mb-2 text-3xl font-bold text-white">{t("connect.csv.title")}</h1>
          <p className="leading-7 text-[#94a3b8]">
            {t("connect.csv.subtitle")}
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-red-300">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-[#0fc9a7]/20 bg-[#0fc9a7]/10 p-4 text-[#72ead4]">
            <Check className="w-5 h-5 shrink-0" />
            <span className="text-sm">{success}</span>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="mb-6 rounded-xl border border-[#e6b95c]/20 bg-[#e6b95c]/10 p-4 text-sm text-[#f4d58d]">
            <div className="font-bold mb-1">{t("connect.csv.warnings.title")}</div>
            <ul className="list-disc pr-5 space-y-1">
              {warnings.slice(0, 5).map((w, i) => <li key={i}>{w}</li>)}
              {warnings.length > 5 && (
                <li>
                  {t("connect.csv.warnings.more").replace(
                    "{count}",
                    String(warnings.length - 5)
                  )}
                </li>
              )}
            </ul>
          </div>
        )}

        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <FilePicker
              label={t("connect.csv.products.title")}
              help={t("connect.csv.products.help")}
              file={productsFile}
              onFileSelect={setProductsFile}
              onFileClear={() => setProductsFile(null)}
              selectLabel={t("connect.csv.products.select")}
              emptyLabel={t("connect.csv.empty")}
              removeLabel={t("connect.csv.products.remove")}
            />

            <FilePicker
              label={t("connect.csv.orders.title")}
              help={t("connect.csv.orders.help")}
              file={ordersFile}
              onFileSelect={setOrdersFile}
              onFileClear={() => setOrdersFile(null)}
              selectLabel={t("connect.csv.orders.select")}
              emptyLabel={t("connect.csv.empty")}
              removeLabel={t("connect.csv.orders.remove")}
            />
          </div>
          <div className="pt-4">
            <Button className="h-12 w-full rounded-xl bg-[#e6b95c] text-lg font-bold text-[#06090c] hover:bg-[#f0c96e] disabled:bg-[#161c24] disabled:text-[#64748b]" onClick={handleRun} disabled={loading || !productsFile || !ordersFile}>
              {loading ? <Loader2 className="animate-spin mr-2" /> : <FileUp className="w-5 h-5 mr-2" />}
              {loading ? t("connect.csv.button.loading") : t("connect.csv.button.run")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
