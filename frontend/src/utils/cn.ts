import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function to merge Tailwind CSS classes using clsx and tailwind-merge.
 * This helps to conditionally apply classes and resolve conflicting Tailwind utilities.
 * 
 * @param {...ClassValue[]} inputs - Class names or conditional class objects
 * @returns {string} Merged class string
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

