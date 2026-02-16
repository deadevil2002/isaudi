import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/header";
import { dbService } from "@/lib/db/service";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { t, Lang } from "@/lib/i18n/translations";

type VerifyStatus = "invalid" | "expired" | "error" | "none";

export default async function VerifyPage(props: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const debugEmailVerify =
    process.env.NODE_ENV !== "production" ||
    process.env.DEBUG_EMAIL_VERIFY === "1";

  const cookieStore = await cookies();
  const lang = cookieStore.get("lang")?.value === "en" ? "en" : "ar";

  const searchParamsSource = (props as any).searchParams;
  const resolvedSearchParams =
    searchParamsSource && typeof (searchParamsSource as any).then === "function"
      ? await searchParamsSource
      : searchParamsSource || {};

  const tokenParam = resolvedSearchParams?.token;
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
    } catch (error) {
      const maybeRedirectError = error as any;
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
  if (status === "invalid") {
    content = (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          {t(lang as Lang, "verify.invalid.title")}
        </h1>
        <p className="text-gray-600">
          {t(lang as Lang, "verify.invalid.body")}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-4">
          <Button asChild>
            <a href="/login">
              {t(lang as Lang, "verify.common.goToLogin")}
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/settings">
              {t(lang as Lang, "verify.invalid.resend")}
            </a>
          </Button>
        </div>
      </div>
    );
  } else if (status === "expired") {
    content = (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          {t(lang as Lang, "verify.expired.title")}
        </h1>
        <p className="text-gray-600">
          {t(lang as Lang, "verify.expired.body")}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-4">
          <Button asChild>
            <a href="/login">
              {t(lang as Lang, "verify.common.goToLogin")}
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/settings">
              {t(lang as Lang, "verify.invalid.resend")}
            </a>
          </Button>
        </div>
      </div>
    );
  } else if (status === "error") {
    content = (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          {t(lang as Lang, "verify.error.title")}
        </h1>
        <p className="text-gray-600">
          {t(lang as Lang, "verify.error.body")}
        </p>
        <Button className="mt-4" asChild>
          <a href="/login">
            {t(lang as Lang, "verify.common.backToLogin")}
          </a>
        </Button>
      </div>
    );
  } else {
    content = (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          {t(lang as Lang, "verify.loading.title")}
        </h1>
        <p className="text-gray-600">
          {t(lang as Lang, "verify.loading.body")}
        </p>
      </div>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen pt-32 pb-20 bg-gray-50 flex flex-col justify-center">
        <Container>
          <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden p-8">
            {content}
          </div>
        </Container>
      </div>
    </>
  );
}
