import { Outlet } from 'react-router-dom';
import { PageWrapper } from './PageWrapper';
import { useNotificationCount } from '@/hooks/useNotifications';

export function AppLayout() {
  const unreadCount = useNotificationCount();
  return (
    <PageWrapper unreadNotifications={unreadCount}>
      <Outlet />
    </PageWrapper>
  );
}
