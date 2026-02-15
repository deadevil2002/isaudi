import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const defaultFrom = 'no-reply@updates.isaudi.ai';

function resolveFromEmail(): string {
  const provider = process.env.EMAIL_PROVIDER;
  const envFrom = process.env.EMAIL_FROM;
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

export async function sendOTPEmail(email: string, code: string) {
  const provider = process.env.EMAIL_PROVIDER;
  const isResend = provider === 'resend';

  if (!isResend) {
    console.log(`
      =========================================
      [DEV MODE] OTP Request
      To: ${email}
      Code: ${code}
      =========================================
    `);
    return { success: true, mode: 'dev' };
  }

  if (!resend) {
    console.error(
      'Resend API key missing but EMAIL_PROVIDER is set to "resend". Falling back to console log.'
    );
    console.log(`[FALLBACK] OTP for ${email}: ${code}`);
    return { success: true, mode: 'fallback' };
  }

  const fromEmail = resolveFromEmail();

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
  } catch (error) {
    console.error('Failed to send email:', error);
    return { success: false, error };
  }
}
