import { getCurrentUser } from '@/lib/auth/utils';
import { listSallaConnectionsForUser } from '@/lib/salla/repository';
import { LandingPageServicesClient } from './services-client';

export const dynamic = 'force-dynamic';

export default async function ServicesPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const stores = (await listSallaConnectionsForUser(user.id))
    .filter((store) => store.status === 'connected' && store.storefrontOrigin)
    .map((store) => ({
      merchantId: store.merchantId,
      storeName: store.storeName ?? null,
      storefrontOrigin: store.storefrontOrigin ?? null,
    }));
  return <LandingPageServicesClient stores={stores} />;
}
