import { cn } from '../../lib/utils';

type SkeletonProps = {
  className?: string;
  variant?: 'text' | 'circle' | 'rect' | 'card';
  lines?: number;
  animate?: boolean;
};

export default function Skeleton({
  className,
  variant = 'text',
  lines = 1,
  animate = true,
}: SkeletonProps) {
  const baseClass = cn(
    'rounded-md bg-[hsl(var(--muted)/0.25)]',
    animate && 'animate-pulse',
    className
  );

  if (variant === 'circle') {
    return (
      <div className={cn(baseClass, 'h-10 w-10 rounded-full', className)} aria-hidden="true" />
    );
  }

  if (variant === 'rect') {
    return <div className={cn(baseClass, 'h-32 w-full', className)} aria-hidden="true" />;
  }

  if (variant === 'card') {
    return (
      <div
        className={cn(
          'space-y-3 rounded-2xl border border-[hsl(var(--border)/0.2)] p-6',
          className
        )}
        aria-hidden="true"
      >
        <div className={cn(baseClass, 'h-6 w-1/3')} />
        <div className={cn(baseClass, 'h-4 w-full')} />
        <div className={cn(baseClass, 'h-4 w-5/6')} />
        <div className={cn(baseClass, 'h-4 w-4/6')} />
      </div>
    );
  }

  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn(baseClass, 'h-4', i === lines - 1 && lines > 1 ? 'w-2/3' : 'w-full')}
          style={{ animationDelay: `${i * 100}ms` }}
        />
      ))}
    </div>
  );
}
