# PMLE Question Quality Rubric

**Purpose:** This rubric defines quality standards for PMLE (Professional Machine Learning Engineer) questions to ensure they meet educational and certification exam standards.

**Last Updated:** January 2025

---

## Overview

All PMLE questions should meet these quality criteria before being marked as `ACTIVE` and served to users. Questions that fail these criteria should be marked as `DRAFT` or `RETIRED` until issues are resolved.

---

## 1. Question Stem Requirements

### ✅ Required Elements

- **Clear scenario**: Question presents a realistic, work-relevant scenario
- **Specific context**: Includes relevant details (company type, data location, constraints)
- **Single focus**: Asks one clear question or requires one decision
- **Appropriate length**: 2-4 sentences (not too brief, not overly verbose)
- **Professional tone**: Uses industry-standard terminology

### ✅ Quality Indicators

- **Realistic**: Scenario could occur in real ML engineering work
- **Relevant**: Tests knowledge relevant to PMLE certification objectives
- **Unambiguous**: No ambiguity about what is being asked
- **No giveaways**: Doesn't hint at the correct answer in the stem

### ❌ Common Issues to Avoid

- Vague scenarios ("You have data...")
- Multiple questions in one stem
- Unrealistic constraints or requirements
- Grammatical errors or unclear phrasing
- References to outdated technologies or practices

---

## 2. Answer Set Requirements

### ✅ Required Elements

- **3-5 answer options**: Standard is 4 options (A, B, C, D)
- **Exactly one correct answer**: Only one option marked `is_correct = true`
- **Unique labels**: Each option has a unique label (A, B, C, D, etc.)
- **Non-empty text**: All options have meaningful text content

### ✅ Quality Indicators

- **Plausible distractors**: Wrong answers are believable and test understanding
- **Similar length**: Options are roughly similar in length (avoid obvious short/long patterns)
- **No patterns**: Correct answers distributed across positions (not always B or C)
- **No "all/none of the above"**: Avoid these as correct answers
- **No duplicates**: Options don't repeat the same concept with slight variations

### ❌ Common Issues to Avoid

- Obvious wrong answers (too easy to eliminate)
- Trick questions with subtle wording differences
- Options that are all correct but one is "most correct"
- Grammatical inconsistencies between options
- Options that reference technologies not mentioned in stem

---

## 3. Explanation Requirements

### ✅ Required Elements

- **Explains correct answer**: Clearly states why the correct option is right
- **Addresses distractors**: Explains why wrong answers are incorrect (for key distractors)
- **Minimum length**: At least 50 characters of meaningful explanation
- **Professional tone**: Uses accurate technical terminology

### ✅ Quality Indicators

- **Comprehensive**: Covers the key concept being tested
- **Educational**: Helps learner understand the underlying principle
- **Specific**: References specific technologies, services, or concepts from the question
- **Actionable**: Explains what to do and why (not just "this is correct")

### Explanation Structure (Recommended)

1. **Opening statement**: "Option X is correct because..."
2. **Key reasoning**: Explain the core concept or decision criteria
3. **Distractor analysis**: "Option Y is incorrect because..." (for 1-2 main distractors)
4. **Context**: Connect back to the scenario if relevant

### ❌ Common Issues to Avoid

- Vague explanations ("This is the best option")
- Copy-paste from documentation without context
- Incorrect technical information
- Too brief (less than 50 characters)
- Doesn't explain why other options are wrong

---

## 4. Domain and Difficulty Requirements

### ✅ Domain Mapping

- **Accurate domain**: Question maps to correct PMLE blueprint domain
- **Domain code**: Uses standardized domain code (e.g., `DATA_PIPELINES`)
- **Relevance**: Question tests knowledge relevant to that domain

### ✅ Difficulty Levels

- **EASY**: Tests basic recall or straightforward application
  - Example: "What service is used for X?"
  - Example: "Which command does Y?"

- **MEDIUM**: Tests understanding and application in common scenarios
  - Example: "Given scenario X, which approach is best?"
  - Example: "What configuration is needed for Y?"

- **HARD**: Tests deep understanding, edge cases, or complex scenarios
  - Example: "Given constraints X, Y, Z, what is the optimal solution?"
  - Example: "What are the trade-offs between approaches A and B?"

### Difficulty Distribution (Recommended)

- **EASY**: 20-30% of questions
- **MEDIUM**: 50-60% of questions
- **HARD**: 20-30% of questions

---

## 5. Technical Accuracy Requirements

### ✅ Required Elements

