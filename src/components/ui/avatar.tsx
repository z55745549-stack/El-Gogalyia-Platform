import { cn, getInitials } from '@/utils';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeMap = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-xl',
};

export function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn('rounded-full object-cover shrink-0 ring-2 ring-[var(--border-subtle)]', sizeMap[size], className)}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }
  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-bold shrink-0 bg-[var(--brand-primary)]/15 text-[var(--brand-primary)] ring-2 ring-[var(--border-subtle)]',
        sizeMap[size],
        className
      )}
    >
      {getInitials(name)}
    </div>
  );
}
