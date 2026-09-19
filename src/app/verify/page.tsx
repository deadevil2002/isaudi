import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/header";
import { dbService } from "@/lib/db/service";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { t, Lang } from "@/lib/i18n/translations";
import Image from "next/image";
import Link from "next/link";
import { X, CheckCircle2, AlertCircle } from "lucide-react";

type VerifyStatus = "invalid" | "expired" | "error" | "none";

export default async function VerifyPage(props: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const debugEmailVerify =
    process.env.NODE_ENV !== "production" ||
    process.env.DEBUG_EMAIL_VERIFY === "1";

  const cookieStore = await cookies();
  const lang = cookieStore.get("lang")?.value === "en" ? "en" : "ar";

  const searchParamsSource = props.searchParams;
  const resolvedSearchParams =
    searchParamsSource && typeof (searchParamsSource as unknown as Promise<unknown>).then === "function"
      ? await searchParamsSource
      : searchParamsSource || {};

  const tokenParam = (resolvedSearchParams as Record<string, string | string[] | undefined>)?.token;
  const rawToken = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam || null;
  const token =
    rawToken && rawToken.length > 0
      ? rawToken.trim().replace(/ /g, "+")
      : null;

  let status: VerifyStatus = "none";

  if (!token) {
    if (debugEmailVerify) {
      console.log("[email-verify] page.verify missing token", {
        hasTokenParam: rawToken != null && rawToken.length > 0,
      });
    }
    status = "invalid";
  } else {
    try {
      const result = await dbService.verifyEmailByToken(token);

      if (!result.ok) {
        if (result.reason === "expired") {
          status = "expired";
        } else {
          status = "invalid";
        }
      } else {
        const sessionId = cookieStore.get("session_id")?.value || null;

        if (sessionId) {
          const session = await dbService.getSession(sessionId);
          if (session) {
            if (!result.userId || session.userId === result.userId) {
              redirect("/dashboard?verified=1");
            } else if (debugEmailVerify) {
              console.log("[email-verify] page.verify session mismatch", {
                sessionUserId: session.userId,
                tokenUserId: result.userId,
              });
            }
          }
        }

        redirect("/login?verified=1");
      }
    } catch (error: unknown) {
      const maybeRedirectError = error as Error & { digest?: string };
      const isNextRedirect =
        maybeRedirectError &&
        (maybeRedirectError.digest === "NEXT_REDIRECT" ||
          (typeof maybeRedirectError.message === "string" &&
            maybeRedirectError.message.includes("NEXT_REDIRECT")));

      if (isNextRedirect) {
        throw error;
      }

      if (debugEmailVerify) {
        console.error("[email-verify] page.verify exception", error);
      }
      status = "error";
    }
  }

  let content;
  if (status === "invalid" || status === "expired" || status === "error") {
    content = (
      <div className="space-y-4 text-center py-6">
        <div className="w-16 h-16 rounded-full bg-[#ef4444]/10 text-[#ef4444] flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={32} />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">
          {t(lang as Lang, `verify.${status}.title`)}
        </h1>
        <p className="text-[#94a3b8] mb-6 leading-relaxed">
          {t(lang as Lang, `verify.${status}.body`)}
        </p>
        <div className="flex flex-col gap-4">
          <Button asChild className="w-full bg-gradient-to-r from-[#c5993c] to-[#e6b95c] text-black font-semibold rounded-full py-6 text-lg hover:opacity-90 border-none transition-opacity">
            <Link href="/login">
              {t(lang as Lang, "verify.common.goToLogin")}
            </Link>
          </Button>
          {(status === "invalid" || status === "expired") && (
            <Button variant="outline" asChild className="w-full bg-[#1d252f] text-white hover:bg-[#161c24] border border-white/10 rounded-full py-6 font-medium transition-colors">
              <Link href="/settings">
                {t(lang as Lang, "verify.invalid.resend")}
              </Link>
            </Button>
          )}
        </div>
      </div>
    );
  } else {
    content = (
      <div className="space-y-4 text-center py-6">
        <div className="w-16 h-16 rounded-full bg-[#0fc9a7]/10 text-[#0fc9a7] flex items-center justify-center mx-auto mb-4 animate-pulse">
          <CheckCircle2 size={32} />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">
          {t(lang as Lang, "verify.loading.title")}
        </h1>
        <p className="text-[#94a3b8]">
          {t(lang as Lang, "verify.loading.body")}
        </p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#06090c] text-[#f0f4f8] selection:bg-[#0fc9a7]/20 selection:text-[#0fc9a7]">
      <Header />
      <div className="min-h-screen pt-32 pb-20 flex flex-col justify-center relative z-10">
        <div className="absolute inset-0 bg-[rgba(2,5,8,0.78)] backdrop-blur-[14px] -z-10" />

        <Container>
          <div className="w-full max-w-[30rem] mx-auto p-8 rounded-[1.5rem] bg-[#0e1218] border border-white/10 shadow-[0_30px_90px_rgba(0,0,0,0.5)] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-full h-[150px] pointer-events-none" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(15, 201, 167, 0.1), transparent 38%)' }} />

            <div className="flex items-center justify-between mb-8 relative z-10">
              <div>
                <div className="relative w-[5.75rem] h-10 mb-2">
                  <Image src="/brand/design-preview-logo.png" alt="isaudi.ai" fill className="object-contain" />
                </div>
                <span className="text-[#e6b95c] text-[0.78rem] font-bold tracking-[0.04em]">
                  {t(lang as Lang, "verify.eyebrow")}
                </span>
              </div>
              <Link href="/">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t(lang as Lang, "header.nav.closeMenu")}
                  className="w-10 h-10 rounded-full border border-white/10 bg-[#161c24] text-white hover:bg-white/10"
                >
                  <X size={20} />
                </Button>
              </Link>
            </div>

            <div className="relative z-10">
              {content}
            </div>
          </div>
        </Container>
      </div>
    </main>
  );
}
