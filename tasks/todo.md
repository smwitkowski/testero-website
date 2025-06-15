Perfect — here’s a detailed and actionable **To-Do List** to hand off to a developer for the **"Close the Loop on Diagnostic"** task. It’s broken into logical chunks, with enough specificity to pick up and execute without high-level context.

---

## ✅ **To-Do List: Close the Loop on Diagnostic**

---

### 🔁 **1. Persist & Resume Anonymous Sessions**

**Goal:** Allow users to leave and return to an unfinished diagnostic session.

#### Tasks:

* [ ] **Store session ID**
  In `diagnostic/start.ts`, after receiving the `anonymous_session_id` from the backend, store it in `localStorage` (e.g., under the key `testero_diagnostic_session_id`).

* [ ] **Check for unfinished session on load**
  On `/diagnostic/start` page load:

  * Read `testero_diagnostic_session_id` from localStorage.
  * Call a new backend route `/api/diagnostic/session/[id]/status` to check:

    * If the session exists
    * If it's completed or still active

* [ ] **Show resume UI**
  If an active session is found:

  * Display a message: “You have an unfinished diagnostic. Would you like to resume?”
  * Offer buttons: “Resume” → route to `/diagnostic/[id]`, or “Start Over” → clears the session ID and starts fresh.

---

### 📊 **2. Build Diagnostic Results Summary Page**

**Goal:** Display results after a diagnostic is completed.

#### Tasks:

* [ ] **Create route `/diagnostic/[id]/summary`**
  This should be a new App Router page (e.g., `app/diagnostic/[id]/summary/page.tsx`).

* [ ] **Fetch session data from Supabase**

  * Pull: exam name, start/end time, question IDs, user answers, correct answers, per-question metadata (e.g., domain)
  * Optionally cache via `getServerSideProps` or RSC if needed

* [ ] **Calculate and display:**

  * Total questions
  * Number correct / incorrect
  * Percentage score
  * Score breakdown by domain (e.g., "Machine Learning: 4/6")
  * List of all questions with:

    * User answer
    * Correct answer
    * Indicator of correct/incorrect

* [ ] **Add fallback handling**

  * If invalid session ID or session not complete, show friendly error or redirect to `/diagnostic/start`.

* [ ] **Add CTA**
  Add a final section with a placeholder button: “Start My Study Plan” (route TBD).

---

### 🎨 **3. Design & Style Results Page**

**Goal:** Ensure the summary page is visually clean and readable.

#### Tasks:

* [ ] Use Tailwind CSS or existing component system
* [ ] Include at least one of:

  * Horizontal bar chart (e.g., per-domain scores)
  * List view with correct/incorrect indicators
* [ ] Responsive design for mobile

---

### 🧪 **4. Testing & Quality Checks**

**Goal:** Ensure functionality and stability.

#### Tasks:

* [ ] Add unit test for session status API route (`/api/diagnostic/session/[id]/status`)
* [ ] Add E2E test:

  * Start a diagnostic
  * Partially complete it
  * Reload → see resume prompt
  * Complete → land on results page
* [ ] Add test coverage for summary calculation function

---

### 🧹 **5. Clean-up & Final Touches**

**Goal:** Ensure UX and code hygiene.

#### Tasks:

* [ ] Remove session ID from `localStorage` once a session is marked as complete.
* [ ] Link to summary page automatically upon session completion.
* [ ] Add PostHog events:

  * `diagnostic_resume_shown`
  * `diagnostic_resumed`
  * `diagnostic_summary_viewed`

---

Let me know if you want this copied into a `.md` file or rendered as Linear tickets with descriptions and acceptance criteria.
