import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckSquare,
  ListTodo,
  Coins,
  Bell,
  CalendarDays,
  GraduationCap,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { isAdminRole } from '@/utils/permissions';

const pageVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
};

interface PageWrapperProps {
  children: React.ReactNode;
  unreadNotifications?: number;
}

export function PageWrapper({ children, unreadNotifications = 0 }: PageWrapperProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { userProfile } = useAuth();
  const role = userProfile?.role ?? 'member';
  const isEmployee = !isAdminRole(role);

  return (
    <div className="flex h-screen app-bg overflow-hidden font-sans">
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onMobileMenuClick={() => setMobileOpen(true)} />

        <main className="flex-1 overflow-y-auto">
          <motion.div
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="p-3.5 sm:p-6 lg:p-7 max-w-[1440px] mx-auto w-full pb-24 lg:pb-8"
          >
            {children}
          </motion.div>
        </main>

        {/* Mobile bottom nav — GDG HITU Design System */}
        <nav
          className="lg:hidden fixed bottom-0 inset-x-0 z-40 px-1 py-1.5 pb-[max(0.4rem,env(safe-area-inset-bottom))]"
          style={{
            background: 'color-mix(in srgb, var(--surface) 95%, transparent)',
            backdropFilter: 'blur(16px) saturate(180%)',
            WebkitBackdropFilter: 'blur(16px) saturate(180%)',
            borderTop: '1px solid var(--border-subtle)',
            boxShadow: '0 -8px 32px rgba(0,0,0,0.4)',
          }}
        >
          <div className="flex items-center justify-around gap-1 max-w-lg mx-auto">
            {[
              { to: '/dashboard', icon: <LayoutDashboard className="h-[18px] w-[18px]" />, label: 'الرئيسية', type: 'primary' },
              { to: isEmployee ? '/my-tasks' : '/tasks', icon: isEmployee ? <ListTodo className="h-[18px] w-[18px]" /> : <CheckSquare className="h-[18px] w-[18px]" />, label: 'المهام', type: 'primary' },
              { to: '/opportunities', icon: <GraduationCap className="h-[18px] w-[18px]" />, label: 'الفرص', type: 'primary' },
              { to: '/meetings', icon: <CalendarDays className="h-[18px] w-[18px]" />, label: 'اللقاءات', type: 'primary' },
              { to: '/ocoins', icon: <Coins className="h-[18px] w-[18px]" />, label: 'O Coins', type: 'warm' },
              { to: '/notifications', icon: <Bell className="h-[18px] w-[18px]" />, label: 'التنبيهات', type: 'primary', badge: unreadNotifications },
            ].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className="relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl text-[10px] font-semibold transition-all"
                style={({ isActive }) => ({
                  color: isActive
                    ? item.type === 'warm' ? '#F59E0B' : '#A78BFA'
                    : 'var(--text-muted)',
                  background: isActive
                    ? item.type === 'warm' ? 'rgba(245,158,11,0.1)' : 'rgba(108,99,255,0.1)'
                    : 'transparent',
                  fontWeight: isActive ? 700 : 600,
                })}
              >
                {item.icon}
                <span>{item.label}</span>
                {(item.badge ?? 0) > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 min-w-[15px] h-3.5 px-0.5 text-white text-[9px] font-black rounded-full flex items-center justify-center"
                    style={{ background: 'var(--brand-danger)', boxShadow: '0 0 0 2px var(--surface)' }}
                  >
                    {(item.badge ?? 0) > 9 ? '9+' : item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
