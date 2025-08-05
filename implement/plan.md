# Implementation Plan - TES-317: Replace in-memory rate limiting with Redis

**Started:** 2025-08-05

## Source Analysis

- **Source Type**: Linear Issue - Critical Production Blocker
- **Core Problem**: In-memory `Map<string, number[]>` rate limiting fails with multiple serverless instances
- **Security Impact**: P0 Critical - DDoS vulnerability and rate limiting bypass
- **Affected Files**: 3 auth endpoints using identical flawed pattern

## Current Implementation Analysis

All three endpoints use identical in-memory rate limiting:

```typescript
const rateLimitMap = new Map<string, number[]>(); // Critical flaw
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 3; // 3 requests per window
```

**Files Affected:**

- `app/api/auth/signup/route.ts:11` - In-memory Map
- `app/api/auth/password-reset/route.ts:8` - In-memory Map
- `app/api/auth/resend-confirmation/route.ts:7` - In-memory Map

## Target Integration

- **Solution**: Replace with Upstash Redis KV (serverless-compatible)
- **Pattern**: Create shared rate limiting utility
- **Integration Points**: All 3 auth endpoints
- **Dependencies**: Add Upstash Redis SDK

## Implementation Tasks

### Phase 1: Infrastructure Setup

- [x] Analyze current rate limiting implementation
- [ ] Add Upstash Redis dependency (`@upstash/redis`)
- [ ] Create shared rate limiting utility (`lib/auth/rate-limiter.ts`)
- [ ] Add environment variables for Redis configuration

### Phase 2: Core Implementation

- [ ] Implement Redis-based rate limiting logic
- [ ] Add proper error handling for Redis failures (fallback strategy)
- [ ] Maintain existing rate limit windows (1 minute, 3 requests)
- [ ] Test Redis connectivity

### Phase 3: Endpoint Migration

- [ ] Update signup endpoint to use Redis rate limiter
- [ ] Update password-reset endpoint to use Redis rate limiter
- [ ] Update resend-confirmation endpoint to use Redis rate limiter
- [ ] Remove old in-memory rate limiting code

### Phase 4: Testing & Validation

- [ ] Write unit tests for Redis rate limiter
- [ ] Test with multiple concurrent requests
- [ ] Test Redis failure scenarios
- [ ] Verify existing analytics still work
- [ ] Run full auth endpoint test suite

### Phase 5: Production Readiness

- [ ] Add Redis configuration documentation
- [ ] Update deployment environment variables
- [ ] Performance testing with Redis latency
- [ ] Security review of Redis implementation

## Risk Mitigation

- **Redis Unavailability**: Implement graceful fallback (allow requests vs block all)
- **Latency Concerns**: Use Redis pipeline for multiple operations
- **Connection Issues**: Implement connection retry logic
- **Backward Compatibility**: Maintain exact same rate limiting behavior

## Environment Variables Required

```
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
```

## Success Criteria

- [ ] All 3 auth endpoints use Redis rate limiting
- [ ] Maintains 1 minute window, 3 requests per IP
- [ ] Handles Redis failures gracefully
- [ ] No breaking changes to API behavior
- [ ] Production deployment ready
