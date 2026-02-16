type EmailEnv = {
  RESEND_API_KEY?: string | null;
  RESEND_FROM?: string | null;
  EMAIL_PROVIDER?: string | null;
  DEV_OTP?: string | null;
};

const defaultFrom = 'no-reply@updates.isaudi.ai';

function resolveFromEmail(envFrom?: string | null, provider?: string | null): string {
  const trimmed = envFrom ? envFrom.trim() : '';
  let value = trimmed || defaultFrom;

  if (!trimmed && provider === 'resend') {
    console.warn(
      'EMAIL_PROVIDER is "resend" but EMAIL_FROM is not set; using default no-reply@updates.isaudi.ai'
    );
  }

  let emailPart = value;
  const lt = value.indexOf('<');
  const gt = value.indexOf('>');
  if (lt !== -1 && gt !== -1 && gt > lt + 1) {
    emailPart = value.slice(lt + 1, gt);
  }

  const atIndex = emailPart.lastIndexOf('@');
  const domain = atIndex !== -1 ? emailPart.slice(atIndex + 1).toLowerCase() : '';
  const isVerifiedDomain = domain === 'updates.isaudi.ai';

  if (provider === 'resend' && !isVerifiedDomain) {
    console.warn(
      'EMAIL_PROVIDER is "resend" but EMAIL_FROM is not on verified domain updates.isaudi.ai'
    );
  }

  return value;
}

export type ResendResult =
  | { ok: true; status: number; id: string }
  | { ok: false; status: number | null; error: string; body?: unknown };

function normalizeErrorBody(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > 2000 ? `${trimmed.slice(0, 2000)}…` : trimmed;
}

export async function sendEmailResend(params: {
  env: EmailEnv;
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<ResendResult> {
  const apiKey = (params.env.RESEND_API_KEY ?? '').toString().trim();

  if (!apiKey) {
    return {
      ok: false,
      status: null,
      error: 'RESEND_API_KEY missing',
    };
  }

  let res: Response | null = null;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: params.from,
        to: params.to,
        subject: params.subject,
        html: params.html,
      }),
    });

    const text = await res.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = normalizeErrorBody(text);
      }
    }

    if (res.ok) {
      return {
        ok: true,
        status: res.status,
        id: typeof (parsed as any)?.id === 'string' ? (parsed as any).id : '',
      };
    }

    return {
      ok: false,
      status: res.status,
      error: 'Resend API request failed',
      body: parsed,
    };
  } catch (error: any) {
    return {
      ok: false,
      status: res?.status ?? null,
      error: typeof error?.message === 'string' ? error.message : 'Resend API request failed',
    };
  }
}

function redactVerifyUrl(verifyUrl: string): string {
  try {
    const url = new URL(verifyUrl);
    const token = url.searchParams.get('token');
    if (!token) return verifyUrl;
    const clean = token.trim();
    const length = clean.length;
    let redacted = clean;
    if (length > 8) {
      redacted = `${clean.slice(0, 4)}...${clean.slice(-4)}`;
    }
    url.searchParams.set('token', redacted);
    return url.toString();
  } catch {
    return verifyUrl;
  }
}

export async function sendVerifyEmail(
  toEmail: string,
  verifyUrl: string,
  env: EmailEnv = {},
  isProd = false
): Promise<void> {
  const provider = env.EMAIL_PROVIDER ?? null;
  const isResend = provider === 'resend';
  const devOtp = env.DEV_OTP === 'true';

  if (!isResend) {
    if (!isProd && devOtp) {
      const safeUrl = redactVerifyUrl(verifyUrl);
      console.log(`
        =========================================
        [DEV MODE] Verify Email
        To: ${toEmail}
        Link: ${safeUrl}
        =========================================
      `);
      return;
    }
    return;
  }

  const fromEmail = resolveFromEmail(env.RESEND_FROM ?? null, provider);

  const result = await sendEmailResend({
    env,
    from: fromEmail,
    to: toEmail,
    subject: 'تأكيد البريد الإلكتروني لمنصة isaudi.ai',
    html: `
      <div dir="rtl" style="font-family: sans-serif; padding: 20px;">
        <h2>مرحبًا 👋</h2>
        <p>اضغط على الزر التالي لتفعيل بريدك الإلكتروني:</p>
        <p style="margin: 24px 0;">
          <a href="${verifyUrl}" style="background-color: #006C35; color: #ffffff; padding: 12px 20px; border-radius: 8px; text-decoration: none;">
            تفعيل البريد الإلكتروني
          </a>
        </p>
        <p>إذا لم يعمل الزر، يمكنك نسخ الرابط التالي ولصقه في المتصفح:</p>
        <p style="direction:ltr; word-break:break-all;">${verifyUrl}</p>
      </div>
    `,
  });

  if (!result.ok) {
    console.error('[email] Resend verify email failed', {
      status: result.status,
    });
    if (!isProd && devOtp) {
      const safeUrl = redactVerifyUrl(verifyUrl);
      console.log(`
        =========================================
        [DEV MODE FALLBACK] Verify Email
        To: ${toEmail}
        Link: ${safeUrl}
        =========================================
      `);
    }
  }
}
