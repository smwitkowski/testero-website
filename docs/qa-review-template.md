# PMLE Question QA Review Template

**Review Date:** _________________  
**Reviewer:** _________________  
**Sample Size:** _________________  
**Questions Reviewed:** __ / __

---

## Review Checklist (Per Question)

**Question ID:** `_________________`

### ✅ Stem Quality
- [ ] Clear, realistic scenario
- [ ] Specific context provided
- [ ] Single focused question
- [ ] Appropriate length (2-4 sentences)
- [ ] Professional tone
- [ ] No giveaways or hints
- [ ] Tests relevant PMLE knowledge

**Notes:** ___________________________________________________

### ✅ Answer Set Quality
- [ ] 3-5 answer options (standard: 4)
- [ ] Exactly one correct answer
- [ ] Distractors are plausible
- [ ] Options similar in length
- [ ] No obvious patterns
- [ ] All options have meaningful content

**Notes:** ___________________________________________________

### ✅ Explanation Quality
- [ ] Comprehensive (> 200 characters preferred)
- [ ] Explains why correct answer is right
- [ ] Covers key distractors
- [ ] Technically accurate
- [ ] Clear and concise

**Notes:** ___________________________________________________

### ✅ Domain & Difficulty
- [ ] Domain mapping is correct
- [ ] Difficulty level appropriate
  - [ ] EASY (basic recall)
  - [ ] MEDIUM (common scenarios)
  - [ ] HARD (deep understanding)
- [ ] Aligns with PMLE blueprint

**Notes:** ___________________________________________________

### Overall Assessment
- [ ] **PASS** - Meets all quality criteria, keep ACTIVE
- [ ] **MINOR ISSUES** - Small issues, mark as DRAFT for fix
- [ ] **MAJOR ISSUES** - Significant problems, mark as DRAFT or RETIRE

**Issues Found:**  
□ None  
□ stem_unclear  
□ distractor_poor  
□ explanation_incomplete  
□ domain_mismatch  
□ difficulty_mismatch  
□ stem_ambiguous  
□ no_correct_answer  
□ explanation_wrong  
□ domain_wrong  
□ Other: _______________________________

**Action Taken:**  
□ Keep ACTIVE  
□ Mark as DRAFT  
□ Mark as RETIRED  
□ Update domain: ___________________  
□ Update difficulty: ___________________

**Reviewer Notes:**  
___________________________________________________  
___________________________________________________  
___________________________________________________

---

## Review Summary

### Quality Metrics
- **Total Reviewed:** ___
- **Passed (ACTIVE):** ___
- **Minor Issues (DRAFT):** ___
- **Major Issues (DRAFT/RETIRED):** ___

### Common Issues Found
1. ___________________________________________________
2. ___________________________________________________
3. ___________________________________________________

### Recommendations
- ___________________________________________________
- ___________________________________________________
- ___________________________________________________

### Status Distribution (After Review)
- **ACTIVE:** ___ questions (___%)
- **DRAFT:** ___ questions (___%)
- **RETIRED:** ___ questions (___%)

---

## SQL Commands for Actions

### Mark as DRAFT
```sql
UPDATE questions 
SET status = 'DRAFT', updated_at = NOW() 
WHERE id = 'QUESTION_ID';
```

### Mark as RETIRED
```sql
UPDATE questions 
SET status = 'RETIRED', updated_at = NOW() 
WHERE id = 'QUESTION_ID';
```

### Update Domain
```sql
UPDATE questions 
SET domain_id = (
    SELECT id FROM exam_domains WHERE code = 'DOMAIN_CODE'
),
updated_at = NOW()
WHERE id = 'QUESTION_ID';
```

### Update Difficulty
```sql
UPDATE questions 
SET difficulty = 'EASY'|'MEDIUM'|'HARD', updated_at = NOW() 
WHERE id = 'QUESTION_ID';
```

