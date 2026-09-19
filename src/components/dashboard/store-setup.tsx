import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from 'next/navigation';
import { FileUp, ShoppingBag } from 'lucide-react';
import { useLanguage } from "@/components/providers/language-provider";
import { createTranslator } from "@/lib/i18n/translations";

export function StoreSetup() {
  const router = useRouter();
  const { lang } = useLanguage();
  const t = createTranslator(lang);

  return (
    <Card className="max-w-2xl mx-auto bg-[#161c24] border-[#ffffff1a] shadow-none">
      <CardHeader>
        <CardTitle className="text-3xl font-bold text-center text-white">{t("dashboard.storeSetup.title")}</CardTitle>
        <CardDescription className="text-center text-[#94a3b8] mt-2">
          {t("dashboard.storeSetup.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button
            className="h-32 flex flex-col gap-3 bg-[#0e1218] border border-[#ffffff1a] hover:border-[#0fc9a7]/50 hover:bg-[#0fc9a7]/5 transition-all rounded-2xl text-white"
            onClick={() => router.push('/connect/salla')}
          >
            <ShoppingBag className="w-8 h-8 text-[#0fc9a7]" />
            <span className="font-bold text-lg">{t("dashboard.storeSetup.sallaTitle")}</span>
            <span className="text-xs text-[#94a3b8]">{t("dashboard.storeSetup.sallaSubtitle")}</span>
          </Button>

          <Button
            className="h-32 flex flex-col gap-3 bg-[#0e1218] border border-[#ffffff1a] hover:border-[#0fc9a7]/50 hover:bg-[#0fc9a7]/5 transition-all rounded-2xl text-white"
            onClick={() => router.push('/connect/csv')}
          >
            <FileUp className="w-8 h-8 text-[#0fc9a7]" />
            <span className="font-bold text-lg">{t("dashboard.storeSetup.csvTitle")}</span>
            <span className="text-xs text-[#94a3b8]">{t("dashboard.storeSetup.csvSubtitle")}</span>
          </Button>
        </div>

        <div className="text-center text-sm text-[#64748b]">
          {t("dashboard.storeSetup.note")}
        </div>
      </CardContent>
    </Card>
  );
}
