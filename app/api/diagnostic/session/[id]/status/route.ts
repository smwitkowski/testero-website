import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAnonymousSessionIdFromCookie } from '@/lib/auth/anonymous-session-server';
import { requireSubscriber } from '@/lib/auth/require-subscriber';

export async function GET(req: Request) {
  // Premium gate check
  const block = await requireSubscriber(req, "/api/diagnostic/session/[id]/status");
  if (block) return block;

  const supabase = createServerSupabaseClient();
  
  try {
    // Extract session ID from the URL path
    const pathParts = new URL(req.url).pathname.split('/');
    const sessionId = pathParts[pathParts.length - 2]; // status is the last part, id is second to last
    const { searchParams } = new URL(req.url);
    const clientAnonymousSessionId = searchParams.get('anonymousSessionId');
    
    // Try to get anonymous session ID from cookie as fallback
    const cookieAnonymousSessionId = await getAnonymousSessionIdFromCookie();
    const effectiveAnonymousSessionId = clientAnonymousSessionId || cookieAnonymousSessionId;

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
    }

    const { data: { user } } = await supabase.auth.getUser();

    // Fetch session from DB
    const { data: dbSession, error: sessionError } = await supabase
      .from('diagnostics_sessions')
      .select('id, user_id, anonymous_session_id, completed_at, expires_at, exam_type, started_at')
      .eq('id', sessionId)
      .single();

    if (sessionError || !dbSession) {
      return NextResponse.json({ 
        exists: false,
        status: 'not_found'
      });
    }

    // Check if session expired
    if (dbSession.expires_at && new Date(dbSession.expires_at) < new Date()) {
      return NextResponse.json({ 
        exists: true,
        status: 'expired'
      });
    }

    // Authorization check
    if (dbSession.user_id) {
      // Session belongs to a logged-in user
      if (!user || dbSession.user_id !== user.id) {
        return NextResponse.json({ 
          exists: true,
          status: 'unauthorized'
        });
      }
    } else {
      // Anonymous session
      if (dbSession.anonymous_session_id && effectiveAnonymousSessionId !== dbSession.anonymous_session_id) {
        return NextResponse.json({ 
          exists: true,
          status: 'unauthorized'
        });
      }
    }

    // Check if session is completed
    if (dbSession.completed_at) {
      return NextResponse.json({ 
        exists: true,
        status: 'completed',
        completedAt: dbSession.completed_at
      });
    }

    // Session is active and accessible
    return NextResponse.json({ 
      exists: true,
      status: 'active',
      examType: dbSession.exam_type,
      startedAt: dbSession.started_at,
      expiresAt: dbSession.expires_at
    });

  } catch (error) {
    console.error('GET diagnostic session status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}