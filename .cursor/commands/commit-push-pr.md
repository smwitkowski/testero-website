# Commit, Push, and Create PR

Follow these steps to commit staged changes, push to a new branch, and open a pull request:

## Pre-commit Checks
1. Run `git status` and `git diff` in parallel to review all staged changes
2. Run `git log --oneline -10` to see recent commit style
3. Verify linting passes: `npm run lint && npx tsc --noEmit`
4. Run relevant tests if changes affect critical functionality

## Branch & Commit
1. Check out a new branch following naming convention:
```bash
git checkout -b TES-XXX-brief-description
```
   - Format: `TES-XXX-brief-description` (if Linear issue exists)
   - OR: `feature/descriptive-name` or `fix/descriptive-name`
   
2. Create commit message following this format:
   ```
   TES-XXX: Brief description of change
   
   • Specific implementation details with bullet points
   • Technical considerations and trade-offs made
   • Testing approach and coverage added
   • Security implications addressed (if applicable)
   ```

3. Commit using HEREDOC for proper formatting:
   ```bash
   git commit -m "$(cat <<'EOF'
   [Your commit message here]
   EOF
   )"
   ```

## Push & PR
1. Push to remote with upstream tracking: `git push -u origin [branch-name]`

2. Create PR with structured body:
   ```bash
   gh pr create --title "[Descriptive PR title]" --body "$(cat <<'EOF'
   ## Summary
   • [What was implemented and why]
   • [Key changes made]
   
   ## Technical Details
   • [Architecture decisions and patterns used]
   • [Dependencies or breaking changes]
   
   ## Test Coverage
   • [Unit tests added/modified]
   • [E2E tests verification]
   
   ## Security Review
   • [Rate limiting considerations]
   • [Error handling approach]
   • [Input validation]
   
   ## Performance Impact
   • [Any scale/speed considerations]
   
   EOF
   )"
   ```

## Quality Checklist
- [ ] Atomic commit (complete, logical change)
- [ ] Descriptive branch name
- [ ] Comprehensive commit message
- [ ] PR includes all required sections
- [ ] Linting and TypeScript checks pass
- [ ] Relevant tests run successfully

## Notes
- Use parallel git commands for efficiency
- Don't push to remote unless explicitly ready to open PR
- Ensure commit messages focus on "why" rather than just "what"
- Never use interactive git flags (-i) in automated workflows
