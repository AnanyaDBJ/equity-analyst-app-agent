import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';

type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageContent = ({
  children,
  className,
  ...props
}: MessageContentProps) => (
  <div
    className={cn(
      'flex flex-col gap-2 overflow-hidden rounded-xl px-4 py-3 text-foreground text-sm transition-all duration-300',
      'group-[.is-user]:bg-gradient-to-br group-[.is-user]:from-primary group-[.is-user]:to-accent group-[.is-user]:text-primary-foreground group-[.is-user]:shadow-md',
      'group-[.is-assistant]:border group-[.is-assistant]:border-border group-[.is-assistant]:bg-card group-[.is-assistant]:text-foreground group-[.is-assistant]:shadow-sm',
      'hover:scale-[1.01] hover:shadow-lg',
      'is-user:dark',
      className,
    )}
    {...props}
  >
    {children}
  </div>
);
