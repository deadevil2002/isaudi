import { sendEmailResend } from '@/lib/email/resend';
import { getRuntimeString } from '@/lib/runtime/environment';

function origin(): string {
  return (getRuntimeString('APP_URL') || 'https://isaudi.ai').replace(/\/+$/, '');
}

async function send(to: string, subject: string, html: string) {
  const result = await sendEmailResend({
    env: {
      RESEND_API_KEY: getRuntimeString('RESEND_API_KEY'),
      RESEND_FROM: getRuntimeString('RESEND_FROM'),
      EMAIL_PROVIDER: getRuntimeString('EMAIL_PROVIDER') || 'resend',
    },
    from: getRuntimeString('RESEND_FROM') || 'no-reply@updates.isaudi.ai',
    to,
    subject,
    html,
  });
  if (!result.ok) throw new Error('Email delivery failed');
}

export function sendAdminReset(to: string, token: string) {
  const url = `${origin()}/admin/reset?token=${encodeURIComponent(token)}`;
  return send(to, 'إعادة تعيين كلمة مرور الإدارة', `<div dir="rtl"><p>طلب إعادة تعيين كلمة المرور.</p><p><a href="${url}">إعادة تعيين كلمة المرور</a></p><p>تنتهي صلاحية الرابط خلال 30 دقيقة.</p></div>`);
}

export function sendAdminTransfer(to: string, token: string, code: string) {
  const url = `${origin()}/admin/transfer?token=${encodeURIComponent(token)}`;
  return send(to, 'تأكيد نقل إدارة isaudi.ai', `<div dir="rtl"><p>تم طلب نقل صلاحية المدير الأعلى إلى بريدك.</p><p>رمز التأكيد: <strong>${code}</strong></p><p><a href="${url}">تأكيد النقل</a></p><p>تنتهي الصلاحية خلال 30 دقيقة.</p></div>`);
}