import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type BlogTagPillProps = {
  name: string;
  link?: string;
  active?: boolean;
  className?: string;
};

export function BlogTagPill({ name, link, active = false, className }: BlogTagPillProps) {
  const baseClasses = 'inline-block py-1.5 md:py-2 px-6 md:px-10 rounded-full border-2 border-solid font-semibold hover:scale-105 transition-all ease duration-200 text-sm sm:text-base capitalize';
  
  const activeClasses = active
    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 border-gray-900 dark:border-white'
    : 'bg-white text-gray-900 dark:bg-gray-900 dark:text-white border-gray-900 dark:border-white';
  
  const classes = cn(baseClasses, activeClasses, className);
  
  const content = `#${name}`;
  
  if (link) {
    return (
      <Link href={link} className={classes}>
        {content}
      </Link>
    );
  }
  
  return (
    <span className={classes}>
      {content}
    </span>
  );
}
