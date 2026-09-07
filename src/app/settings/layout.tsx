import { noIndexMetadata } from '@/lib/seo/metadata';

export const metadata = noIndexMetadata;

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}