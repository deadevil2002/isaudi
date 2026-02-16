import { Resend } from 'resend';

type EmailEnv = {
  RESEND_API_KEY?: string | null;
  RESEND_FROM?: string | null;
  EMAIL_PROVIDER?: string | null;
  DEV_OTP?: string | null;
};

const defaultFrom = 'no-reply@updates.isaudi.ai';

function createResend(apiKey?: string | null): Resend | null {
  const trimmed = apiKey ? apiKey.trim() : '';
  return trimmed ? new Resend(trimmed) : null;
}

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

export async function sendOTPEmail(email: string, code: string, env: EmailEnv = {}, isProd = false) {
  const provider = env.EMAIL_PROVIDER ?? null;
  const isResend = provider === 'resend';
  const devOtp = env.DEV_OTP === 'true';
  const resend = createResend(env.RESEND_API_KEY ?? null);

  if (!isResend || !resend) {
    if (!isProd && devOtp) {
      console.log(`
        =========================================
        [DEV MODE] OTP Request
        To: ${email}
        Code: ${code}
        =========================================
      `);
      return { success: true, mode: 'dev' };
    }

    if (isResend && !resend) {
      console.error('Resend API key missing but EMAIL_PROVIDER is set to "resend".');
    }

    return { success: false, mode: 'disabled' };
  }

  const fromEmail = resolveFromEmail(env.RESEND_FROM ?? null, provider);

  try {
    await resend.emails.send({
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
      `
    });
    return { success: true, mode: 'resend' };
  } catch (error: any) {
    console.error('Failed to send email:', error);
    return {
      success: false,
      error: {
        status: error?.status ?? error?.response?.status ?? undefined,
        name: error?.name ?? undefined,
        message: typeof error?.message === 'string' ? error.message : undefined,
      },
    };
  }
}
