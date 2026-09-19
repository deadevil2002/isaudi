import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Loader2 } from "lucide-react";
import { useRouter } from 'next/navigation';
import { useLanguage } from "@/components/providers/language-provider";
import { createTranslator } from "@/lib/i18n/translations";

interface GeneratedReport {
  id: string;
  reportJson: string;
  [key: string]: unknown;
}

interface GenerateAnalysisProps {
  onGenerated: (report: GeneratedReport) => void;
  freeReportsUsed: number;
  isPremium: boolean;
  generateReport?: () => Promise<GeneratedReport>;
  onUpgrade?: () => void;
  previewState?: "idle" | "loading" | "error";
  previewError?: string;
}

export function GenerateAnalysis({ onGenerated, freeReportsUsed, isPremium, generateReport, onUpgrade, previewState = "idle", previewError }: GenerateAnalysisProps) {
  const [loading, setLoading] = useState(previewState === "loading");
  const [error, setError] = useState<string | null>(
    previewState === "error" ? (previewError || "Simulated error generating report.") : null,
  );
  const router = useRouter();
  const { lang } = useLanguage();
  const t = createTranslator(lang);

  const canGenerate = isPremium || freeReportsUsed < 2;

  const handleGenerate = async () => {
    if (!canGenerate) {
      // Trigger upgrade modal logic (or just redirect)
      if (onUpgrade) onUpgrade();
      else router.push('/billing');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (generateReport) {
        const report = await generateReport();
        onGenerated(report);
      } else {
        const res = await fetch('/api/analysis/generate', {
          method: 'POST',
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to generate analysis');
        }

        const report = await res.json();
        onGenerated(report);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-3xl mx-auto bg-[#161c24] border-[#ffffff1a] shadow-2xl relative overflow-hidden">
      <CardHeader className="text-center space-y-4 pt-10">
        <div className="w-16 h-16 bg-[#e6b95c]/10 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
          <Sparkles className="w-8 h-8 text-[#e6b95c]" />
        </div>
        <CardTitle className="text-3xl font-bold text-white">
          {t("dashboard.generate.title")}
        </CardTitle>
        <CardDescription className="text-lg text-[#94a3b8] max-w-lg mx-auto">
          {t("dashboard.generate.description")}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6 text-center pb-10">
        {!isPremium && (
          <div className="bg-[#0fc9a7]/10 text-[#0fc9a7] text-sm py-2 px-4 rounded-full inline-block mb-4 font-bold border border-[#0fc9a7]/30">
            {t("dashboard.generate.freeLeft").replace("{count}", String(2 - freeReportsUsed))}
          </div>
        )}

        {error && (
          <div className="bg-[#ef4444]/10 text-[#ef4444] p-3 rounded-xl text-sm mb-4 border border-[#ef4444]/30">
            {error}
          </div>
        )}

        <div className="flex justify-center">
          <Button 
            size="lg" 
            className="text-lg px-12 py-8 rounded-2xl shadow-xl shadow-black/20 hover:shadow-2xl hover:shadow-black/40 transition-all transform hover:-translate-y-1 bg-gradient-to-r from-[#c5993c] to-[#e6b95c] text-black font-bold border-0 hover:opacity-90"
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
            <Button variant="link" onClick={() => onUpgrade ? onUpgrade() : router.push('/billing')} className="text-[#e6b95c]">
              {t("dashboard.generate.upgrade")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
