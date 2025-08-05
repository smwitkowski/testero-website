# Implementation Plan - TES-318: Replace Blocking File Operations with Async

**Created**: 2025-08-05
**Linear Issue**: TES-318
**Branch**: TES-318-async-content-loader

## Source Analysis

- **Source Type**: Linear Issue (Performance Improvement)
- **Core Features**: Replace synchronous file operations with async alternatives
- **Dependencies**: fs/promises (built-in), React cache
- **Complexity**: Medium (3 story points)

## Target Integration

- **Integration Points**:
  - `lib/content/loader.ts` - Main content loader module
  - All content pages that consume the loader
- **Affected Files**:
  - `lib/content/loader.ts` (primary changes)
  - `lib/content/cache.ts` (new file)
  - Test files (new)
- **Pattern Matching**:
  - Use existing async function signatures
  - Maintain React cache() wrapper pattern
  - Follow existing error handling conventions

## Implementation Tasks

- [x] Create feature branch TES-318-async-content-loader
- [x] Write performance test suite (TDD - Red phase)
- [x] Write async operations tests (TDD - Red phase)
- [x] Write integration tests (TDD - Red phase)
- [ ] Commit failing tests
- [ ] Replace fs.readFileSync with fs.promises.readFile
- [ ] Replace fs.existsSync and fs.readdirSync with async alternatives
- [ ] Update error handling for async operations
- [ ] Create content cache utility with TTL support
- [ ] Integrate caching into content loader functions
- [ ] Add parallel file reading optimizations
- [ ] Run full test suite and verify
- [ ] Document performance improvements

## Validation Checklist

- [ ] All sync file operations replaced with async
- [ ] Performance tests passing (sub-100ms response times)
- [ ] Cache hit rate >80% on repeated reads
- [ ] No event loop blocking detected
- [ ] All existing functionality preserved
- [ ] TypeScript compilation successful
- [ ] ESLint checks passing
- [ ] Full test suite passing

## Risk Mitigation

- **Potential Issues**:
  - Breaking changes to consumer components (mitigated by existing async signatures)
  - Cache invalidation complexity (use file mtime for invalidation)
  - Memory leaks from cache growth (implement TTL and size limits)
- **Rollback Strategy**:
  - Each commit is atomic and testable
  - Feature branch allows safe experimentation
  - Can revert to main branch if needed

## Performance Targets

- Response time < 100ms for single file reads
- < 500ms for reading 50 files
- 50%+ improvement on cached reads
- Linear scaling with content volume
- Memory usage < 50MB increase under load

## Progress Tracking

Using TodoWrite tool to track each phase systematically through TDD cycle.
