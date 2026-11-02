import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from './apiFetch';

const readArray = (key: string): string[] => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value.map(String) : [];
  } catch { return []; }
};

export const alertReadKey = (userId: string) => `startupforge:read:${userId || 'guest'}`;
export const inboxSeenKey = (userId: string) => `startupforge:inbox:seen:${userId || 'guest'}`;
export const inboxUnreadKey = (userId: string) => `startupforge:inbox:unread:${userId || 'guest'}`;
export const investmentAlertId = (item: any, index = 0) => `investment-${item?.founder_id || item?.company || 'company'}-${item?.round || ''}-${item?.year || ''}-${item?.amount || ''}-${index}`;

export const saveReadIds = (key: string, ids: string[]) => {
  const values = new Set(readArray(key));
  ids.forEach(id => values.add(String(id)));
  localStorage.setItem(key, JSON.stringify([...values]));
  window.dispatchEvent(new Event('startupforge:unread-changed'));
};

export const saveSeenConversation = (userId: string, conversationId: string) => {
  const key = inboxSeenKey(userId);
  const values = new Set(readArray(key));
  values.add(String(conversationId));
  localStorage.setItem(key, JSON.stringify([...values]));
  const unreadKey = inboxUnreadKey(userId);
  localStorage.setItem(unreadKey, JSON.stringify(readArray(unreadKey).filter(id => id !== String(conversationId))));
  window.dispatchEvent(new Event('startupforge:unread-changed'));
};

export function useUnreadBadges(userId: string) {
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [unreadInbox, setUnreadInbox] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId) { setUnreadAlerts(0); setUnreadInbox(0); return; }
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const headers = { 'x-user-id': userId };
    const [acceptedResult, requestsResult, updatesResult, inboxResult] = await Promise.allSettled([
      apiFetch(`${apiUrl}/connections/notifications`, { headers }),
      apiFetch(`${apiUrl}/connections/requests/incoming`, { headers }),
      apiFetch(`${apiUrl}/api/investments/updates`, { headers }),
      apiFetch(`${apiUrl}/inbox`, { headers }),
    ]);
    const read = new Set(readArray(alertReadKey(userId)));
    const unseenAlertIds: string[] = [];
    const addIds = async (result: PromiseSettledResult<Response>, makeId: (item: any, index: number) => string) => {
      if (result.status !== 'fulfilled' || !result.value.ok) return;
      try {
        const items = await result.value.json();
        if (Array.isArray(items)) items.forEach((item, index) => unseenAlertIds.push(makeId(item, index)));
      } catch { /* Ignore malformed optional feed and keep other activity visible. */ }
    };
    await Promise.all([
      addIds(acceptedResult, item => `conn-${item.id}`),
      addIds(requestsResult, item => `req-${item.id}`),
      addIds(updatesResult, investmentAlertId),
    ]);
    setUnreadAlerts(unseenAlertIds.filter(id => !read.has(id)).length);

    let connections: any[] = [];
    if (inboxResult.status === 'fulfilled' && inboxResult.value.ok) {
      try {
        const data = await inboxResult.value.json();
        if (Array.isArray(data?.connections)) connections = data.connections;
      } catch { /* Keep cached unread indicator on a transient error. */ }
    }
    const seen = new Set(readArray(inboxSeenKey(userId)));
    const unreadMessages = new Set(readArray(inboxUnreadKey(userId)));
    const unreadConnections = connections.filter(item => !seen.has(String(item.other_user_id))).map(item => String(item.other_user_id));
    setUnreadInbox(new Set([...unreadConnections, ...unreadMessages]).size);
  }, [userId]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 15000);
    const onChange = () => refresh();
    window.addEventListener('startupforge:unread-changed', onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('startupforge:unread-changed', onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [refresh]);

  return { unreadAlerts, unreadInbox, refresh };
}
