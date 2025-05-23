import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// Types for better type safety
interface DiagnosticQuestion {
  id: number;
  stem: string;
  options: Array<{ label: string; text: string }>;
  correct: string;
  explanation: string;
}

interface DiagnosticSession {
  id: string;
  userId: string;
  examType: string;
  questions: DiagnosticQuestion[];
  answers: Record<number, string>;
  startedAt: string;
  currentQuestion: number;
  expiresAt: string; // Added expiration
}

// Simple in-memory storage for MVP (replace with Redis/DB later)
const diagnosticSessions = new Map<string, DiagnosticSession>();

// Security constants
const MAX_SESSIONS_PER_USER = 3;
const SESSION_TIMEOUT_MINUTES = 30;
const MAX_QUESTIONS = 20;
const MIN_QUESTIONS = 1;

// Utility functions
function cleanExpiredSessions() {
  const now = new Date();
  for (const [sessionId, session] of diagnosticSessions.entries()) {
    if (new Date(session.expiresAt) < now) {
      diagnosticSessions.delete(sessionId);
      console.log(`Expired session ${sessionId} cleaned up`);
    }
  }
}

function getUserSessionCount(userId: string): number {
  cleanExpiredSessions();
  return Array.from(diagnosticSessions.values()).filter(s => s.userId === userId).length;
}

function validateStartRequest(data: any): { examType: string; numQuestions: number } | null {
  if (!data || typeof data !== 'object') return null;
  
  const examType = typeof data.examType === 'string' ? data.examType.trim() : 'general';
  const numQuestions = typeof data.numQuestions === 'number' ? 
    Math.max(MIN_QUESTIONS, Math.min(MAX_QUESTIONS, Math.floor(data.numQuestions))) : 3;
    
  // Sanitize examType
  const allowedExamTypes = ['Google Cloud Architect', 'AWS Solutions Architect', 'Azure Administrator', 'general'];
  const sanitizedExamType = allowedExamTypes.includes(examType) ? examType : 'general';
  
  return { examType: sanitizedExamType, numQuestions };
}

function validateAnswerRequest(data: any): { questionId: number; selectedLabel: string } | null {
  if (!data || typeof data !== 'object') return null;
  
  const questionId = typeof data.questionId === 'number' ? Math.floor(data.questionId) : null;
  const selectedLabel = typeof data.selectedLabel === 'string' ? data.selectedLabel.trim().toUpperCase() : null;
  
  if (questionId === null || questionId < 1 || !selectedLabel || !['A', 'B', 'C', 'D'].includes(selectedLabel)) {
    return null;
  }
  
  return { questionId, selectedLabel };
}

// Simplified diagnostic questions - hardcoded for now
const SAMPLE_QUESTIONS: DiagnosticQuestion[] = [
  {
    id: 1,
    stem: "What is the primary benefit of using Google Cloud's managed services?",
    options: [
      { label: 'A', text: 'Lower costs' },
      { label: 'B', text: 'Reduced operational overhead' },
      { label: 'C', text: 'Better performance' },
      { label: 'D', text: 'More control' },
    ],
    correct: 'B',
    explanation: 'Managed services reduce operational overhead by handling infrastructure management.'
  },
  {
    id: 2,
    stem: "Which Google Cloud service is best for running containerized applications?",
    options: [
      { label: 'A', text: 'Compute Engine' },
      { label: 'B', text: 'App Engine' },
      { label: 'C', text: 'Google Kubernetes Engine' },
      { label: 'D', text: 'Cloud Functions' },
    ],
    correct: 'C',
    explanation: 'GKE is specifically designed for orchestrating containerized applications.'
  },
  {
    id: 3,
    stem: "What is the purpose of VPC in Google Cloud?",
    options: [
      { label: 'A', text: 'Virtual machine management' },
      { label: 'B', text: 'Network isolation and security' },
      { label: 'C', text: 'Data storage' },
      { label: 'D', text: 'Application deployment' },
    ],
    correct: 'B',
    explanation: 'VPC provides network isolation and security for your cloud resources.'
  }
];

