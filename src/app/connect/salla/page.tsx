"use client";

import { useState, Suspense } from "react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { ShoppingBag, FileSpreadsheet, Check, AlertCircle, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/components/providers/language-provider";
import { createTranslator } from "@/lib/i18n/translations";

function ConnectSallaContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const [loading, setLoading] = useState(false);
  const { lang } = useLanguage();
  const t = createTranslator(lang);

  const handleConnect = () => {
    setLoading(true);
    // Redirect to API which redirects to Salla
    window.location.href = '/api/connect/salla/start';
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm text-center">
        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShoppingBag className="w-10 h-10 text-isaudi-green" />
        </div>
        
        <h1 className="text-2xl font-bold mb-4">{t("connect.salla.title")}</h1>
        <p className="text-gray-600 mb-8">
          {t("connect.salla.description")}
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-3 border border-red-100 text-right">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div className="text-sm">
              {error === 'config_missing' && t("connect.salla.error.config_missing")}
              {error === 'no_code' && t("connect.salla.error.no_code")}
              {error === 'token_failed' && t("connect.salla.error.token_failed")}
              {error === 'server_error' && t("connect.salla.error.server_error")}
              {!['config_missing', 'no_code', 'token_failed', 'server_error'].includes(error) &&
                t("connect.salla.error.unknown")}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <Button 
            onClick={handleConnect} 
            className="w-full py-6 text-lg font-bold bg-[#B4F3EC] text-[#004D5A] hover:bg-[#A0E0D9]"
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin" /> : t("connect.salla.button.primary")}
          </Button>
          
          <Link href="/connect/csv" className="block">
            <Button variant="ghost" className="w-full text-gray-500">
              {t("connect.salla.button.csv")}
            </Button>
          </Link>
        </div>
        
        <div className="mt-8 text-xs text-gray-400">
          {t("connect.salla.note")}
        </div>
      </div>
    </div>
  );
}

export default function ConnectSallaPage() {
  return (
    <div className="min-h-screen bg-gray-50 pt-32 pb-20">
      <Container>
        <Suspense fallback={<div className="flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-isaudi-green" /></div>}>
          <ConnectSallaContent />
        </Suspense>
      </Container>
    </div>
  );
}
