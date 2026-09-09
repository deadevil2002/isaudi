import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'بوابة الإدارة | isaudi.ai',
  referrer: 'no-referrer',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noarchive: true } },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div dir="rtl">{children}</div>;
}