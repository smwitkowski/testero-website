import { Page, expect } from '@playwright/test';
import { MOCK_SESSION_RESPONSES, MOCK_SUMMARY_RESPONSE, MOCK_EXAM_TYPES } from './mock-data';

export class DiagnosticHelpers {
  constructor(private page: Page) {}

  /**
   * Set up API mocking for diagnostic endpoints
   */
  async setupApiMocks() {
    // Mock the diagnostic endpoint for both POST and GET
    await this.page.route('**/api/diagnostic*', async route => {
      const request = route.request();
      const method = request.method();
      const url = new URL(request.url());
      
      console.log(`[HELPERS] ${method} request to: ${url.pathname}${url.search}`);
      
      if (method === 'POST') {
        const postData = request.postDataJSON();
        
        if (postData.action === 'start') {
          console.log(`[HELPERS] Starting new session`);
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(MOCK_SESSION_RESPONSES.start)
          });
        } else if (postData.action === 'answer') {
          console.log(`[HELPERS] Submitting answer for:`, postData);
          
          // Get answer and question data to provide realistic feedback
          const selectedAnswer = postData.data?.selectedLabel || 'A';
          const questionId = postData.data?.questionId || 'test-q1';
          
          // Map question ID to index
          const questionIds = ['test-q1', 'test-q2', 'test-q3'];
          const questionIndex = questionIds.indexOf(questionId);
          
          // Define correct answers for our mock questions
          const correctAnswers = ['B', 'C', 'B']; // First question: B, Second: C, Third: B
          const isCorrect = selectedAnswer === correctAnswers[questionIndex];
          
          console.log(`[HELPERS] Question ${questionIndex}: Selected ${selectedAnswer}, Correct: ${correctAnswers[questionIndex]}, IsCorrect: ${isCorrect}`);
          
          const response = {
            isCorrect: isCorrect,
            correctAnswer: correctAnswers[questionIndex],
            explanation: isCorrect ? 
              'Great! You selected the correct answer.' : 
              `The correct answer is ${correctAnswers[questionIndex]}. This question tests your understanding of the key concepts.`
          };
          
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(response)
          });
        } else if (postData.action === 'complete') {
          console.log(`[HELPERS] Completing session`);
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(MOCK_SESSION_RESPONSES.complete)
          });
        }
      } else if (method === 'GET') {
        // Mock session fetch for active session
        const sessionId = url.searchParams.get('sessionId');
        
        console.log(`[HELPERS] GET request for sessionId: ${sessionId}`);
        
        if (sessionId === 'completed-session-123') {
          // Handle completed session - should show completed state
          const completedSessionData = {
            session: {
              id: sessionId,
              userId: null,
              examType: 'Google Professional ML Engineer',
              questions: MOCK_SESSION_RESPONSES.start.questions,
              startedAt: '2023-01-01T00:00:00.000Z',
              currentQuestion: 3, // All questions completed
              completed_at: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              anonymousSessionId: 'test-anon-456'
            }
          };
          
          console.log(`[HELPERS] Returning completed session data for ${sessionId}:`, completedSessionData);
          
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(completedSessionData)
          });
        } else if (sessionId === MOCK_SESSION_RESPONSES.start.sessionId || sessionId === 'test-session-123') {
          const sessionData = {
            session: {
              id: sessionId,
              userId: null,
              examType: 'Google Professional ML Engineer',
              questions: MOCK_SESSION_RESPONSES.start.questions,
              startedAt: '2023-01-01T00:00:00.000Z',
              currentQuestion: 0,
              expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              anonymousSessionId: 'test-anon-456'
            }
          };
          
          console.log(`[HELPERS] Returning session data for ${sessionId}:`, sessionData);
          
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(sessionData)
          });
        } else {
          console.log(`[HELPERS] Session ${sessionId} not found for GET`);
          
          // Check for malformed session IDs
          if (!sessionId || sessionId.includes('<') || sessionId.includes('script') || sessionId.includes('/') || sessionId.includes('@')) {
            await route.fulfill({
              status: 400,
              contentType: 'application/json',
              body: JSON.stringify({ error: 'Invalid session ID provided' })
            });
          } else {
            await route.fulfill({
              status: 404,
              contentType: 'application/json',
              body: JSON.stringify({ error: 'Session not found or expired.' })
            });
          }
        }
      }
    });

    // Mock session status endpoint - return appropriate status based on sessionId
    await this.page.route('**/api/diagnostic/session/*/status*', async route => {
      const url = new URL(route.request().url());
      const pathParts = url.pathname.split('/');
      const sessionId = pathParts[pathParts.length - 2];
      
      console.log(`[HELPERS] Mocking session status for ID: ${sessionId}`);
      
      // Accept both the default mock session ID and the test session ID
      if (sessionId === MOCK_SESSION_RESPONSES.start.sessionId || sessionId === 'test-session-123') {
        const mockResponse = {
          exists: true,
          status: 'active',
          examType: 'Google Professional ML Engineer',
          startedAt: '2023-01-01T00:00:00.000Z',
          expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
        };
        
        console.log(`[HELPERS] Returning active session:`, mockResponse);
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockResponse)
        });
      } else {
        console.log(`[HELPERS] Session ${sessionId} not found`);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            exists: false,
            status: 'not_found'
          })
        });
      }
    });

    // Mock summary endpoint
    await this.page.route('**/api/diagnostic/summary/*', async route => {
      const url = new URL(route.request().url());
      const pathParts = url.pathname.split('/');
      const sessionId = pathParts[pathParts.length - 1];
      
      console.log(`[HELPERS] Summary request for session: ${sessionId}`);
      
      // Handle different session scenarios
      if (sessionId === 'unauthorized-session') {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Unauthorized to access this session.' })
        });
      } else if (sessionId === 'incomplete-session-123') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Session not completed yet' })
        });
      } else if (sessionId === 'test-session-123' || sessionId === MOCK_SESSION_RESPONSES.start.sessionId) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_SUMMARY_RESPONSE)
        });
      } else {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Session not found.' })
        });
      }
    });

    // Mock exam types endpoint (even though currently hardcoded, for future compatibility)
    await this.page.route('**/api/exams*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_EXAM_TYPES)
      });
    });

    // Mock PostHog (optional - to prevent real analytics)
    await this.page.route('**/decide/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({})
      });
    });

    await this.page.route('**/capture/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 1 })
      });
    });

    // Wait a moment to ensure all mocks are properly established
    await this.page.waitForTimeout(100);
  }

  /**
   * Set up localStorage with a mock session for testing resume functionality
   */
  async setupMockSession() {
    await this.page.evaluate((sessionData) => {
      localStorage.setItem('testero_diagnostic_session_id', sessionData.sessionId);
      localStorage.setItem('anonymousSessionId', sessionData.anonymousSessionId);
    }, MOCK_SESSION_RESPONSES.start);
  }

  /**
   * Set specific session ID and anonymous ID in localStorage
   */
  async setSessionInLocalStorage(sessionId: string, anonymousSessionId?: string) {
    try {
      await this.page.evaluate(({ sessionId, anonymousSessionId }) => {
        localStorage.setItem('testero_diagnostic_session_id', sessionId);
        if (anonymousSessionId) {
          localStorage.setItem('anonymousSessionId', anonymousSessionId);
        }
      }, { sessionId, anonymousSessionId });
    } catch (error) {
      // If localStorage is not accessible, navigate to a page first
      await this.page.goto('/');
      await this.page.evaluate(({ sessionId, anonymousSessionId }) => {
        localStorage.setItem('testero_diagnostic_session_id', sessionId);
        if (anonymousSessionId) {
          localStorage.setItem('anonymousSessionId', anonymousSessionId);
        }
      }, { sessionId, anonymousSessionId });
    }
  }

  /**
   * Clear localStorage to ensure clean test state
   */
  async clearLocalStorage() {
    try {
      await this.page.evaluate(() => {
        localStorage.clear();
      });
    } catch (error) {
      // If localStorage is not accessible (e.g., not on a page yet), ignore the error
      // This will be cleared when we navigate to a page
    }
  }


  /**
   * Get localStorage values for verification
   */
  async getLocalStorageValues() {
    try {
      return await this.page.evaluate(() => ({
        sessionId: localStorage.getItem('testero_diagnostic_session_id'),
        anonymousSessionId: localStorage.getItem('anonymousSessionId')
      }));
    } catch (error) {
      // If localStorage is not accessible, return null values
      return {
        sessionId: null,
        anonymousSessionId: null
      };
    }
  }

  /**
   * Wait for navigation and ensure page is loaded
   */
  async waitForPageLoad(url?: string) {
    if (url) {
      await this.page.waitForURL(url);
    }
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Mock active session (for resume functionality tests)
   */
  async mockActiveSession() {
    await this.page.route('**/api/diagnostic/session/*/status', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          exists: true,
          status: 'active',
          examType: 'Google Professional ML Engineer',
          startedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
        })
      });
    });
  }

  /**
   * Mock expired session in localStorage
   */
  async mockExpiredSession() {
    await this.page.route('**/api/diagnostic/session/*/status', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          exists: true,
          status: 'expired'
        })
      });
    });
  }

  /**
   * Mock session not found
   */
  async mockSessionNotFound() {
    await this.page.route('**/api/diagnostic/session/*/status', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          exists: false,
          status: 'not_found'
        })
      });
    });
  }

  /**
   * Mock completed session
   */
  async mockCompletedSession() {
    await this.page.route('**/api/diagnostic/session/*/status', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          exists: true,
          status: 'completed',
          completedAt: new Date().toISOString()
        })
      });
    });
  }

  /**
   * Verify PostHog event was called (check network requests)
   */
  async verifyPostHogEvent(eventName: string) {
    // This would check for actual network requests to PostHog
    // For now, we'll just verify the mock was called
    const requests = await this.page.evaluate(() => {
      return (window as any).__playwright_posthog_events || [];
    });
    
    expect(requests.some((req: any) => req.event === eventName)).toBeTruthy();
  }
}