- **Current information**: Uses current Google Cloud services and features
- **Accurate terminology**: Uses correct service names and concepts
- **Realistic constraints**: Constraints reflect real-world limitations
- **Correct best practices**: Recommends actual best practices for the scenario

### ❌ Common Issues to Avoid

- Deprecated services or features
- Incorrect service names or capabilities
- Unrealistic performance expectations
- Contradicts official Google Cloud documentation
- References features that don't exist

---

## 6. Question Status Workflow

### Status Values

- **DRAFT**: Question is being created or reviewed, not ready for use
- **ACTIVE**: Question meets all quality criteria and is ready for users
- **RETIRED**: Question is deprecated (outdated, incorrect, or replaced)

### Quality Gate Checklist

Before marking a question as `ACTIVE`, verify:

- [ ] Stem is clear, realistic, and unambiguous
- [ ] Has 3-5 answer options with exactly one correct
- [ ] All answer options are plausible and well-written
- [ ] Has comprehensive explanation (50+ characters)
- [ ] Explanation explains correct answer and key distractors
- [ ] Maps to correct domain
- [ ] Difficulty level is appropriate
- [ ] Technically accurate and current
- [ ] No grammatical or spelling errors
- [ ] Follows PMLE blueprint objectives

---

## 7. Review Process

### Initial Review (Post-Migration)

1. **Automated checks**: Run QA SQL queries to find structural issues
2. **Random sample**: Review 20-30 random questions manually
3. **Domain coverage**: Verify questions distributed across all domains
4. **Difficulty distribution**: Check difficulty levels are reasonable

### Ongoing Review

- **User feedback**: Monitor user-reported issues
- **Performance metrics**: Track question difficulty and user success rates
- **Regular audits**: Periodically review questions for accuracy and relevance

---

## 8. Examples

### ✅ Good Question Example

**Stem:**
"You are building a ML pipeline for customer churn prediction. Your data is stored in BigQuery, and you need a solution that allows quick iteration and deployment within your existing Google Cloud infrastructure. What is the best approach?"

**Options:**
- A: Export data to Cloud Storage and use TensorFlow on AI Platform
- B: Use BigQuery ML to train a logistic regression model directly in BigQuery
- C: Use Dataflow to preprocess and AutoML Tables for training
- D: Use Cloud Functions to process data and make predictions

**Explanation:**
"Option B is correct because BigQuery ML allows you to build and deploy models directly where your data resides, minimizing data movement and latency. Logistic regression is suitable for binary classification tasks like churn prediction. This approach efficiently uses existing BigQuery infrastructure and allows seamless integration with analytics workflows. Option A introduces unnecessary complexity with data export. Option C adds processing overhead. Option D is not suitable for large-scale ML workloads."

**Why it's good:**
- Clear, realistic scenario
- Plausible distractors
- Comprehensive explanation
- Tests relevant PMLE knowledge

### ❌ Poor Question Example

**Stem:**
"What is BigQuery?"

**Options:**
- A: A database
- B: A data warehouse
- C: A ML service
- D: All of the above

**Why it's poor:**
- Too vague (no scenario)
- Option D is a giveaway
- Doesn't test PMLE-specific knowledge
- Explanation would be too brief

---

## 9. Quality Metrics

Track these metrics to maintain question quality:

- **Explanation coverage**: % of questions with explanations (target: 100%)
- **Answer integrity**: % of questions with exactly 1 correct answer (target: 100%)
- **Domain coverage**: Questions per domain (target: balanced distribution)
- **Difficulty distribution**: % by difficulty level (target: 20-30% EASY, 50-60% MEDIUM, 20-30% HARD)
- **User success rate**: Average % correct per question (target: 40-70% depending on difficulty)
- **Reported issues**: Number of user-reported problems (target: < 1% of questions)

---

## 10. Remediation Process

When a question fails quality checks:

1. **Mark as DRAFT**: Change status to prevent serving to users
2. **Document issue**: Note what's wrong (stem, answers, explanation, etc.)
3. **Fix or regenerate**: Update the question or flag for regeneration
4. **Re-review**: Verify fixes meet quality criteria
5. **Mark as ACTIVE**: Once fixed, change status back to ACTIVE

---

## Summary

A high-quality PMLE question:
- ✅ Presents a realistic, work-relevant scenario
- ✅ Tests knowledge relevant to PMLE certification
- ✅ Has 3-5 plausible answer options with exactly one correct
- ✅ Includes a comprehensive explanation
- ✅ Maps to the correct domain
- ✅ Has appropriate difficulty level
- ✅ Is technically accurate and current
- ✅ Follows professional writing standards

Questions that meet all these criteria provide value to learners preparing for the PMLE exam and help build trust in the Testero platform.

