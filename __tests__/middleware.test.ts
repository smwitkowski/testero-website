import { NextRequest } from 'next/server';

jest.mock('@/lib/supabase/middleware', () => ({
  updateSession: jest.fn(),
}));

const { updateSession } = require('@/lib/supabase/middleware');

describe('root middleware', () => {
  it('delegates to updateSession', async () => {
    const res = new Response('ok');
    (updateSession as jest.Mock).mockResolvedValue(res);
    const { middleware } = require('../middleware');
    const req = new NextRequest('http://example.com');
    const result = await middleware(req);
    expect(updateSession).toHaveBeenCalledWith(req);
    expect(result).toBe(res);
  });

  it('exports matcher config', () => {
    const { config } = require('../middleware');
    expect(config).toEqual({
      matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
      ],
    });
  });
});

