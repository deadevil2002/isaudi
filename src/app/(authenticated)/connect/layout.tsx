import { noIndexMetadata } from '@/lib/seo/metadata';

export const metadata = noIndexMetadata;

export default function ConnectLayout({ children }: { children: React.ReactNode }) {
  return children;
}