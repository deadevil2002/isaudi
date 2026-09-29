import { notFound } from 'next/navigation';
import { HowItWorksPageContent } from '@/components/sections/how-it-works-page';

export default async function HowItWorksReview({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const query = await searchParams;
  const state = query.state || 'unavailable';
  const video = state === 'ready' || state === 'loading'
    ? { status: 'ready' as const, playbackUrl: 'about:blank' }
    : { status: state === 'error' ? 'error' as const : 'unavailable' as const };
  return <HowItWorksPageContent video={video} previewLoading={state === 'loading'} />;
}
