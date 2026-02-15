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

export async function sendVerifyEmail(toEmail: string, verifyUrl: string): Promise<void> {
  const provider = process.env.EMAIL_PROVIDER;
  const isResend = provider === 'resend';

  if (!isResend || !resend) {
    if (isResend && !resend) {
      console.error(
        'Resend API key missing but EMAIL_PROVIDER is set to "resend". Falling back to console log.'
      );
    }
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

  const fromEmail = resolveFromEmail();

  await resend.emails.send({
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
    `
  });
}
