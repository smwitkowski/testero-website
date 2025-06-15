140 failed
    [chromium] › e2e/diagnostic-complete-flow.spec.ts:29:7 › Diagnostic Complete Flow › should complete full diagnostic flow from start to summary 
    [chromium] › e2e/diagnostic-complete-flow.spec.ts:102:7 › Diagnostic Complete Flow › should handle answer selection and submission correctly 
    [chromium] › e2e/diagnostic-complete-flow.spec.ts:131:7 › Diagnostic Complete Flow › should display correct visual feedback for answers 
    [chromium] › e2e/diagnostic-complete-flow.spec.ts:147:7 › Diagnostic Complete Flow › should navigate back to start page from summary 
    [chromium] › e2e/diagnostic-session-expiration.spec.ts:80:7 › Diagnostic Session Expiration › should handle multiple expired sessions in localStorage 
    [chromium] › e2e/diagnostic-session-expiration.spec.ts:102:7 › Diagnostic Session Expiration › should handle session expiration during diagnostic flow 
    [chromium] › e2e/diagnostic-session-expiration.spec.ts:142:7 › Diagnostic Session Expiration › should handle network errors when checking session status 
    [chromium] › e2e/diagnostic-session-expiration.spec.ts:239:7 › Diagnostic Session Expiration › should handle edge case of malformed session data in localStorage 
    [chromium] › e2e/diagnostic-session-resume.spec.ts:42:7 › Diagnostic Session Resume › should resume diagnostic session when clicking resume button 
    [chromium] › e2e/diagnostic-session-resume.spec.ts:142:7 › Diagnostic Session Resume › should handle page refresh during diagnostic session 
    [chromium] › e2e/diagnostic-start-over.spec.ts:43:7 › Diagnostic Start Over Functionality › should be able to start new diagnostic after starting over 
    [chromium] › e2e/diagnostic-start-over.spec.ts:86:7 › Diagnostic Start Over Functionality › should handle multiple start over actions 
    [chromium] › e2e/diagnostic-start-over.spec.ts:166:7 › Diagnostic Start Over Functionality › should track analytics events for start over action 
    [chromium] › e2e/diagnostic-url-access.spec.ts:20:7 › Diagnostic URL Access Scenarios › should show error page for invalid session ID 
    [chromium] › e2e/diagnostic-url-access.spec.ts:50:7 › Diagnostic URL Access Scenarios › should show error when accessing summary for incomplete session 
    [chromium] › e2e/diagnostic-url-access.spec.ts:76:7 › Diagnostic URL Access Scenarios › should show access denied for unauthorized session access 
    [chromium] › e2e/diagnostic-url-access.spec.ts:137:7 › Diagnostic URL Access Scenarios › should redirect from session page to summary when session is completed 
    [chromium] › e2e/diagnostic-url-access.spec.ts:182:7 › Diagnostic URL Access Scenarios › should handle malformed session IDs 
    [chromium] › e2e/diagnostic-user-types.spec.ts:23:7 › Diagnostic User Types › should handle anonymous user diagnostic flow 
    [chromium] › e2e/diagnostic-user-types.spec.ts:67:7 › Diagnostic User Types › should maintain anonymous session across page refreshes 
    [chromium] › e2e/diagnostic-user-types.spec.ts:93:7 › Diagnostic User Types › should handle anonymous user resume flow 
    [chromium] › e2e/diagnostic-user-types.spec.ts:116:7 › Diagnostic User Types › should track PostHog events for anonymous users 
    [chromium] › e2e/diagnostic-user-types.spec.ts:149:7 › Diagnostic User Types › should generate new anonymous ID for each browser session 
    [chromium] › e2e/diagnostic-user-types.spec.ts:185:7 › Diagnostic User Types › should handle session ownership for anonymous users 
    [chromium] › e2e/diagnostic-user-types.spec.ts:215:7 › Diagnostic User Types › should handle anonymous session timeout 
    [chromium] › e2e/diagnostic-user-types.spec.ts:249:7 › Diagnostic User Types › should maintain anonymous state throughout diagnostic completion 
    [firefox] › e2e/diagnostic-complete-flow.spec.ts:29:7 › Diagnostic Complete Flow › should complete full diagnostic flow from start to summary 
    [firefox] › e2e/diagnostic-complete-flow.spec.ts:102:7 › Diagnostic Complete Flow › should handle answer selection and submission correctly 
    [firefox] › e2e/diagnostic-complete-flow.spec.ts:131:7 › Diagnostic Complete Flow › should display correct visual feedback for answers 
    [firefox] › e2e/diagnostic-complete-flow.spec.ts:147:7 › Diagnostic Complete Flow › should navigate back to start page from summary 
    [firefox] › e2e/diagnostic-session-expiration.spec.ts:17:7 › Diagnostic Session Expiration › should clean up expired sessions from localStorage 
    [firefox] › e2e/diagnostic-session-expiration.spec.ts:59:7 › Diagnostic Session Expiration › should clean up completed sessions from localStorage 
    [firefox] › e2e/diagnostic-session-expiration.spec.ts:80:7 › Diagnostic Session Expiration › should handle multiple expired sessions in localStorage 
    [firefox] › e2e/diagnostic-session-expiration.spec.ts:102:7 › Diagnostic Session Expiration › should handle session expiration during diagnostic flow 
    [firefox] › e2e/diagnostic-session-expiration.spec.ts:142:7 › Diagnostic Session Expiration › should handle network errors when checking session status 
    [firefox] › e2e/diagnostic-session-expiration.spec.ts:163:7 › Diagnostic Session Expiration › should handle race conditions with session expiration 
    [firefox] › e2e/diagnostic-session-expiration.spec.ts:195:7 › Diagnostic Session Expiration › should handle session expiration with anonymous session ID cleanup 
    [firefox] › e2e/diagnostic-session-expiration.spec.ts:213:7 › Diagnostic Session Expiration › should allow starting new diagnostic after session expiration cleanup 
    [firefox] › e2e/diagnostic-session-expiration.spec.ts:239:7 › Diagnostic Session Expiration › should handle edge case of malformed session data in localStorage 
    [firefox] › e2e/diagnostic-session-resume.spec.ts:26:7 › Diagnostic Session Resume › should show resume prompt when returning to diagnostic page with active session 
    [firefox] › e2e/diagnostic-session-resume.spec.ts:42:7 › Diagnostic Session Resume › should resume diagnostic session when clicking resume button 
    [firefox] › e2e/diagnostic-session-resume.spec.ts:58:7 › Diagnostic Session Resume › should clear session and allow new diagnostic when clicking start over 
    [firefox] › e2e/diagnostic-session-resume.spec.ts:142:7 › Diagnostic Session Resume › should handle page refresh during diagnostic session 
    [firefox] › e2e/diagnostic-session-resume.spec.ts:173:7 › Diagnostic Session Resume › should maintain anonymous session ID across browser sessions 
    [firefox] › e2e/diagnostic-start-over.spec.ts:43:7 › Diagnostic Start Over Functionality › should be able to start new diagnostic after starting over 
    [firefox] › e2e/diagnostic-start-over.spec.ts:67:7 › Diagnostic Start Over Functionality › should clear both session ID and anonymous ID when starting over 
    [firefox] › e2e/diagnostic-start-over.spec.ts:86:7 › Diagnostic Start Over Functionality › should handle multiple start over actions 
    [firefox] › e2e/diagnostic-start-over.spec.ts:111:7 › Diagnostic Start Over Functionality › should not show resume prompt after starting over and refreshing 
    [firefox] › e2e/diagnostic-start-over.spec.ts:125:7 › Diagnostic Start Over Functionality › should preserve form state when starting over 
    [firefox] › e2e/diagnostic-start-over.spec.ts:145:7 › Diagnostic Start Over Functionality › should handle start over with network errors gracefully 
    [firefox] › e2e/diagnostic-start-over.spec.ts:166:7 › Diagnostic Start Over Functionality › should track analytics events for start over action 
    [firefox] › e2e/diagnostic-url-access.spec.ts:20:7 › Diagnostic URL Access Scenarios › should show error page for invalid session ID 
    [firefox] › e2e/diagnostic-url-access.spec.ts:50:7 › Diagnostic URL Access Scenarios › should show error when accessing summary for incomplete session 
    [firefox] › e2e/diagnostic-url-access.spec.ts:76:7 › Diagnostic URL Access Scenarios › should show access denied for unauthorized session access 
    [firefox] › e2e/diagnostic-url-access.spec.ts:101:7 › Diagnostic URL Access Scenarios › should successfully access valid completed session summary 
    [firefox] › e2e/diagnostic-url-access.spec.ts:137:7 › Diagnostic URL Access Scenarios › should redirect from session page to summary when session is completed 
    [firefox] › e2e/diagnostic-url-access.spec.ts:182:7 › Diagnostic URL Access Scenarios › should handle malformed session IDs 
    [firefox] › e2e/diagnostic-user-types.spec.ts:23:7 › Diagnostic User Types › should handle anonymous user diagnostic flow 
    [firefox] › e2e/diagnostic-user-types.spec.ts:67:7 › Diagnostic User Types › should maintain anonymous session across page refreshes 
    [firefox] › e2e/diagnostic-user-types.spec.ts:93:7 › Diagnostic User Types › should handle anonymous user resume flow 
    [firefox] › e2e/diagnostic-user-types.spec.ts:116:7 › Diagnostic User Types › should track PostHog events for anonymous users 
    [firefox] › e2e/diagnostic-user-types.spec.ts:149:7 › Diagnostic User Types › should generate new anonymous ID for each browser session 
    [firefox] › e2e/diagnostic-user-types.spec.ts:185:7 › Diagnostic User Types › should handle session ownership for anonymous users 
    [webkit] › e2e/diagnostic-complete-flow.spec.ts:29:7 › Diagnostic Complete Flow › should complete full diagnostic flow from start to summary 
    [webkit] › e2e/diagnostic-complete-flow.spec.ts:102:7 › Diagnostic Complete Flow › should handle answer selection and submission correctly 
    [webkit] › e2e/diagnostic-complete-flow.spec.ts:131:7 › Diagnostic Complete Flow › should display correct visual feedback for answers 
    [webkit] › e2e/diagnostic-complete-flow.spec.ts:147:7 › Diagnostic Complete Flow › should navigate back to start page from summary 
    [webkit] › e2e/diagnostic-session-expiration.spec.ts:80:7 › Diagnostic Session Expiration › should handle multiple expired sessions in localStorage 
    [webkit] › e2e/diagnostic-session-expiration.spec.ts:102:7 › Diagnostic Session Expiration › should handle session expiration during diagnostic flow 
    [webkit] › e2e/diagnostic-session-expiration.spec.ts:142:7 › Diagnostic Session Expiration › should handle network errors when checking session status 
    [webkit] › e2e/diagnostic-session-expiration.spec.ts:213:7 › Diagnostic Session Expiration › should allow starting new diagnostic after session expiration cleanup 
    [webkit] › e2e/diagnostic-session-expiration.spec.ts:239:7 › Diagnostic Session Expiration › should handle edge case of malformed session data in localStorage 
    [webkit] › e2e/diagnostic-session-resume.spec.ts:42:7 › Diagnostic Session Resume › should resume diagnostic session when clicking resume button 
    [webkit] › e2e/diagnostic-session-resume.spec.ts:142:7 › Diagnostic Session Resume › should handle page refresh during diagnostic session 
    [webkit] › e2e/diagnostic-start-over.spec.ts:43:7 › Diagnostic Start Over Functionality › should be able to start new diagnostic after starting over 
    [webkit] › e2e/diagnostic-start-over.spec.ts:86:7 › Diagnostic Start Over Functionality › should handle multiple start over actions 
    [webkit] › e2e/diagnostic-start-over.spec.ts:166:7 › Diagnostic Start Over Functionality › should track analytics events for start over action 
    [webkit] › e2e/diagnostic-url-access.spec.ts:50:7 › Diagnostic URL Access Scenarios › should show error when accessing summary for incomplete session 
    [webkit] › e2e/diagnostic-url-access.spec.ts:76:7 › Diagnostic URL Access Scenarios › should show access denied for unauthorized session access 
    [webkit] › e2e/diagnostic-url-access.spec.ts:112:7 › Diagnostic URL Access Scenarios › should handle expired session gracefully 
    [webkit] › e2e/diagnostic-url-access.spec.ts:137:7 › Diagnostic URL Access Scenarios › should redirect from session page to summary when session is completed 
    [webkit] › e2e/diagnostic-url-access.spec.ts:182:7 › Diagnostic URL Access Scenarios › should handle malformed session IDs 
    [webkit] › e2e/diagnostic-url-access.spec.ts:236:7 › Diagnostic URL Access Scenarios › should handle deep linking to specific question numbers 
    [webkit] › e2e/diagnostic-user-types.spec.ts:23:7 › Diagnostic User Types › should handle anonymous user diagnostic flow 
    [webkit] › e2e/diagnostic-user-types.spec.ts:67:7 › Diagnostic User Types › should maintain anonymous session across page refreshes 
    [webkit] › e2e/diagnostic-user-types.spec.ts:93:7 › Diagnostic User Types › should handle anonymous user resume flow 
    [webkit] › e2e/diagnostic-user-types.spec.ts:116:7 › Diagnostic User Types › should track PostHog events for anonymous users 
    [webkit] › e2e/diagnostic-user-types.spec.ts:149:7 › Diagnostic User Types › should generate new anonymous ID for each browser session 
    [webkit] › e2e/diagnostic-user-types.spec.ts:185:7 › Diagnostic User Types › should handle session ownership for anonymous users 
    [webkit] › e2e/diagnostic-user-types.spec.ts:215:7 › Diagnostic User Types › should handle anonymous session timeout 
    [webkit] › e2e/diagnostic-user-types.spec.ts:249:7 › Diagnostic User Types › should maintain anonymous state throughout diagnostic completion 
    [Mobile Chrome] › e2e/diagnostic-complete-flow.spec.ts:29:7 › Diagnostic Complete Flow › should complete full diagnostic flow from start to summary 
    [Mobile Chrome] › e2e/diagnostic-complete-flow.spec.ts:102:7 › Diagnostic Complete Flow › should handle answer selection and submission correctly 
    [Mobile Chrome] › e2e/diagnostic-complete-flow.spec.ts:131:7 › Diagnostic Complete Flow › should display correct visual feedback for answers 
    [Mobile Chrome] › e2e/diagnostic-complete-flow.spec.ts:147:7 › Diagnostic Complete Flow › should navigate back to start page from summary 
    [Mobile Chrome] › e2e/diagnostic-session-expiration.spec.ts:80:7 › Diagnostic Session Expiration › should handle multiple expired sessions in localStorage 
    [Mobile Chrome] › e2e/diagnostic-session-expiration.spec.ts:102:7 › Diagnostic Session Expiration › should handle session expiration during diagnostic flow 
    [Mobile Chrome] › e2e/diagnostic-session-expiration.spec.ts:163:7 › Diagnostic Session Expiration › should handle race conditions with session expiration 
    [Mobile Chrome] › e2e/diagnostic-session-expiration.spec.ts:239:7 › Diagnostic Session Expiration › should handle edge case of malformed session data in localStorage 
    [Mobile Chrome] › e2e/diagnostic-session-resume.spec.ts:42:7 › Diagnostic Session Resume › should resume diagnostic session when clicking resume button 
    [Mobile Chrome] › e2e/diagnostic-session-resume.spec.ts:142:7 › Diagnostic Session Resume › should handle page refresh during diagnostic session 
    [Mobile Chrome] › e2e/diagnostic-start-over.spec.ts:43:7 › Diagnostic Start Over Functionality › should be able to start new diagnostic after starting over 
    [Mobile Chrome] › e2e/diagnostic-start-over.spec.ts:86:7 › Diagnostic Start Over Functionality › should handle multiple start over actions 
    [Mobile Chrome] › e2e/diagnostic-start-over.spec.ts:166:7 › Diagnostic Start Over Functionality › should track analytics events for start over action 
    [Mobile Chrome] › e2e/diagnostic-url-access.spec.ts:76:7 › Diagnostic URL Access Scenarios › should show access denied for unauthorized session access 
    [Mobile Chrome] › e2e/diagnostic-url-access.spec.ts:137:7 › Diagnostic URL Access Scenarios › should redirect from session page to summary when session is completed 
    [Mobile Chrome] › e2e/diagnostic-url-access.spec.ts:182:7 › Diagnostic URL Access Scenarios › should handle malformed session IDs 
    [Mobile Chrome] › e2e/diagnostic-user-types.spec.ts:23:7 › Diagnostic User Types › should handle anonymous user diagnostic flow 
    [Mobile Chrome] › e2e/diagnostic-user-types.spec.ts:93:7 › Diagnostic User Types › should handle anonymous user resume flow 
    [Mobile Chrome] › e2e/diagnostic-user-types.spec.ts:116:7 › Diagnostic User Types › should track PostHog events for anonymous users 
    [Mobile Chrome] › e2e/diagnostic-user-types.spec.ts:149:7 › Diagnostic User Types › should generate new anonymous ID for each browser session 
    [Mobile Chrome] › e2e/diagnostic-user-types.spec.ts:185:7 › Diagnostic User Types › should handle session ownership for anonymous users 
    [Mobile Chrome] › e2e/diagnostic-user-types.spec.ts:215:7 › Diagnostic User Types › should handle anonymous session timeout 
    [Mobile Safari] › e2e/diagnostic-complete-flow.spec.ts:29:7 › Diagnostic Complete Flow › should complete full diagnostic flow from start to summary 
    [Mobile Safari] › e2e/diagnostic-complete-flow.spec.ts:102:7 › Diagnostic Complete Flow › should handle answer selection and submission correctly 
    [Mobile Safari] › e2e/diagnostic-complete-flow.spec.ts:131:7 › Diagnostic Complete Flow › should display correct visual feedback for answers 
    [Mobile Safari] › e2e/diagnostic-complete-flow.spec.ts:147:7 › Diagnostic Complete Flow › should navigate back to start page from summary 
    [Mobile Safari] › e2e/diagnostic-session-expiration.spec.ts:17:7 › Diagnostic Session Expiration › should clean up expired sessions from localStorage 
    [Mobile Safari] › e2e/diagnostic-session-expiration.spec.ts:80:7 › Diagnostic Session Expiration › should handle multiple expired sessions in localStorage 
    [Mobile Safari] › e2e/diagnostic-session-expiration.spec.ts:102:7 › Diagnostic Session Expiration › should handle session expiration during diagnostic flow 
    [Mobile Safari] › e2e/diagnostic-session-expiration.spec.ts:239:7 › Diagnostic Session Expiration › should handle edge case of malformed session data in localStorage 
    [Mobile Safari] › e2e/diagnostic-session-resume.spec.ts:26:7 › Diagnostic Session Resume › should show resume prompt when returning to diagnostic page with active session 
    [Mobile Safari] › e2e/diagnostic-session-resume.spec.ts:42:7 › Diagnostic Session Resume › should resume diagnostic session when clicking resume button 
    [Mobile Safari] › e2e/diagnostic-session-resume.spec.ts:58:7 › Diagnostic Session Resume › should clear session and allow new diagnostic when clicking start over 
    [Mobile Safari] › e2e/diagnostic-session-resume.spec.ts:142:7 › Diagnostic Session Resume › should handle page refresh during diagnostic session 
    [Mobile Safari] › e2e/diagnostic-start-over.spec.ts:43:7 › Diagnostic Start Over Functionality › should be able to start new diagnostic after starting over 
    [Mobile Safari] › e2e/diagnostic-start-over.spec.ts:86:7 › Diagnostic Start Over Functionality › should handle multiple start over actions 
    [Mobile Safari] › e2e/diagnostic-start-over.spec.ts:111:7 › Diagnostic Start Over Functionality › should not show resume prompt after starting over and refreshing 
    [Mobile Safari] › e2e/diagnostic-start-over.spec.ts:125:7 › Diagnostic Start Over Functionality › should preserve form state when starting over 
    [Mobile Safari] › e2e/diagnostic-start-over.spec.ts:145:7 › Diagnostic Start Over Functionality › should handle start over with network errors gracefully 
    [Mobile Safari] › e2e/diagnostic-start-over.spec.ts:166:7 › Diagnostic Start Over Functionality › should track analytics events for start over action 
    [Mobile Safari] › e2e/diagnostic-url-access.spec.ts:76:7 › Diagnostic URL Access Scenarios › should show access denied for unauthorized session access 
    [Mobile Safari] › e2e/diagnostic-url-access.spec.ts:101:7 › Diagnostic URL Access Scenarios › should successfully access valid completed session summary 
    [Mobile Safari] › e2e/diagnostic-url-access.spec.ts:112:7 › Diagnostic URL Access Scenarios › should handle expired session gracefully 
    [Mobile Safari] › e2e/diagnostic-url-access.spec.ts:137:7 › Diagnostic URL Access Scenarios › should redirect from session page to summary when session is completed 
    [Mobile Safari] › e2e/diagnostic-url-access.spec.ts:182:7 › Diagnostic URL Access Scenarios › should handle malformed session IDs 
    [Mobile Safari] › e2e/diagnostic-user-types.spec.ts:93:7 › Diagnostic User Types › should handle anonymous user resume flow 
    [Mobile Safari] › e2e/diagnostic-user-types.spec.ts:116:7 › Diagnostic User Types › should track PostHog events for anonymous users 
    [Mobile Safari] › e2e/diagnostic-user-types.spec.ts:149:7 › Diagnostic User Types › should generate new anonymous ID for each browser session 
    [Mobile Safari] › e2e/diagnostic-user-types.spec.ts:185:7 › Diagnostic User Types › should handle session ownership for anonymous users 
  12 flaky
    [firefox] › e2e/diagnostic-session-expiration.spec.ts:38:7 › Diagnostic Session Expiration › should clean up non-existent sessions from localStorage 
    [firefox] › e2e/diagnostic-url-access.spec.ts:112:7 › Diagnostic URL Access Scenarios › should handle expired session gracefully 
    [firefox] › e2e/diagnostic-url-access.spec.ts:236:7 › Diagnostic URL Access Scenarios › should handle deep linking to specific question numbers 
    [webkit] › e2e/diagnostic-session-resume.spec.ts:26:7 › Diagnostic Session Resume › should show resume prompt when returning to diagnostic page with active session 
    [webkit] › e2e/diagnostic-session-resume.spec.ts:82:7 › Diagnostic Session Resume › should not show resume prompt when no session exists 
    [Mobile Chrome] › e2e/diagnostic-session-expiration.spec.ts:213:7 › Diagnostic Session Expiration › should allow starting new diagnostic after session expiration cleanup 
    [Mobile Chrome] › e2e/diagnostic-session-resume.spec.ts:26:7 › Diagnostic Session Resume › should show resume prompt when returning to diagnostic page with active session 
    [Mobile Safari] › e2e/diagnostic-session-expiration.spec.ts:59:7 › Diagnostic Session Expiration › should clean up completed sessions from localStorage 
    [Mobile Safari] › e2e/diagnostic-session-expiration.spec.ts:142:7 › Diagnostic Session Expiration › should handle network errors when checking session status 
    [Mobile Safari] › e2e/diagnostic-session-expiration.spec.ts:195:7 › Diagnostic Session Expiration › should handle session expiration with anonymous session ID cleanup 
    [Mobile Safari] › e2e/diagnostic-session-resume.spec.ts:82:7 › Diagnostic Session Resume › should not show resume prompt when no session exists 
    [Mobile Safari] › e2e/diagnostic-session-resume.spec.ts:91:7 › Diagnostic Session Resume › should not show resume prompt for expired session 
  93 passed (13.4m)

  Serving HTML report at http://localhost:9323. Press Ctrl+C to quit.
