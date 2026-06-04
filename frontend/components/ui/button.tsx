import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 rounded-2xl border-2 border-transparent bg-clip-padding text-sm font-bold focus-visible:ring-[3px] aria-invalid:ring-[3px] [&_svg:not([class*='size-'])]:size-5 inline-flex items-center justify-center whitespace-nowrap transition-all duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none shrink-0 [&_svg]:shrink-0 outline-none group/button select-none",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90 border-primary-foreground/20 shadow-clay',
        cta: 'bg-cta text-cta-foreground hover:bg-cta/90 border-cta-foreground/20 shadow-clay',
        outline:
          'border-input bg-background hover:bg-accent hover:text-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 aria-expanded:bg-muted aria-expanded:text-foreground shadow-clay-sm',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 border-secondary-foreground/20 shadow-clay',
        ghost:
          'hover:bg-muted hover:text-foreground dark:hover:bg-muted/50 aria-expanded:bg-muted aria-expanded:text-foreground',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 border-destructive-foreground/20 shadow-clay',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default:
          'h-11 gap-1.5 px-6 in-data-[slot=button-group]:rounded-2xl has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4',
        xs: "h-8 gap-1 rounded-lg px-3 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-4",
        sm: 'h-9 gap-1 rounded-xl px-4 in-data-[slot=button-group]:rounded-xl has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3',
        lg: 'h-14 gap-2 px-8 rounded-3xl text-lg has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5',
        icon: 'size-11 rounded-2xl',
        'icon-xs':
          "size-8 rounded-lg in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-4",
        'icon-sm':
          'size-9 rounded-xl in-data-[slot=button-group]:rounded-xl',
        'icon-lg': 'size-14 rounded-3xl',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : 'button';

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
