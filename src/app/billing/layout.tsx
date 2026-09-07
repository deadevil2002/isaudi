import { noIndexMetadata } from '@/lib/seo/metadata';

export const metadata = noIndexMetadata;

export default function BillingLayout({ children }: { children: React.ReactNode }) {
  return children;
}