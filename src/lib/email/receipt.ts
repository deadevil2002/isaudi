import { sendEmailResend } from './resend';
import { getRuntimeString } from '@/lib/runtime/environment';

interface ReceiptDetails {
  to: string;
  planName: string;
  amountSAR: number;
  interval: string;
  startDate: Date;
  endDate: Date;
  transactionId: string;
  chargeId: string;
  idempotencyKey: string;
}

export async function sendPaymentReceiptEmail(details: ReceiptDetails) {
  const subject = `Your iSaudi.ai Payment Receipt`;
  const body = `
    <h1>Thank you for your payment!</h1>
    <p>Here are your payment details:</p>
    <ul>
      <li><strong>Plan:</strong> ${details.planName}</li>
      <li><strong>Amount:</strong> ${details.amountSAR.toFixed(2)} SAR</li>
      <li><strong>Interval:</strong> ${details.interval}</li>
      <li><strong>Subscription Period:</strong> ${details.startDate.toLocaleDateString()} - ${details.endDate.toLocaleDateString()}</li>
      <li><strong>Transaction ID:</strong> ${details.transactionId}</li>
      <li><strong>Charge ID:</strong> ${details.chargeId}</li>
    </ul>
    <p>Thank you for being a valued iSaudi.ai customer!</p>
  `;

  const env = { 
    RESEND_API_KEY: getRuntimeString('RESEND_API_KEY') ?? null,
    RESEND_FROM: getRuntimeString('RESEND_FROM') ?? null,
    EMAIL_PROVIDER: getRuntimeString('EMAIL_PROVIDER') ?? null,
  }; 
  const fromEmail = env.RESEND_FROM || 'no-reply@updates.isaudi.ai';
  return sendEmailResend({
    env,
    from: fromEmail,
    to: details.to,
    subject,
    html: body,
    idempotencyKey: details.idempotencyKey,
  });
}