export async function GET(req: Request) {
  // Get diagnostic session status
  try {
    // Clean expired sessions first
    cleanExpiredSessions();
    
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    
    console.log('--- Diagnostic GET Request ---');
    console.log('Session ID requested:', sessionId);
    console.log('Available sessions:', Array.from(diagnosticSessions.keys()));
    
    // Validate sessionId
    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'Invalid session ID provided' }, { status: 400 });
    }

    // Add authentication check to GET route
    const supabase = createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.log('Auth check failed in GET diagnostic');
      return NextResponse.json({ 
        error: 'Authentication required to access session data.'
      }, { status: 401 });
    }

    const session = diagnosticSessions.get(sessionId);
    if (!session) {
      console.log(`Session ${sessionId} not found. Available sessions: ${Array.from(diagnosticSessions.keys()).join(', ')}`);
      return NextResponse.json({ error: 'Session not found or expired. Please start a new diagnostic test.' }, { status: 404 });
    }

    // Check session expiration
    if (new Date(session.expiresAt) < new Date()) {
      diagnosticSessions.delete(sessionId);
      console.log(`Session ${sessionId} expired and removed`);
      return NextResponse.json({ error: 'Session expired. Please start a new diagnostic test.' }, { status: 410 });
    }

    // Verify session belongs to authenticated user
    if (session.userId !== user.id) {
      console.log(`Session ${sessionId} belongs to different user`);
      return NextResponse.json({ error: 'Unauthorized access to session' }, { status: 403 });
    }

    console.log(`Session ${sessionId} found successfully for user ${user.id}`);
    return NextResponse.json({ session });
  } catch (error) {
    console.error('GET diagnostic error:', error);
    // Don't leak internal error details
    return NextResponse.json({ error: 'Failed to get session' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // Clean expired sessions first
    cleanExpiredSessions();
    
    const body = await req.json();
    const { action, sessionId, data } = body;
    
    // Validate action
    if (typeof action !== 'string' || !['start', 'answer', 'complete'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    
    console.log('--- Diagnostic API Request ---');
    console.log('Action:', action);
    console.log('Session ID:', sessionId);

    const supabase = createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.log('Auth check failed: User not authenticated or session missing.');
      return NextResponse.json({ 
        error: 'Authentication required. Please log in to take the diagnostic test.'
      }, { status: 401 });
    }
    console.log('User authenticated:', user.id);
    
    switch (action) {
      case 'start':
        // Validate request data
        const validatedData = validateStartRequest(data);
        if (!validatedData) {
          return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
        }
        
        // Check session limits
        const userSessionCount = getUserSessionCount(user.id);
        if (userSessionCount >= MAX_SESSIONS_PER_USER) {
          return NextResponse.json({ 
            error: `Maximum ${MAX_SESSIONS_PER_USER} active sessions allowed. Please complete existing tests first.` 
          }, { status: 429 });
        }
        
        // Start a new diagnostic session
        const newSessionId = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + SESSION_TIMEOUT_MINUTES * 60 * 1000);
        const newSession = {
          id: newSessionId,
          userId: user.id,
          examType: validatedData.examType,
          questions: SAMPLE_QUESTIONS.slice(0, validatedData.numQuestions),
          answers: {},
          startedAt: new Date().toISOString(),
          currentQuestion: 0,
          expiresAt: expiresAt.toISOString()
        };
        
        diagnosticSessions.set(newSessionId, newSession);
        console.log(`Session ${newSessionId} created and stored. Total sessions: ${diagnosticSessions.size}`);
        
        // Return questions without correct answers
        const questionsForClient = newSession.questions.map(q => ({
          id: q.id,
          stem: q.stem,
          options: q.options
        }));
        
        return NextResponse.json({
          sessionId: newSessionId,
          questions: questionsForClient,
          totalQuestions: questionsForClient.length,
          expiresAt: expiresAt.toISOString()
        });
        
      case 'answer':
        // Validate sessionId
        if (typeof sessionId !== 'string' || !sessionId) {
          return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
        }
        
        // Validate answer data
        const validatedAnswer = validateAnswerRequest(data);
        if (!validatedAnswer) {
          return NextResponse.json({ error: 'Invalid answer data' }, { status: 400 });
        }
        
        const answerSession = diagnosticSessions.get(sessionId);
        if (!answerSession) {
          return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 });
        }
        
        // Check session expiration
        if (new Date(answerSession.expiresAt) < new Date()) {
          diagnosticSessions.delete(sessionId);
          return NextResponse.json({ error: 'Session expired' }, { status: 410 });
        }
        
        if (answerSession.userId !== user.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }
        
        const { questionId, selectedLabel } = validatedAnswer;
        
        // Verify question exists and hasn't been answered
        const question = answerSession.questions.find(q => q.id === questionId);
        if (!question) {
          return NextResponse.json({ error: 'Question not found' }, { status: 404 });
        }
        
        if (answerSession.answers[questionId]) {
          return NextResponse.json({ error: 'Question already answered' }, { status: 409 });
        }
        
        answerSession.answers[questionId] = selectedLabel;
        answerSession.currentQuestion = Object.keys(answerSession.answers).length;
        
        const isCorrect = question.correct === selectedLabel;
        
        return NextResponse.json({
          isCorrect,
          correctAnswer: question.correct,
          explanation: question.explanation
        });
        
      case 'complete':
        // Validate sessionId
        if (typeof sessionId !== 'string' || !sessionId) {
          return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
        }
        
        const completeSession = diagnosticSessions.get(sessionId);
        if (!completeSession) {
          return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 });
        }
        
        if (completeSession.userId !== user.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }
        
        // Calculate score
        let correct = 0;
        completeSession.questions.forEach(q => {
          if (completeSession.answers[q.id] === q.correct) {
            correct++;
          }
        });
        
        const score = completeSession.questions.length > 0 ? 
          (correct / completeSession.questions.length) * 100 : 0;
        
        // Simple topic recommendations based on score
        let recommendations = [];
        if (score < 50) {
          recommendations = [
            'Review Google Cloud fundamentals',
            'Study core services like Compute Engine and Cloud Storage',
            'Practice with hands-on labs'
          ];
        } else if (score < 80) {
          recommendations = [
            'Deep dive into advanced topics',
            'Focus on best practices and optimization',
            'Explore specialized services'
          ];
        } else {
          recommendations = [
            'You have a strong foundation!',
            'Consider pursuing professional certification',
            'Explore advanced architectural patterns'
          ];
        }
        
        // Clean up session after completion
        diagnosticSessions.delete(sessionId);
        
        return NextResponse.json({
          totalQuestions: completeSession.questions.length,
          correctAnswers: correct,
          score: Math.round(score),
          recommendations,
          examType: completeSession.examType
        });
        
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('POST diagnostic error:', error);
    // Don't leak internal error details
    return NextResponse.json({ 
      error: 'Internal server error'
    }, { status: 500 });
  }
}
