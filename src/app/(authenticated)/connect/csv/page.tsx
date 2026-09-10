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
    <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
      <h3 className="font-bold mb-1 text-gray-900">{label}</h3>
      <p className="text-sm text-gray-500 mb-4">{help}</p>

      <div
        className={`relative rounded-xl border-2 transition focus-within:border-isaudi-green focus-within:ring-2 focus-within:ring-isaudi-green/20 focus-within:ring-offset-2 ${
          file
            ? "border-isaudi-green/30 bg-white shadow-sm"
            : dragActive
              ? "border-isaudi-green bg-isaudi-green/5"
              : "border-dashed border-gray-300 hover:border-isaudi-green/50 hover:bg-gray-100"
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
          <UploadCloud className="mb-2 h-8 w-8 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">
            {selectLabel}
          </span>
          <span className="text-xs text-gray-500 mt-1">
            {emptyLabel}
          </span>
          </div>
        ) : (
          <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-lg bg-isaudi-green/10 flex items-center justify-center text-isaudi-green shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-semibold text-gray-900 truncate">{file.name}</div>
              <div className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="relative z-20 shrink-0 bg-white text-gray-400 hover:bg-red-50 hover:text-red-600"
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
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl p-6 md:p-8 border border-gray-100 shadow-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
             <FileSpreadsheet className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold mb-2">{t("connect.csv.title")}</h1>
          <p className="text-gray-600">
            {t("connect.csv.subtitle")}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-3 border border-red-100">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-xl flex items-center gap-3 border border-green-100">
            <Check className="w-5 h-5 shrink-0" />
            <span className="text-sm">{success}</span>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="mb-6 p-4 bg-yellow-50 text-yellow-800 rounded-xl border border-yellow-100 text-sm">
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
            <Button className="w-full h-12 text-lg" onClick={handleRun} disabled={loading || !productsFile || !ordersFile}>
              {loading ? <Loader2 className="animate-spin mr-2" /> : <FileUp className="w-5 h-5 mr-2" />}
              {loading ? t("connect.csv.button.loading") : t("connect.csv.button.run")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
