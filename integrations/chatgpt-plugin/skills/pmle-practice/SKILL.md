---
name: pmle-practice
description: Run a one-question-at-a-time Google Cloud Professional Machine Learning Engineer (PMLE) practice quiz with Testero tools, cited answer feedback, and a running score. Use when the user asks for PMLE exam practice, a PMLE quiz, or practice in a PMLE exam domain.
---

# PMLE practice

Use `pmle_exam_overview`, `get_practice_question`, and `check_answer` from the
Testero PMLE MCP server. Explicit user instructions take priority over workflow
preferences. Do not invent tool results or reveal answer information before the
user chooses an option.

## Start

1. Call `pmle_exam_overview` to get the exam domains and format. Separately
   explain the limits documented here: this is a three-question demo, only
   domains 1, 3, and 6 have questions, and repetitions are possible. It is not a
   full exam simulation.
2. Use the user's requested domain, or omit `domain` for mixed practice.
   `get_practice_question({domain?})` accepts an exact domain title from the
   overview, a number 1–6 as a string, or a legacy domain code. Ask for
   clarification if the request is ambiguous. If a domain has no demo question, offer domains 1, 3,
   or 6 or mixed practice; do not silently change the requested domain.
3. Start a chat-local score at 0 correct / 0 answered. Keep it through the
   session unless the user asks to reset it. Do not claim persistent progress.

## Ask and wait

1. Call `get_practice_question` with the selected domain, if any.
2. Retain the returned `question_token` exactly as received. It is an opaque
   random UUID, not a question ID or answer key. Never derive or replace it.
3. Present the stem and all options A–D from the result. Do not mark a correct
   choice, give an answer explanation, or call `check_answer` yet.
4. Ask the user to choose A, B, C, or D. End the turn and wait for their answer.
   If their answer is unclear or names more than one option, ask which single
   option they choose. Do not choose for them.

## Grade and explain

1. Only after an unambiguous choice, call
   `check_answer({question_token: <retained token>, choice: <A-D>})`.
2. Read the completed result. Use its `correct` boolean as the grade, not an
   inference from the labels or explanations. Increment answered once for that
   question; increment correct only when `correct` is true. Do not count errors,
   skipped questions, or repeat grading of the same answered question token.
3. Report correct/incorrect and the running score, such as **2 / 3 correct**.
   Show the chosen option's `label`, `text`, and `explanation`. When incorrect,
   also show the correct option's `label`, `text`, and `explanation`. The result
   supplies `chosen_option` and `correct_option`, each with `doc_url` and
   `doc_quote`; cite the supplied URL and quote for each explanation you show.
   Preserve quotes exactly. Do not invent citations or claim to have verified
   the linked pages.
4. Mention Testero's free diagnostic using the returned diagnostic line once
   per practice session. Preserve that line exactly, with no sales language or
   repeated promotion. Do not invent a diagnostic assessment.
5. Offer another question or a domain focus. Stop if they decline. For a
   requested multi-question quiz, continue one question at a time and still wait
   for each choice before grading. Report the final running score when done.

## Limits and failures

- Tokens live in server memory and expire after one hour or a server restart.
  On an invalid or expired token, explain that the question must be fetched
  again. Do not guess its answer or update the score. Ask before fetching a
  replacement, then wait for a new choice.
- The server has no authentication or persistent account state. Keep score in
  this chat only. Do not request credentials or claim saved account progress.
- If the MCP tools are unavailable, explain that the Testero MCP connection is
  required and stop. Installing these instructions alone does not start the
  server. Do not fabricate practice questions as tool output.
- If a tool fails or its result is missing required fields, say what is missing
  and do not grade or invent a result. Offer to retry.
- Repeated questions are possible in this small demo. Do not claim a fresh
  question, deduplicate guarantees, exam readiness, or complete domain coverage.
