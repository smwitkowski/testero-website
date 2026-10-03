# Question Product & UX Documentation

**Document Purpose:** This document details how questions are used and displayed to users from a product perspective. It covers user journeys, UI patterns, interaction flows, and the complete user experience across different question contexts.

**Last Updated:** October 2, 2026

**Related Documentation:** See `QUESTION_DATA_MODELS.md` for technical data structures.

---

## Table of Contents

1. [Product Overview](#product-overview)
2. [User Journeys with Questions](#user-journeys-with-questions)
3. [Diagnostic Test Experience](#diagnostic-test-experience)
4. [Practice Question Experience](#practice-question-experience)
5. [Dashboard & Progress Tracking](#dashboard--progress-tracking)
6. [Results & Review Experience](#results--review-experience)
7. [Question Display Patterns](#question-display-patterns)
8. [Feedback & Explanations](#feedback--explanations)
9. [Monetization & Conversion Points](#monetization--conversion-points)
10. [Accessibility & Usability](#accessibility--usability)

---

## Product Overview

### Core Value Proposition

Testero helps users pass certification exams (primarily Google Cloud PMLE) through:
1. **Diagnostic Assessment** - Identify knowledge gaps (10-20 minutes)
2. **Targeted Practice** - Study weak areas with explanations
3. **Progress Tracking** - Monitor readiness over time

### Question Types Supported

Currently: **Multiple Choice Only**
- 2-6 options (typically 4)
- Single correct answer
- Labels: A, B, C, D, E, F

**Future Consideration:** Multi-select, scenario-based, ordering questions (field exists in data model)

---

## User Journeys with Questions

### Journey 1: New User → Diagnostic → Results → Practice

```
Landing Page
    ↓
"Take Free Diagnostic" CTA
    ↓
/diagnostic (Start Page)
  • Select exam type (PMLE, Cloud Architect, etc.)
  • Choose length (10, 20, or 30 questions)
  • Anonymous users: Shown "No signup required" message
    ↓
/diagnostic/[sessionId] (Active Test)
  • Answer questions one by one
  • Skip or submit each question
  • Progress bar at top
  • Answers saved in background
    ↓
/diagnostic/[sessionId]/summary (Results Page)
  • Score & readiness gauge
  • Domain breakdown performance
  • Personalized study plan
  • Question-by-question review
  • CTAs: Practice weak areas, Retake diagnostic
    ↓
/practice/question (Practice Mode)
  • Random question with immediate feedback
  • Explanation shown after submission
  • "Next Question" button to continue
```

### Journey 2: Returning User → Dashboard → Practice

```
Login
    ↓
/dashboard
  • Readiness score (0-100)
  • Recent diagnostic sessions
  • Practice statistics
  • "Start Practice" CTA
    ↓
/practice/question
  • Continuous practice flow
  • Tracks answered questions
  • Updates dashboard statistics
```

### Journey 3: Anonymous User → Signup Conversion

```
Take Diagnostic (Anonymous)
    ↓
View Results
    ↓
Conversion Points:
  1. "Start Practice" (requires login)
  2. "Save Results" prompt
  3. PMLE Pass offer at paid explanation and practice boundaries
    ↓
Signup
    ↓
Account created with diagnostic history preserved
```

---

## Diagnostic Test Experience

### 1. Start Page (`/diagnostic`)

**Key Features:**
- Exam type dropdown (PMLE, Digital Leader, Cloud Architect)
- Question count selector: Pills for 10, 20, 30 questions
- "Updated Oct 2024" badge for PMLE
- Resume session detection (if incomplete session exists)

**UI Components:**
```tsx
<Card>
  <Badge>Updated Oct 2024 exam changes</Badge>
  <h1>PMLE Diagnostic</h1>
  <p>10-minute readiness check</p>
  
  {/* For anonymous users */}
  <InfoBanner>
    No signup required! Take the diagnostic anonymously
  </InfoBanner>
  
  {/* Resume banner if applicable */}
  <ResumeSessionBanner>
    <Button>Resume</Button>
    <Button variant="outline">Start Over</Button>
  </ResumeSessionBanner>
  
  <select id="examType">
    <option>PMLE - Professional ML Engineer (October 2024)</option>
  </select>
  
  <ButtonGroup>
    <Button pressed={count === 10}>10</Button>
    <Button pressed={count === 20}>20</Button>
    <Button pressed={count === 30}>30</Button>
  </ButtonGroup>
  
  <Button size="lg" fullWidth>Start free diagnostic →</Button>
</Card>
```

**Recommended Length:** 20 questions (10 minutes) for comprehensive assessment

### 2. Active Diagnostic Session (`/diagnostic/[sessionId]`)

**Layout:**
- **Sticky header** with progress indicator
- **Left rail** (desktop only) with session metadata
- **Main area** with question
- **Sticky footer** with actions

**Visual Hierarchy:**

```
┌─────────────────────────────────────────┐
│ Header: Progress (Question X of Y)     │
│ [Progress bar: ████████░░░░░░] 60%    │
└─────────────────────────────────────────┘
┌─────┬──────────────────────────────────┐
│ LEFT│ MAIN CONTENT                     │
│ RAIL│                                  │
│     │ Question Stem                    │
│Meta │                                  │
│Info │ ○ A. Option text here           │
│     │ ○ B. Option text here           │
│Flag │ ○ C. Option text here           │
│     │ ○ D. Option text here           │
└─────┴──────────────────────────────────┘
┌─────────────────────────────────────────┐
│ Footer: [Skip] [Submit answer ●]       │
└─────────────────────────────────────────┘
```

**Interaction Flow:**
1. User sees question stem
2. Clicks an option (radio button interaction)
3. Selected option highlights with indigo accent
4. Submit button becomes enabled
5. Click "Submit answer"
6. Answer saved in background (with retry logic)
7. Immediately advance to next question (no feedback shown)
8. Repeat until all questions answered
9. Final submit redirects to summary page

**Progressive Enhancement:**
- **Visual feedback:** Selected options have colored ring and background
- **Keyboard navigation:** Arrow keys, j/k, Enter to submit
- **Error handling:** Failed submissions retry automatically (3 attempts)
- **Submission status:** Warning shown if answers fail to save

**Left Rail Content:**
```tsx
<ProgressCard>
  Completed: 15 / 20
  [Progress bar]
</ProgressCard>

<ReviewCard>
  <Button>Flag for review</Button>
  <Text>Review all flagged questions before final submission</Text>
</ReviewCard>

{/* Only shown if submission errors */}
<SubmissionStatusCard>
  ⚠️ 2 answers failed to save
  Retrying 1 submission...
</SubmissionStatusCard>
```

**Error States:**
- Session not found → Redirect to start page
- Session expired (30 min timeout) → Clear error message
- Access denied → Ownership validation failed
- Authentication required → Must log in

### 3. Diagnostic Completion

**Auto-complete Trigger:**
- After last question submitted
- POST `/api/diagnostic` with `action: "complete"`
- Clears localStorage session ID
- Redirects to `/diagnostic/[sessionId]/summary`

---

## Practice Question Experience

### Two Practice Modes

#### Mode 1: Random Practice (`/practice/question`)
- Fetches questions via `/api/questions/current`
- Deterministic rotation (user ID + time-based)
- Only serves questions with explanations
- 404 error if no eligible questions

#### Mode 2: Specific Question (`/practice/question/[id]`)
- Direct question access by ID
- Useful for retrying specific questions
- "Try Again" button after feedback

### Practice UI Flow

**State 1: Initial Display**
```tsx
<main>
  <h1>Practice Question</h1>
  
  <QuestionDisplay
    question={question}
    selectedOptionKey={selected}
    feedback={null}
    onOptionSelect={setSelected}
  />
  
  <SubmitButton
    disabled={!selected}
    submitting={false}
  />
</main>
```

**State 2: After Submission**
```tsx
<main>
  <h1>Practice Question</h1>
  
  <QuestionDisplay
    question={question}
    selectedOptionKey={selected}
    feedback={feedback}        // Now populated
    onOptionSelect={DISABLED}  // No longer interactive
  />
  
  {/* Submit button hidden */}
  
  <QuestionFeedback
    feedback={{
      isCorrect: true/false,
      correctOptionKey: "B",
      explanationText: "..."
    }}
    onNextAction={fetchNewQuestion}
    nextActionLabel="Next Question"
  />
</main>
```

### Practice Features

**Feedback Display:**
- ✓ "Correct!" in green
- ✗ "Incorrect." in red
- Shows correct answer if wrong
- Detailed explanation always shown
- Visual highlighting of correct/incorrect options

**Persistence:**
- Answers saved to `practice_attempts` table
- Contributes to dashboard statistics
- Tracks: question_id, is_correct, answered_at
- Used for readiness score calculation (40% weight)

---

## Dashboard & Progress Tracking

### Dashboard Layout (`/dashboard`)

```
┌──────────────────────────────────────────┐
│ Dashboard Header                         │
│ "Track your progress and exam readiness"│
└──────────────────────────────────────────┘
┌───────────────────┬──────────────────────┐
│ READINESS METER   │ PRACTICE SUMMARY     │
│ [Gauge: 67%]      │ Questions: 45        │
│ Good              │ Accuracy: 82%        │
│                   │ Last: 2 days ago     │
│ [Start Practice]  │                      │
└───────────────────┴──────────────────────┘
┌──────────────────────────────────────────┐
│ DIAGNOSTIC SUMMARY                       │
│ Recent Sessions:                         │
│ • PMLE - 70% - 3 days ago               │
│ • PMLE - 65% - 1 week ago               │
└──────────────────────────────────────────┘
```

### Readiness Score Algorithm

**Calculation:**
- 60% weight: Latest diagnostic score
- 40% weight: Practice accuracy
- Range: 0-100
- Labels:
  - 85-100: "Excellent" (emerald)
  - 70-84: "Good" (blue)
  - 60-69: "Fair" (amber)
  - 45-59: "Needs Work" (orange)
  - 0-44: "Low" (red)

**Data Sources:**
```typescript
{
  readinessScore: 67,
  diagnostic: {
    totalSessions: 2,
    recentSessions: [
      {
        sessionId: "uuid",
        examType: "PMLE",
        score: 70,
        completedAt: "2025-10-29",
        totalQuestions: 20
      }
    ]
  },
  practice: {
    totalQuestionsAnswered: 45,
    correctAnswers: 37,
    accuracyPercentage: 82,
    lastPracticeDate: "2025-10-30"
  }
}
```

### Empty State

For new users (readiness score = 0):
```tsx
<InfoCard>
  <h3>Get Started with Your Study Journey</h3>
  <ul>
    <li>Take a diagnostic test to assess your current knowledge</li>
    <li>Practice regularly with our question bank</li>
    <li>Track your progress over time</li>
    <li>Focus on areas where you need improvement</li>
  </ul>
</InfoCard>
```

---

## Results & Review Experience

### Summary Page Layout (`/diagnostic/[sessionId]/summary`)

**Hero Section: Verdict Block**
```
┌──────────────────────────────────────────┐
│  [Gauge: 67%]  Readiness: Good           │
│                Pass typically ≥70%        │
│                                           │
│  Exam: PMLE — Oct '24                    │
│  Score: 67% (20 Qs)                      │
│  Time: 12m 34s                           │
│                                           │
│  [Start 10-min practice on weak topics]  │
│  [Retake diagnostic (20 Q)]              │
└──────────────────────────────────────────┘
```

**Domain Performance Section**
```
┌──────────────────────────────────────────┐
│ Domain Performance                       │
│                                           │
│ ML Problem Framing    [████░░░░] 40%    │
│ 2/5 questions                            │
│                                           │
│ Data Engineering      [██████░░] 60%    │
│ 3/5 questions                            │
│                                           │
│ Model Development     [████████] 80%    │
│ 4/5 questions                            │
└──────────────────────────────────────────┘
```

**Study Plan Section**

Organizes domains into tiers:

1. **Foundation First** (<40% accuracy)
   - "Critical gaps that need immediate attention"
   - Time estimate: 35-45 min
   - Red "Critical" badges
   - [Start practice (10)] button per domain

2. **Core** (40-69% accuracy)
   - "Important topics that need strengthening"
   - Time estimate: 60-90 min
   - Amber "Moderate" badges

3. **Stretch** (≥70% accuracy)
   - "Areas where you're already strong"
   - Time estimate: 30-45 min
   - Green "Strong" badges

**Question Review Section**

Interactive review interface with:
- **Filter pills:** All, Incorrect, Flagged, Low Confidence
- **Domain dropdown:** Filter by certification domain
- **Search box:** Find questions by text
- **Question cards:** Expandable with full details

**Question Card States:**

*Collapsed View:*
```
┌──────────────────────────────────────────┐
│ [✗ Incorrect] [🚩 Flagged] [ML Framing] │
│                                           │
│ What is the primary purpose of feature... │
│ engineering in machine learning?          │
│                                           │
│ [View explanation] [Practice similar]     │
└──────────────────────────────────────────┘
```

*Expanded View:*
```
┌──────────────────────────────────────────┐
│ Question:                                 │
│ What is the primary purpose of feature   │
│ engineering in machine learning?          │
│                                           │
│ Answer Choices:                           │
│ A. To reduce dataset size        [gray]  │
│ B. Transform raw data...  [red: Your ans]│
│ C. To visualize patterns         [gray]  │
│ D. To store data      [green: ✓ Correct] │
│                                           │
│ Explanation:                              │
│ Feature engineering transforms raw data...│
└──────────────────────────────────────────┘
```

### Quick Actions Rail (Right Side)

```
┌──────────────────────┐
│ Quick Actions        │
│                      │
│ 🔄 Retake diagnostic │
│ 📚 Start 10-min...   │
│ 📄 Export PDF        │
│ 🔗 Share results     │
│                      │
│ Schedule Study       │
│ [15m] [30m] [45m]   │
└──────────────────────┘

{/* For users without paid access */}
┌──────────────────────┐
│ Ready to Pass?       │
│                      │
│ Get personalized...  │
│                      │
│ [Get PMLE Pass]      │
│ $39 once · 90 days   │
└──────────────────────┘
```

---

## Question Display Patterns

### Visual Design System

**Option States:**

1. **Unselected** (default)
   - Gray border
   - White background
   - Gray text
   - Hover: Darker gray border

2. **Selected** (before submission)
   - Indigo border (2px)
   - Indigo ring (ring-4)
   - Light indigo background
   - Indigo text
   - Font weight: semibold

3. **Correct Answer** (after submission)
   - Green border
   - Green background (light)
   - Green text
   - ✓ checkmark icon

4. **Incorrect Answer** (after submission)
   - Red border
   - Red background (light)
   - Red text
   - ✗ cross icon

5. **Disabled** (after submission, non-selected)
   - Gray with 70% opacity
   - Cursor: not-allowed

### Option Layout Pattern

```tsx
<label className="flex gap-3 rounded-xl border p-4 cursor-pointer">
  <input type="radio" className="sr-only" />
  
  {/* Letter bubble */}
  <div className="w-8 h-8 rounded-full grid place-content-center">
    A
  </div>
  
  {/* Option text */}
  <div className="flex-1 leading-relaxed">
    Option text goes here with automatic wrapping
  </div>
</label>
```

### Question Text Formatting

- **Font size:** text-lg (18px) for question stem
- **Line height:** leading-relaxed (1.625)
- **Max width:** max-w-3xl (768px) for readability
- **Color:** text-slate-700 (not pure black)
- **Margin:** mb-8 after question stem

### Progress Indicators

**Diagnostic Header:**
```tsx
<header className="sticky top-0 bg-white/95 backdrop-blur">
  <div className="flex justify-between">
    <h1>Diagnostic</h1>
    <span>Question 15 of 20</span>
  </div>
  
  {/* Visual progress bar */}
  <div className="h-1 bg-slate-100">
    <div 
      className="h-1 bg-indigo-600 transition-all" 
      style={{ width: "75%" }}
    />
  </div>
</header>
```

**Left Rail Progress:**
```tsx
<Card>
  <h3>Progress</h3>
  <div className="flex justify-between">
    <span>Completed</span>
    <span className="font-medium">15 / 20</span>
  </div>
  <div className="w-full bg-slate-100 rounded-full h-2">
    <div 
      className="bg-indigo-600 h-2 rounded-full" 
      style={{ width: "75%" }}
    />
  </div>
</Card>
```

---

## Feedback & Explanations

### Immediate Feedback (Practice Mode)

**Shown After Submission:**

```tsx
<div className="mt-8">
  <div className={isCorrect ? "text-green-600" : "text-red-600"}>
    {isCorrect ? "Correct!" : "Incorrect."}
  </div>
  
  <div className="mb-3">
    <strong>Explanation:</strong>
    <div className="mt-1">
      {explanationText || "No explanation provided."}
    </div>
  </div>
  
  <button onClick={nextQuestion} className="mt-4">
    Next Question
  </button>
</div>
```

**No Feedback in Diagnostic:**
- Answers submitted immediately advance to next question
- No explanation shown during test
- All feedback deferred to summary page
- Maintains test-like conditions

### Explanation Quality Standards

All explanations must:
1. **Explain why the correct answer is right**
2. **Address why common distractors are wrong**
3. **Provide context or additional learning**
4. **Reference official documentation when applicable**
5. **Use clear, concise language**

**Example Structure:**
```
The correct answer is B: "Transform raw data into meaningful features"

Feature engineering is the process of selecting, creating, and 
transforming raw data attributes into features that improve ML 
model performance. 

Option A (reduce dataset size) describes data sampling, not feature 
engineering. Option C (visualize patterns) is exploratory data 
analysis. Option D (store data) is data management.

Key takeaway: Feature engineering directly impacts model accuracy 
by creating informative input signals from raw data.
```

---

## Monetization & Conversion Points

### Free entry

Users can start a PMLE diagnostic without an account. The basic readiness summary is available without an account. Create a free account for question review and saved results. Free registered practice is limited to 5 questions per week, without explanations or domain-targeted practice.

Do not describe diagnostics as a one-free-run limit or retakes as a paid-only feature. Those restrictions are not enforced.

### Paid access

**PMLE Pass** costs US$39 once for 90 days of full PMLE access. It includes explanations and full practice. There is no subscription or automatic renewal. Users can request a refund within 7 days of purchase. A refund ends pass access.

- Anonymous users see signup prompts, not payment trials.
- Registered free users see the PMLE Pass offer at paid feature boundaries.
- Active passholders and active legacy subscribers do not see paid feature gates.
- Expired or refunded passes no longer grant access.
- Existing active subscriptions keep their access and use the billing page to manage their legacy subscription.

### Checkout

The client sends an optional idempotency key, never a Stripe price ID. The server selects the one-time PMLE Pass offer. Access starts only after confirmed payment, not from a checkout success URL.

The billing page shows **Access until &lt;date&gt;** for passholders. Only accounts with legacy subscription metadata have a subscription portal button. Refund requests use support, not subscription cancellation.

---

## Accessibility & Usability

### Keyboard Navigation

**Diagnostic Session:**
- `↑` / `↓` or `j` / `k` - Navigate between options
- `Enter` - Submit selected answer
- `Tab` - Move between interactive elements
- `Esc` - Close modals

**Practice Mode:**
- `Tab` - Cycle through options
- `Space` - Select option (on focused radio)
- `Enter` - Submit answer

### Screen Reader Support

**Question Structure:**
```html
<div role="radiogroup" aria-label="Answer choices">
  <label>
    <input type="radio" name="answer" />
    <span>Option text</span>
  </label>
</div>
```

**Status Announcements:**
- "Question 15 of 20"
- "Answer selected: Option B"
- "Submitting answer..."
- "Answer submitted successfully"

### Mobile Optimization

**Responsive Breakpoints:**
- `sm`: 640px - Compact layout
- `md`: 768px - Standard spacing
- `lg`: 1024px - Show left rail

**Touch Targets:**
- Minimum 44×44px for all interactive elements
- Increased padding on mobile: `p-4 md:p-6`
- Larger text sizes on mobile: `text-base md:text-sm`

**Mobile-Specific:**
- Left rail hidden, metadata moved to header
- Larger option buttons (more padding)
- Sticky footer for submit button
- Optimized font sizes for readability

### Loading States

**Skeleton Loaders:**
```tsx
{loading && (
  <div className="space-y-4">
    <div className="h-20 bg-gray-200 rounded animate-pulse" />
    <div className="h-12 bg-gray-200 rounded animate-pulse" />
    <div className="h-12 bg-gray-200 rounded animate-pulse" />
  </div>
)}
```

**Progressive Loading:**
1. Show page structure immediately
2. Load critical content first (question stem)
3. Load options next
4. Load metadata last

### Error Handling

**User-Friendly Messages:**
- ❌ `"Database error: Connection timeout"`
- ✅ `"Failed to load question. Please try again."`

**Error Actions:**
- Retry button always provided
- Alternative actions (e.g., "Start New Diagnostic")
- Contact support link for persistent errors

---

## Performance & Optimization

### Question Loading Strategy

**Diagnostic:**
- Pre-fetch all questions at session start
- Stored in component state
- No network requests during test
- Answers submitted asynchronously

**Practice:**
- Fetch one question at a time
- Cache previous question (browser back support)
- Prefetch next question after submission (future enhancement)

### Answer Persistence

**Background Submission:**
- POST `/api/diagnostic` with answer
- Retry logic: 3 attempts with exponential backoff
- UI not blocked by submission
- Visual indicator for failed submissions

**Retry Strategy:**
```typescript
Attempt 1: Immediate
Attempt 2: 1 second delay
Attempt 3: 2 second delay
Final: Mark as error, continue test
```

### Analytics Tracking

**Key Events:**
1. `diagnostic_started` - Session begins
2. `diagnostic_question_answered` - Each submission
3. `diagnostic_completed` - Session finished
4. `diagnostic_summary_viewed` - Results page loaded
5. `practice_question_loaded` - Practice question shown
6. `practice_question_submitted` - Answer submitted

**Tracked Properties:**
- User ID (if authenticated)
- Session ID
- Question ID
- Selected answer
- Is correct
- Time spent
- Score
- Exam type

---

## Future Enhancements

### Planned Features

1. **Question Bookmarking**
   - Save questions for later review
   - Create custom study sets
   - Bookmark from any question view

2. **Spaced Repetition**
   - Algorithmically resurface missed questions
   - Optimize review timing
   - Adaptive difficulty adjustment

3. **Study Streaks**
   - Daily practice tracking
   - Streak maintenance incentives
   - Push notifications for consistency

4. **Social Features**
   - Share results with friends
   - Compare scores anonymously
   - Study groups and leaderboards

5. **Enhanced Explanations**
   - Video explanations
   - Code examples (for programming questions)
   - External resource links
   - Community comments

6. **Adaptive Testing**
   - Dynamic difficulty adjustment
   - Shorter diagnostics with same accuracy
   - Personalized question selection

7. **Multi-format Questions**
   - Multi-select (select all that apply)
   - Scenario-based (context + multiple questions)
   - Drag-and-drop ordering
   - Fill-in-the-blank code completion

---

## Summary: Question UX at a Glance

### User Interaction Model

```
1. DIAGNOSTIC (No feedback during test)
   Question → Select → Submit → Next → ... → Summary

2. PRACTICE (Immediate feedback)
   Question → Select → Submit → Feedback → Next Question

3. REVIEW (Post-diagnostic)
   Summary → Expandable questions → Full explanation
```

### Key UX Principles

1. **Progressive Disclosure** - Show information when needed
2. **Immediate Feedback** - In practice, not in diagnostic
3. **Visual Hierarchy** - Clear indication of correct/incorrect
4. **Error Resilience** - Graceful handling of failures
5. **Mobile-First** - Optimized for touch interactions
6. **Accessibility** - Keyboard nav, screen readers, ARIA labels

### Conversion Funnel

```
Landing → Diagnostic → Signup → Summary → Limited practice → PMLE Pass
          (free)        (free)    (convert)   (limited)   (upgrade)
```

### Monetization Points

- ✅ **Free:** Diagnostic test + results view
- 💰 **Free registered practice:** 5 questions/week, no explanations
- 💎 **PMLE Pass:** US$39 once, 90-day full access, no renewal; 7-day refund ends access

---

## Appendix: Component Reference

### Shared Components

**QuestionDisplay** (`/components/practice/QuestionDisplay.tsx`)
- Renders question stem and options
- Handles selection state
- Shows feedback colors after submission

**QuestionFeedback** (`/components/practice/QuestionFeedback.tsx`)
- Shows correct/incorrect message
- Displays explanation text
- "Next Question" button

**SubmitButton** (`/components/practice/SubmitButton.tsx`)
- Disabled when no selection
- Shows "Submitting..." state
- Standard primary button styling

**QuestionReview** (`/components/diagnostic/QuestionReview.tsx`)
- Post-diagnostic review component
- Expandable question cards
- Grouping by domain
- Filtering by status

### Page Components

- `/app/diagnostic/page.tsx` - Diagnostic start page
- `/app/diagnostic/[sessionId]/page.tsx` - Active diagnostic
- `/app/diagnostic/[sessionId]/summary/page.tsx` - Results
- `/app/practice/question/page.tsx` - Random practice
- `/app/practice/question/[id]/page.tsx` - Specific question
- `/app/dashboard/page.tsx` - User dashboard

### API Endpoints

- `GET /api/questions/current` - Fetch practice question
- `GET /api/questions/[id]` - Fetch specific question
- `POST /api/questions/submit` - Submit practice answer
- `POST /api/diagnostic` - Diagnostic CRUD operations
- `GET /api/diagnostic/summary/[id]` - Fetch results




