import { NextRequest } from 'next/server';

jest.mock('@supabase/ssr', () => ({
  createBrowserClient: jest.fn(),
  createServerClient: jest.fn(),
}));

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

let createBrowserClient: jest.Mock;
let createServerClient: jest.Mock;
let cookiesFn: jest.Mock;

beforeEach(() => {
  jest.resetModules();
  ({ createBrowserClient, createServerClient } = require('@supabase/ssr'));
  ({ cookies: cookiesFn } = require('next/headers'));
  createBrowserClient.mockReset();
  createServerClient.mockReset();
  cookiesFn.mockReset();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'url';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'key';
});

describe('supabase client helper', () => {
  it('creates browser client with env vars', () => {
    const mock = {};
    createBrowserClient.mockReturnValue(mock);
    const { createClient } = require('../lib/supabase/client');
    const client = createClient();
    expect(createBrowserClient).toHaveBeenCalledWith('url', 'key');
    expect(client).toBe(mock);
  });

  it('default supabase instance uses createClient', () => {
    const mock = {};
    createBrowserClient.mockReturnValue(mock);
    const mod = require('../lib/supabase/client');
    expect(mod.supabase).toBe(mock);
  });
});

describe('supabase server helper', () => {
  it('sets up cookie handlers and calls createServerClient', async () => {
    const store = {
      get: jest.fn(async () => 'val'),
      set: jest.fn(async () => undefined),
    };
    cookiesFn.mockResolvedValue(store);
    const client = {};
    createServerClient.mockReturnValue(client);
    const { createServerSupabaseClient } = require('../lib/supabase/server');
    const result = createServerSupabaseClient();
    expect(result).toBe(client);
    expect(createServerClient).toHaveBeenCalledWith('url', 'key', expect.any(Object));
    const opts = createServerClient.mock.calls[0][2];
    await opts.cookies.get('a');
    expect(store.get).toHaveBeenCalledWith('a');
    await opts.cookies.set('b', 'c', { path: '/' });
    expect(store.set).toHaveBeenCalledWith('b', 'c', { path: '/' });
    await opts.cookies.remove('d', { path: '/' });
    expect(store.set).toHaveBeenCalledWith('d', '', { path: '/', maxAge: 0 });
  });

  it('logs error when cookie set fails', async () => {
    const error = new Error('fail');
    const store = {
      get: jest.fn(async () => undefined),
      set: jest.fn(() => {
        throw error;
      }),
    };
    cookiesFn.mockResolvedValue(store);
    createServerClient.mockReturnValue({});
    const { createServerSupabaseClient } = require('../lib/supabase/server');
    createServerSupabaseClient();
    const opts = createServerClient.mock.calls[0][2];
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await opts.cookies.set('a', 'b', { path: '/' });
    expect(console.error).toHaveBeenCalledWith(
      '[Server Supabase] Cookie a: Set failed (expected in server components)',
      error
    );
    (console.error as jest.Mock).mockRestore();
  });

  it('logs error when cookie remove fails', async () => {
    const error = new Error('remove fail');
    const store = {
      get: jest.fn(async () => undefined),
      set: jest.fn(() => {
        throw error;
      }),
    };
    cookiesFn.mockResolvedValue(store);
    createServerClient.mockReturnValue({});
    const { createServerSupabaseClient } = require('../lib/supabase/server');
    createServerSupabaseClient();
    const opts = createServerClient.mock.calls[0][2];
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await opts.cookies.remove('a', { path: '/' });
    expect(console.error).toHaveBeenCalledWith(
      '[Server Supabase] Cookie a: Remove failed',
      error
    );
    (console.error as jest.Mock).mockRestore();
  });
});

describe('supabase middleware updateSession', () => {
  it('redirects unauthenticated users on protected paths', async () => {
    const supabase = { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) } };
    createServerClient.mockReturnValue(supabase);
    const { updateSession } = require('../lib/supabase/middleware');
    const req = new NextRequest('http://example.com/protected');
    const res = await updateSession(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://example.com/login');
    expect(supabase.auth.getUser).toHaveBeenCalled();
  });

  it('returns next response when authenticated', async () => {
    const supabase = { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 1 } }, error: null }) } };
    createServerClient.mockReturnValue(supabase);
    const { updateSession } = require('../lib/supabase/middleware');
    const req = new NextRequest('http://example.com/protected');
    const res = await updateSession(req);
    expect(res.status).toBe(200);
  });

  it('allows unauthenticated access to login path', async () => {
    const supabase = { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) } };
    createServerClient.mockReturnValue(supabase);
    const { updateSession } = require('../lib/supabase/middleware');
    const req = new NextRequest('http://example.com/login');
    const res = await updateSession(req);
    expect(res.status).toBe(200);
  });
});

