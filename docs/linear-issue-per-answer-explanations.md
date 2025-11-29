# Linear Issue: Migrate to Per-Answer Explanations

**Title:** Admin: Migrate explanations from question-level to per-answer explanations

**Description:**

## Goal

Migrate the explanation system from a single question-level explanation to per-answer explanations, where each answer option (A, B, C, D) has its own explanation text explaining why it's correct or incorrect. This provides better educational value by explaining each option individually.

## Implementation

### Database Changes

1. **Migration**: `supabase/migrations/20251129_add_answer_explanations.sql`
   - Add `explanation_text TEXT` column to `answers` table
   - Add index on `explanation_text` for query performance
   - Column is nullable to support gradual migration

### Schema & Types

2. **TypeScript Types** (`lib/admin/questions/editor-types.ts`):
   - Add `explanation_text?: string` to `QuestionAnswer` interface
   - Remove question-level `explanation_text`, `doc_links`, `reasoning_style` from `QuestionUpdatePayload`
   - Keep `doc_links` optional at question level for future use

3. **Validation Schema** (`lib/admin/questions/editor-schema.ts`):
   - Add `explanation_text: z.string().optional()` to `AnswerSchema`
   - Remove question-level `explanation_text` requirement
   - Add validation: correct answer must have an explanation (non-empty string)
   - Remove `reasoning_style` field

### Data Fetching

4. **Query Functions** (`lib/admin/questions/editor-query.ts`):
   - Update `fetchQuestionForEditor` to select `explanation_text` from `answers` table
   - Remove nested `explanations` table query
   - Map `explanation_text` to answer objects in response
   - Set `explanation: null` in return type (deprecated field)

### UI Components

5. **AnswerOptionsCard** (`components/admin/questions/AnswerOptionsCard.tsx`):
   - Add `Textarea` component import
   - Add explanation textarea below each answer option input
   - Dynamic placeholder: "Explain why this is the correct answer..." for correct option, "Explain why this option is incorrect..." for incorrect options
   - 3-row textarea with consistent styling
   - Update form handlers to include `explanation_text` in answer updates

6. **QuestionEditor** (`components/admin/questions/QuestionEditor.tsx`):
   - Remove `ExplanationCard` import and usage
   - Update default values to include `explanation_text: ""` for all answers
   - Remove question-level `explanation_text`, `doc_links`, `reasoning_style` from form defaults

7. **Remove ExplanationCard**:
   - Component no longer needed (per-answer explanations replace it)

### API Routes

8. **PUT Endpoint** (`app/api/admin/questions/[id]/route.ts`):
   - Update answer insertion to include `explanation_text: answer.explanation_text || null`
   - Remove `explanations` table upsert logic
   - Answers now contain all explanation data

## UI Changes

### Answer Options Card

- **Before**: Single explanation card at question level
- **After**: Each answer option (A-D) has its own explanation textarea
  - Answer text input (existing)
  - Explanation textarea (new, below answer text)
  - Placeholder text adapts based on `is_correct` status
  - Visual consistency with existing form styling

### Validation

- Correct answer must have non-empty explanation (enforced by Zod schema)
- Incorrect answers can have optional explanations
- Form-level validation error shown if correct answer lacks explanation

## Persistence

- **Database**: Explanations stored in `answers.explanation_text` column
- **API**: PUT `/api/admin/questions/[id]` saves `explanation_text` with each answer
- **Migration**: Existing question-level explanations in `explanations` table remain but are no longer used by editor
- **Future**: Manual migration of existing explanations to answer-level can be done through admin editor

## Acceptance Criteria

✅ Database migration adds `explanation_text` column to `answers` table  
✅ Each answer option (A-D) displays its own explanation textarea in admin editor  
✅ Correct answer explanation is required (validation enforced)  
✅ Incorrect answer explanations are optional  
✅ Saving question persists explanations with answers  
✅ Loading question fetches explanations from answers table  
✅ Old question-level explanation UI removed  
✅ TypeScript types updated throughout codebase  
✅ Validation schema enforces correct answer explanation requirement  

## Technical Notes

- **Backward Compatibility**: Old `explanations` table data remains but is not accessed by editor
- **Migration Strategy**: Existing explanations can be manually migrated through admin editor
- **Validation**: Correct answer must have explanation; others optional
- **Performance**: Index added on `explanation_text` for query optimization

## Labels

- `admin`
- `backend`
- `frontend`
- `database`
- `pmle`
- `content-integrity`
- `ui`

## Estimate

**Completed**: ~3-4 hours

**Breakdown**:
- Database migration: 30 min
- Type updates: 30 min
- Query function updates: 45 min
- UI component updates: 1 hour
- API route updates: 30 min
- Testing & validation: 45 min

## Related Work

- Follow-up: Consider data migration script to automatically move existing question-level explanations to correct answer options
- Future: Add support for doc_links per answer if needed
- Future: Consider explanation templates or AI assistance for generating per-answer explanations
