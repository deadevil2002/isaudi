import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, ArrowLeft, Loader2 } from "lucide-react";
import { useRouter } from 'next/navigation';
import { useLanguage } from "@/components/providers/language-provider";
import { createTranslator } from "@/lib/i18n/translations";

interface GenerateAnalysisProps {
  onGenerated: (report: any) => void;
  freeReportsUsed: number;
  isPremium: boolean;
}

export function GenerateAnalysis({ onGenerated, freeReportsUsed, isPremium }: GenerateAnalysisProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { lang } = useLanguage();
  const t = createTranslator(lang);

  const canGenerate = isPremium || freeReportsUsed < 2;

  const handleGenerate = async () => {
    if (!canGenerate) {
      // Trigger upgrade modal logic (or just redirect)
      router.push('/billing');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/analysis/generate', {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate analysis');
      }

      const report = await res.json();
      onGenerated(report);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-3xl mx-auto bg-gradient-to-br from-white to-gray-50 border-isaudi-green/20 shadow-lg">
      <CardHeader className="text-center space-y-4 pt-10">
        <div className="w-16 h-16 bg-isaudi-green/10 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
          <Sparkles className="w-8 h-8 text-isaudi-green" />
        </div>
        <CardTitle className="text-3xl font-bold text-gray-900">
          {t("dashboard.generate.title")}
        </CardTitle>
        <CardDescription className="text-lg text-gray-600 max-w-lg mx-auto">
          {t("dashboard.generate.description")}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6 text-center pb-10">
        {!isPremium && (
          <div className="bg-blue-50 text-blue-800 text-sm py-2 px-4 rounded-full inline-block mb-4 font-medium border border-blue-100">
            {t("dashboard.generate.freeLeft").replace("{count}", String(2 - freeReportsUsed))}
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-4 border border-red-100">
            {error}
          </div>
        )}

        <div className="flex justify-center">
          <Button 
            size="lg" 
            className="text-lg px-12 py-8 rounded-2xl shadow-xl shadow-isaudi-green/20 hover:shadow-2xl hover:shadow-isaudi-green/30 transition-all transform hover:-translate-y-1"
            onClick={handleGenerate}
            disabled={loading || !canGenerate}
          >
            {loading ? (
              <>
                <Loader2 className="w-6 h-6 ml-2 animate-spin" />
                {t("dashboard.generate.loading")}
              </>
            ) : (
              <>
                <Sparkles className="w-6 h-6 ml-2" />
                {t("dashboard.generate.cta")}
              </>
            )}
          </Button>
        </div>
        
        {!canGenerate && (
          <div className="mt-4">
            <Button variant="link" onClick={() => router.push('/billing')} className="text-isaudi-green">
              {t("dashboard.generate.upgrade")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
