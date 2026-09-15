import { Outlet } from 'react-router-dom';
import { PageWrapper } from './PageWrapper';
import { useNotificationCount } from '@/hooks/useNotifications';
import { FloatingAIAssistant } from '@/components/support/FloatingAIAssistant';

export function AppLayout() {
  const unreadCount = useNotificationCount();
  return (
    <PageWrapper unreadNotifications={unreadCount}>
      <Outlet />
      <FloatingAIAssistant />
    </PageWrapper>
  );
}

