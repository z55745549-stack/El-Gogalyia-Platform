/**
 * UserNameWithRole — يعرض اسم المستخدم مع badge الرتبة
 * قابل للنقر لفتح بروفايل المستخدم
 */
import React, { useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { UserProfileModal } from '@/components/ui/user-profile-modal';
import { getRoleLabel, getRoleColor } from '@/utils/permissions';
import { formatFullName, cn } from '@/utils';
import type { UserProfile } from '@/types';

interface UserNameWithRoleProps {
  user: Pick<UserProfile, 'uid' | 'displayName' | 'username' | 'role' | 'photoURL' | 'specialtyTag' | 'committeeName' | 'committeeId' | 'employeeCode' | 'createdAt' | 'status' | 'oCoinsBalance'>;
  showAvatar?: boolean;
  avatarSize?: 'xs' | 'sm' | 'md' | 'lg';
  showRoleBadge?: boolean;
  className?: string;
  nameClassName?: string;
  clickable?: boolean;
  inline?: boolean;
}

export function UserNameWithRole({
  user,
  showAvatar = false,
  avatarSize = 'sm',
  showRoleBadge = true,
  className,
  nameClassName,
  clickable = true,
  inline = false,
}: UserNameWithRoleProps) {
  const [showProfile, setShowProfile] = useState(false);

  const name = formatFullName(user.displayName) || user.username || 'Unknown';

  const content = (
    <div className={cn('flex items-center gap-2', inline ? 'inline-flex' : '', className)}>
      {showAvatar && (
        <Avatar
          src={user.photoURL}
          name={name}
          size={avatarSize}
          className="shrink-0"
        />
      )}
      <div className="min-w-0">
        <div className={cn('flex items-center gap-1.5 flex-wrap', inline ? 'inline-flex' : '')}>
          <span
            className={cn(
              'font-bold truncate',
              clickable && 'hover:text-[var(--brand-primary)] transition-colors cursor-pointer',
              nameClassName
            )}
          >
            {name}
          </span>
          {showRoleBadge && (
            <span
              className={cn(
                'inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black shrink-0',
                getRoleColor(user.role)
              )}
            >
              {getRoleLabel(user.role)}
            </span>
          )}
        </div>
        {user.username && (
          <p className="text-[10px] font-mono font-semibold text-[var(--text-muted)] truncate">
            @{user.username}
          </p>
        )}
      </div>
    </div>
  );

  if (!clickable) return content;

  return (
    <>
      <button
        type="button"
        onClick={() => setShowProfile(true)}
        className="text-right focus:outline-none"
        aria-label={`عرض بروفايل ${name}`}
      >
        {content}
      </button>

      <UserProfileModal
        user={user as UserProfile}
        open={showProfile}
        onClose={() => setShowProfile(false)}
      />
    </>
  );
}
