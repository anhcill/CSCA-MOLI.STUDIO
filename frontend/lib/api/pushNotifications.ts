import axios from '@/lib/utils/axios';

export interface PushStatus {
  configured: boolean;
  publicKey: string;
  activeCount: number;
}

export async function getPushStatus(): Promise<PushStatus> {
  const response = await axios.get('/notifications/push/status');
  return response.data.data;
}

export async function savePushSubscription(subscription: PushSubscription) {
  const response = await axios.post('/notifications/push/subscribe', {
    subscription: subscription.toJSON(),
  });
  return response.data.data;
}

export async function disablePushSubscription(endpoint?: string) {
  const response = await axios.post('/notifications/push/unsubscribe', { endpoint });
  return response.data;
}

export async function sendPushTest() {
  const response = await axios.post('/notifications/push/test');
  return response.data.data;
}
