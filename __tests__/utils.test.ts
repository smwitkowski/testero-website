import { cn } from '../lib/utils';

describe('cn utility', () => {
  it('merges tailwind classes', () => {
    expect(cn('text-sm', 'text-lg')).toBe('text-lg');
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1');
  });
});
