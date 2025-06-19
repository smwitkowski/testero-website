/**
 * Early Access Metadata Migration Utilities
 * 
 * Utilities for migrating user metadata from inconsistent keys to the canonical
 * `is_early_access` format. This ensures all users have consistent metadata
 * structure across the application.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface MigrationResult {
  success: boolean;
  usersChecked: number;
  usersMigrated: number;
  errors: string[];
}

/**
 * Migrate user metadata from old key format to canonical format
 * 
 * Changes:
 * - `early_access` -> `is_early_access` 
 * - Ensures all users have the `is_early_access` field
 * - Preserves existing `is_early_access` values
 * - Defaults to `false` if no early access metadata exists
 * 
 * @param supabaseClient - Supabase admin client with user management permissions
 * @param dryRun - If true, only check what would be migrated without making changes
 * @returns Promise<MigrationResult>
 */
export async function migrateEarlyAccessMetadata(
  supabaseClient: SupabaseClient,
  dryRun: boolean = false
): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    usersChecked: 0,
    usersMigrated: 0,
    errors: [],
  };

  try {
    // Get all users from Supabase Auth
    const { data: usersResponse, error: listError } = await supabaseClient.auth.admin.listUsers();
    
    if (listError) {
      result.errors.push(`Failed to list users: ${listError.message}`);
      return result;
    }

    if (!usersResponse?.users) {
      result.errors.push('No users found in response');
      return result;
    }

    result.usersChecked = usersResponse.users.length;
    console.log(`[Metadata Migration] Checking ${result.usersChecked} users...`);

    for (const user of usersResponse.users) {
      try {
        const metadata = user.user_metadata || {};
        let needsMigration = false;
        const newMetadata = { ...metadata };

        // Check if user has old `early_access` key but no `is_early_access`
        if ('early_access' in metadata && !('is_early_access' in metadata)) {
          newMetadata.is_early_access = metadata.early_access;
          delete newMetadata.early_access; // Remove old key
          needsMigration = true;
          console.log(`[Metadata Migration] User ${user.id} has old early_access key, migrating...`);
        }
        // Check if user has neither key (new users with missing metadata)
        else if (!('is_early_access' in metadata)) {
          newMetadata.is_early_access = false; // Default to false
          needsMigration = true;
          console.log(`[Metadata Migration] User ${user.id} missing is_early_access, adding default...`);
        }

        if (needsMigration) {
          if (!dryRun) {
            // Update user metadata
            const { error: updateError } = await supabaseClient.auth.admin.updateUserById(
              user.id,
              { user_metadata: newMetadata }
            );

            if (updateError) {
              result.errors.push(`Failed to update user ${user.id}: ${updateError.message}`);
              continue;
            }

            console.log(`[Metadata Migration] Successfully updated user ${user.id}`);
          } else {
            console.log(`[Metadata Migration] Would update user ${user.id} (dry run)`);
          }
          
          result.usersMigrated++;
        }
      } catch (userError) {
        const errorMessage = userError instanceof Error ? userError.message : 'Unknown error';
        result.errors.push(`Error processing user ${user.id}: ${errorMessage}`);
      }
    }

    result.success = result.errors.length === 0;
    
    console.log(`[Metadata Migration] Complete. Checked: ${result.usersChecked}, Migrated: ${result.usersMigrated}, Errors: ${result.errors.length}`);
    
    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`Migration failed: ${errorMessage}`);
    console.error('[Metadata Migration] Fatal error:', error);
    return result;
  }
}

/**
 * Check a specific user's metadata format
 * @param supabaseClient - Supabase admin client
 * @param userId - User ID to check
 * @returns Promise<{ userId: string; hasOldKey: boolean; hasNewKey: boolean; earlyAccessValue: boolean | null }>
 */
export async function checkUserMetadata(
  supabaseClient: SupabaseClient,
  userId: string
): Promise<{
  userId: string;
  hasOldKey: boolean;
  hasNewKey: boolean;
  earlyAccessValue: boolean | null;
  metadata: Record<string, unknown>;
}> {
  const { data: user, error } = await supabaseClient.auth.admin.getUserById(userId);
  
  if (error || !user) {
    throw new Error(`Failed to get user ${userId}: ${error?.message || 'User not found'}`);
  }

  const metadata = user.user_metadata || {};
  
  return {
    userId,
    hasOldKey: 'early_access' in metadata,
    hasNewKey: 'is_early_access' in metadata,
    earlyAccessValue: metadata.is_early_access ?? metadata.early_access ?? null,
    metadata,
  };
}

/**
 * Validate that all users have consistent metadata after migration
 * @param supabaseClient - Supabase admin client
 * @returns Promise<{ valid: boolean; issues: string[] }>
 */
export async function validateMetadataConsistency(
  supabaseClient: SupabaseClient
): Promise<{ valid: boolean; issues: string[] }> {
  const issues: string[] = [];
  
  try {
    const { data: usersResponse, error } = await supabaseClient.auth.admin.listUsers();
    
    if (error || !usersResponse?.users) {
      issues.push(`Failed to list users: ${error?.message || 'No users found'}`);
      return { valid: false, issues };
    }

    for (const user of usersResponse.users) {
      const metadata = user.user_metadata || {};
      
      // Check for old key still present
      if ('early_access' in metadata) {
        issues.push(`User ${user.id} still has old 'early_access' key`);
      }
      
      // Check for missing new key
      if (!('is_early_access' in metadata)) {
        issues.push(`User ${user.id} missing 'is_early_access' key`);
      }
      
      // Check for invalid value type
      if ('is_early_access' in metadata && typeof metadata.is_early_access !== 'boolean') {
        issues.push(`User ${user.id} has invalid 'is_early_access' value: ${metadata.is_early_access}`);
      }
    }

    return { valid: issues.length === 0, issues };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    issues.push(`Validation failed: ${errorMessage}`);
    return { valid: false, issues };
  }
}