import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from 'next/navigation';
import { FileUp, ShoppingBag } from 'lucide-react';
import { useLanguage } from "@/components/providers/language-provider";
import { createTranslator } from "@/lib/i18n/translations";

export function StoreSetup() {
  const router = useRouter();
  const { lang } = useLanguage();
  const t = createTranslator(lang);

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl text-center">{t("dashboard.storeSetup.title")}</CardTitle>
        <CardDescription className="text-center">
          {t("dashboard.storeSetup.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button 
            variant="outline" 
            className="h-32 flex flex-col gap-3 hover:border-isaudi-green hover:bg-isaudi-green/5 transition-all"
            onClick={() => router.push('/connect/salla')}
          >
            <ShoppingBag className="w-8 h-8 text-isaudi-green" />
            <span className="font-bold text-lg">{t("dashboard.storeSetup.sallaTitle")}</span>
            <span className="text-xs text-gray-500">{t("dashboard.storeSetup.sallaSubtitle")}</span>
          </Button>

          <Button 
            variant="outline" 
            className="h-32 flex flex-col gap-3 hover:border-isaudi-green hover:bg-isaudi-green/5 transition-all"
            onClick={() => router.push('/connect/csv')}
          >
            <FileUp className="w-8 h-8 text-blue-500" />
            <span className="font-bold text-lg">{t("dashboard.storeSetup.csvTitle")}</span>
            <span className="text-xs text-gray-500">{t("dashboard.storeSetup.csvSubtitle")}</span>
          </Button>
        </div>

        <div className="text-center text-sm text-gray-400">
          {t("dashboard.storeSetup.note")}
        </div>
      </CardContent>
    </Card>
  );
}
