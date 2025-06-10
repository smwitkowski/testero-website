/** @jest-environment node */
import { NextRequest } from 'next/server';

let serverSupabaseMock: any = { auth: { getUser: jest.fn() }, from: jest.fn() };
let clientSupabaseMock: any = { from: jest.fn() };

jest.mock('../lib/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(() => serverSupabaseMock),
}));

jest.mock('../lib/supabase/client', () => ({
  supabase: clientSupabaseMock,
}));

import { POST as waitlistPOST } from '../app/api/waitlist/route';
import { GET as listGET } from '../app/api/questions/list/route';
import { GET as currentGET } from '../app/api/question/current/route';
import { GET as idGET } from '../app/api/question/[id]/route';
import { POST as submitPOST } from '../app/api/question/submit/route';
import { GET as diagnosticGET, POST as diagnosticPOST } from '../app/api/diagnostic/route';

describe('API routes', () => {
  beforeEach(() => {
    serverSupabaseMock.auth.getUser.mockReset();
    serverSupabaseMock.from.mockReset();
    clientSupabaseMock.from.mockReset();
    (global as any).fetch = jest.fn();
    process.env.LOOPS_API_KEY = 'test';
  });

  describe('waitlist POST', () => {
    it('valid submission', async () => {
      const selectMock = jest.fn().mockResolvedValue({ data: [{ id: 1 }], error: null });
      const insertMock = jest.fn(() => ({ select: selectMock }));
      clientSupabaseMock.from.mockReturnValue({ insert: insertMock });
      (global as any).fetch.mockResolvedValue({ ok: true, json: async () => ({}) });

      const req = new NextRequest('http://localhost/api/waitlist', {
        method: 'POST',
        body: JSON.stringify({ email: 'a@test.com', examType: 'GME' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await waitlistPOST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ success: true });
      expect(clientSupabaseMock.from).toHaveBeenCalledWith('waitlist');
    });

    it('invalid email returns 400', async () => {
      const req = new NextRequest('http://localhost/api/waitlist', {
        method: 'POST',
        body: JSON.stringify({ email: 'not-an-email' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await waitlistPOST(req);
      expect(res.status).toBe(400);
    });

    it('handles duplicate email', async () => {
      const selectMock = jest.fn().mockResolvedValue({ data: null, error: { code: '23505' } });
      const insertMock = jest.fn(() => ({ select: selectMock }));
      clientSupabaseMock.from.mockReturnValue({ insert: insertMock });
      (global as any).fetch.mockResolvedValue({ ok: true, json: async () => ({}) });

      const req = new NextRequest('http://localhost/api/waitlist', {
        method: 'POST',
        body: JSON.stringify({ email: 'dup@test.com' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await waitlistPOST(req);
      expect(res.status).toBe(409);
    });
  });

  describe('questions list', () => {
    it('returns question ids', async () => {
      serverSupabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 1 } }, error: null });
      const orderMock = jest.fn().mockResolvedValue({ data: [{ id: 1 }, { id: 2 }], error: null });
      const selectMock = jest.fn(() => ({ order: orderMock }));
      serverSupabaseMock.from.mockReturnValue({ select: selectMock });

      const res = await listGET();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.questionIds).toEqual([1, 2]);
    });

    it('requires auth', async () => {
      serverSupabaseMock.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
      const res = await listGET();
      expect(res.status).toBe(401);
    });
  });

  describe('current question', () => {
    it('returns latest question', async () => {
      serverSupabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 1 } }, error: null });
      const singleMock = jest.fn().mockResolvedValue({ data: { id: 5, stem: 'q' }, error: null });
      const limitMock = jest.fn(() => ({ single: singleMock }));
      const orderMock = jest.fn(() => ({ limit: limitMock }));
      const selectMockQ = jest.fn(() => ({ order: orderMock }));
      serverSupabaseMock.from.mockReturnValueOnce({ select: selectMockQ });

      const eqMock = jest.fn().mockResolvedValue({ data: [{ id: 1, label: 'A', text: 't' }], error: null });
      const selectMockO = jest.fn(() => ({ eq: eqMock }));
      serverSupabaseMock.from.mockReturnValueOnce({ select: selectMockO });

      const res = await currentGET();
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.id).toBe(5);
      expect(data.options.length).toBe(1);
    });
  });

  describe('question by id', () => {
    it('returns question data', async () => {
      serverSupabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 1 } }, error: null });
      const singleMock = jest.fn().mockResolvedValue({ data: { id: 9, stem: 'what?' }, error: null });
      const eqMock = jest.fn(() => ({ single: singleMock }));
      const selectMockQ = jest.fn(() => ({ eq: eqMock }));
      serverSupabaseMock.from.mockReturnValueOnce({ select: selectMockQ });

      const eqOptMock = jest.fn().mockResolvedValue({ data: [], error: null });
      const selectMockO = jest.fn(() => ({ eq: eqOptMock }));
      serverSupabaseMock.from.mockReturnValueOnce({ select: selectMockO });

      const req = new NextRequest('http://localhost/api/question/9');
      const res = await idGET(req);
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.id).toBe(9);
    });
  });

  describe('submit answer', () => {
    it('evaluates answer', async () => {
      serverSupabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 1 } }, error: null });
      const eqOptMock = jest.fn().mockResolvedValue({ data: [
        { id: 1, label: 'A', is_correct: false },
        { id: 2, label: 'B', is_correct: true },
      ], error: null });
      const selectMockO = jest.fn(() => ({ eq: eqOptMock }));
      serverSupabaseMock.from.mockReturnValueOnce({ select: selectMockO });

      const singleExpMock = jest.fn().mockResolvedValue({ data: { text: 'exp' }, error: null });
      const selectExpMock = jest.fn(() => ({ eq: jest.fn(() => ({ single: singleExpMock })) }));
      serverSupabaseMock.from.mockReturnValueOnce({ select: selectExpMock });

      const req = new Request('http://localhost/api/question/submit', {
        method: 'POST',
        body: JSON.stringify({ questionId: 1, selectedOptionKey: 'B' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await submitPOST(req);
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.isCorrect).toBe(true);
      expect(json.explanationText).toBe('exp');
    });

    it('missing fields', async () => {
      const req = new Request('http://localhost/api/question/submit', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await submitPOST(req);
      expect(res.status).toBe(400);
    });
  });

  describe('diagnostic route', () => {
    beforeEach(() => {
      const isMock = jest.fn(() => Promise.resolve({ error: null }));
      const ltMock = jest.fn(() => ({ is: isMock }));
      const deleteMock = jest.fn(() => ({ lt: ltMock }));
      serverSupabaseMock.from.mockReturnValue({ delete: deleteMock });
      serverSupabaseMock.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    });
    it('rejects invalid action', async () => {
      const req = new Request('http://localhost/api/diagnostic', {
        method: 'POST',
        body: JSON.stringify({ action: 'bad' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await diagnosticPOST(req);
      expect(res.status).toBe(400);
    });

    it('requires session id for GET', async () => {
      const req = new Request('http://localhost/api/diagnostic');
      const res = await diagnosticGET(req as any);
      expect(res.status).toBe(400);
    });
  });
});
