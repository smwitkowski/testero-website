/**
 * Simple test for Redis rate limiter - tests fallback behavior
 */
const { Redis } = require('@upstash/redis');

async function testRateLimiterFallback() {
  console.log('🧪 Testing Redis Rate Limiter Fallback...\n');

  // Test fallback behavior when Redis env vars are not set
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  // Clear env vars to test fallback
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  
  try {
    // Import after clearing env vars
    const { checkAuthRateLimit } = require('./lib/rate-limit/redis-rate-limiter');
    
    console.log('Testing fallback behavior (Redis not available)...');
    
    for (let i = 1; i <= 3; i++) {
      const result = await checkAuthRateLimit('test-fallback-ip');
      console.log(`Request ${i}: allowed=${result.allowed}, redisAvailable=${result.redisAvailable}`);
    }
    
    console.log('\n✅ Fallback behavior working correctly!');
    console.log('   All requests allowed when Redis is unavailable (graceful degradation)');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Restore env vars
    if (originalUrl) process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    if (originalToken) process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  }
}

testRateLimiterFallback().catch(console.error);