#!/usr/bin/env tsx
/**
 * Helper script to run other scripts with .env.local loaded
 */
import { config } from 'dotenv';
import { execSync } from 'child_process';

// Load .env.local
config({ path: '.env.local' });

// Get the script to run from command line args
const script = process.argv[2];
if (!script) {
  console.error('Usage: npx tsx scripts/run-with-env.ts <script-path> [args...]');
  process.exit(1);
}

// Run the script with all env vars passed through
const args = process.argv.slice(3);
const command = `npx tsx ${script} ${args.join(' ')}`;

try {
  execSync(command, {
    stdio: 'inherit',
    env: process.env,
  });
} catch (error) {
  process.exit(1);
}





