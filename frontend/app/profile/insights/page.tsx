import InsightsDashboard from '@/components/insights/InsightsDashboard';
import { getCurrentUser } from '@/lib/api/auth';
import { redirect } from 'next/navigation';

export default async function InsightsPage() {
  let user = null;

  try {
    const res = await getCurrentUser();
    if (res?.success && res?.data?.user) {
      user = res.data.user;
    }
  } catch {
    redirect('/login');
  }

  return <InsightsDashboard />;
}
