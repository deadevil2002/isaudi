"use client";

import { useState } from "react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileUp, Check, AlertCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/providers/language-provider";
import { createTranslator } from "@/lib/i18n/translations";

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
    } catch (e: any) {
      setError(e.message || t("connect.csv.error.unexpected"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-32 pb-20">
      <Container>
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
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
                <div className="bg-gray-50 p-6 rounded-xl border border-dashed border-gray-300">
                  <h3 className="font-bold mb-2">{t("connect.csv.products.title")}</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    {t("connect.csv.products.help")}
                  </p>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setProductsFile(e.target.files?.[0] || null)}
                  />
                </div>
                <div className="bg-gray-50 p-6 rounded-xl border border-dashed border-gray-300">
                  <h3 className="font-bold mb-2">{t("connect.csv.orders.title")}</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    {t("connect.csv.orders.help")}
                  </p>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setOrdersFile(e.target.files?.[0] || null)}
                  />
                </div>
              </div>
              <div className="pt-2">
                <Button className="w-full" onClick={handleRun} disabled={loading || !productsFile || !ordersFile}>
                  {loading ? <Loader2 className="animate-spin mr-2" /> : <FileUp className="w-4 h-4 mr-2" />}
                  {loading ? t("connect.csv.button.loading") : t("connect.csv.button.run")}
                </Button>
              </div>
            </div>

          </div>
        </div>
      </Container>
    </div>
  );
}
