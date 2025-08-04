#!/usr/bin/env ts-node
/**
 * Test script for Redis rate limiter
 * This script can be run to verify the Redis rate limiter is working correctly
 * 
 * Usage: npx ts-node lib/rate-limit/test-redis-rate-limiter.ts
 */

import { RedisRateLimiter, checkAuthRateLimit } from './redis-rate-limiter';

async function testRedisRateLimiter() {
  console.log('🧪 Testing Redis Rate Limiter...\n');

  // Test with the shared auth rate limiter
  const testIP = 'test-ip-' + Math.random().toString(36).substring(7);
  
  console.log(`Testing with IP: ${testIP}`);
  console.log('Max requests: 3, Window: 60 seconds\n');

  try {
    // Test sequential requests
    for (let i = 1; i <= 5; i++) {
      const result = await checkAuthRateLimit(testIP);
      
      console.log(`Request ${i}:`);
      console.log(`  Allowed: ${result.allowed}`);
      console.log(`  Count: ${result.count}`);
      console.log(`  Remaining: ${result.remaining}`);
      console.log(`  Redis Available: ${result.redisAvailable}`);
      console.log(`  Reset Time: ${new Date(result.resetTime).toISOString()}`);
      console.log('');
      
      if (!result.allowed) {
        console.log('✅ Rate limiting working correctly - request blocked after limit exceeded');
        break;
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Test Redis availability
    const customLimiter = new RedisRateLimiter({
      maxRequests: 5,
      windowMs: 30 * 1000,
      keyPrefix: 'test'
    });

    const isAvailable = await customLimiter.isRedisAvailable();
    console.log(`\n🔍 Redis Health Check: ${isAvailable ? '✅ Available' : '❌ Not Available'}`);

    if (!isAvailable) {
      console.log('⚠️  Redis not available - rate limiting will use fallback mode');
      console.log('   Make sure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }

  console.log('\n✅ Rate limiter test completed successfully!');
}

// Run the test if this file is executed directly
if (require.main === module) {
  testRedisRateLimiter().catch(console.error);
}

export { testRedisRateLimiter };