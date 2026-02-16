import { sendEmailResend, type ResendResult } from './resend';

type EmailEnv = {
  RESEND_API_KEY?: string | null;
  RESEND_FROM?: string | null;
  EMAIL_PROVIDER?: string | null;
  DEV_OTP?: string | null;
};

type SendEmailArgs = {
  to: string;
  subject: string;
  html: string;
};

const defaultFrom = 'no-reply@updates.isaudi.ai';

function resolveFromEmail(envFrom?: string | null, provider?: string | null): string {
  const trimmed = envFrom ? envFrom.trim() : '';
  let value = trimmed || defaultFrom;

  if (!trimmed && provider === 'resend') {
    console.warn(
      'EMAIL_PROVIDER is "resend" but RESEND_FROM is not set; using default no-reply@updates.isaudi.ai'
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
      'EMAIL_PROVIDER is "resend" but RESEND_FROM is not on verified domain updates.isaudi.ai'
    );
  }

  return value;
}

export async function sendOTPEmail(email: string, code: string, env: EmailEnv = {}, isProd = false) {
  const providerRaw = typeof env.EMAIL_PROVIDER === 'string' ? env.EMAIL_PROVIDER.trim() : '';
  const provider = providerRaw ? providerRaw.toLowerCase() : '';
  const resendKeyValue = typeof env.RESEND_API_KEY === 'string' ? env.RESEND_API_KEY.trim() : '';
  const resendFromValue = typeof env.RESEND_FROM === 'string' ? env.RESEND_FROM.trim() : '';
  const hasResendKey = resendKeyValue.length > 0;
  const normalizedProvider = provider || (hasResendKey ? 'resend' : '');
  const devOtp = env.DEV_OTP === 'true';

  if (!isProd && devOtp && normalizedProvider !== 'resend') {
    console.log(`
      =========================================
      [DEV MODE] OTP Request
      To: ${email}
      Code: ${code}
      =========================================
    `);
    return { success: true, mode: 'dev' };
  }

  if (isProd && normalizedProvider !== 'resend') {
    return {
      success: false,
      error: {
        message: 'Email provider not configured',
        provider: normalizedProvider,
        hasResendKey,
      },
    };
  }

  if (!hasResendKey || !resendFromValue) {
    return { success: false, mode: 'disabled' };
  }

  const fromEmail = resolveFromEmail(resendFromValue, normalizedProvider || null);

  try {
    const result: ResendResult = await sendEmailResend({
      env: { ...env, RESEND_API_KEY: resendKeyValue },
      from: fromEmail,
      to: email,
      subject: 'رمز الدخول لمنصة isaudi.ai',
      html: `
        <div dir="rtl" style="font-family: sans-serif; padding: 20px;">
          <h2>مرحبًا 👋</h2>
          <p>رمز الدخول الخاص بك هو:</p>
          <h1 style="color: #006C35; letter-spacing: 5px; font-size: 32px;">${code}</h1>
          <p>هذا الرمز صالح لمدة 10 دقائق.</p>
        </div>
      `,
    });
    if (!result.ok) {
      return {
        success: false,
        error: {
          status: result.status,
          message: result.error || 'Resend API error',
          body: result.body,
        },
      };
    }
    return { success: true, mode: 'resend', status: result.status };
  } catch (error) {
    return {
      success: false,
      error: {
        message: 'Resend API request failed',
        detail: typeof error === 'string' ? error : JSON.stringify(error),
      },
    };
  }
}

export async function sendEmail(env: { RESEND_API_KEY?: string; RESEND_FROM?: string }, args: SendEmailArgs): Promise<any>;
export async function sendEmail(args: SendEmailArgs): Promise<any>;
export async function sendEmail(arg1: any, arg2?: any): Promise<any> {
  const env = arg2 ? (arg1 as { RESEND_API_KEY?: string; RESEND_FROM?: string }) : process.env;
  const args: SendEmailArgs = arg2 ? arg2 : arg1;

  const apiKey = (env.RESEND_API_KEY || '').trim();
  const from = (env.RESEND_FROM || '').trim();
  if (!apiKey || !from) {
    const err: any = new Error('Missing Resend config');
    err.status = 'config_missing';
    throw err;
  }

  let resp: Response | null = null;
  try {
    resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: args.to,
        subject: args.subject,
        html: args.html,
      }),
    });
  } catch (error: any) {
    const err: any = new Error('Resend fetch failed');
    err.status = 'fetch_error';
    err.resend = {
      message: typeof error?.message === 'string' ? error.message : undefined,
      name: error?.name ?? undefined,
      stack: typeof error?.stack === 'string' ? error.stack : undefined,
    };
    throw err;
  }

  const raw = await resp.text();
  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw ? raw.slice(0, 2000) : null;
  }

  if (!resp.ok) {
    const err: any = new Error('Email send failed');
    err.status = resp.status;
    err.resend = data;
    throw err;
  }

  return data;
}
