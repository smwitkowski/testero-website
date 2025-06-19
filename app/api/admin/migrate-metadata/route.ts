import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { migrateEarlyAccessMetadata, validateMetadataConsistency } from '@/lib/auth/metadata-migration';

/**
 * Admin API endpoint for migrating user metadata
 * 
 * This endpoint allows admins to migrate user metadata from the old `early_access` 
 * key format to the canonical `is_early_access` format.
 * 
 * Security: This should be protected by admin authentication in production
 */

interface MigrationRequestBody {
  action: 'migrate' | 'validate' | 'dry-run';
  adminKey?: string; // Simple admin key for protection
}

export async function POST(req: NextRequest) {
  try {
    const body: MigrationRequestBody = await req.json();
    const { action, adminKey } = body;

    // Simple admin key protection (in production, use proper admin auth)
    const expectedAdminKey = process.env.ADMIN_MIGRATION_KEY;
    if (expectedAdminKey && adminKey !== expectedAdminKey) {
      return NextResponse.json(
        { error: 'Unauthorized - invalid admin key' },
        { status: 401 }
      );
    }

    if (!['migrate', 'validate', 'dry-run'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be: migrate, validate, or dry-run' },
        { status: 400 }
      );
    }

    const supabaseClient = createServerSupabaseClient();

    switch (action) {
      case 'dry-run': {
        console.log('[Admin Migration] Starting dry run...');
        const result = await migrateEarlyAccessMetadata(supabaseClient, true);
        
        return NextResponse.json({
          action: 'dry-run',
          success: true,
          message: `Dry run complete. Would migrate ${result.usersMigrated} of ${result.usersChecked} users.`,
          result,
        });
      }

      case 'migrate': {
        console.log('[Admin Migration] Starting actual migration...');
        const result = await migrateEarlyAccessMetadata(supabaseClient, false);
        
        if (result.success) {
          return NextResponse.json({
            action: 'migrate',
            success: true,
            message: `Migration complete. Updated ${result.usersMigrated} of ${result.usersChecked} users.`,
            result,
          });
        } else {
          return NextResponse.json({
            action: 'migrate',
            success: false,
            message: `Migration completed with errors. Updated ${result.usersMigrated} users, but encountered ${result.errors.length} errors.`,
            result,
          }, { status: 207 }); // 207 Multi-Status for partial success
        }
      }

      case 'validate': {
        console.log('[Admin Migration] Validating metadata consistency...');
        const validation = await validateMetadataConsistency(supabaseClient);
        
        return NextResponse.json({
          action: 'validate',
          success: validation.valid,
          message: validation.valid 
            ? 'All user metadata is consistent.' 
            : `Found ${validation.issues.length} metadata issues.`,
          validation,
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('[Admin Migration] API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check migration status and get basic info
 */
export async function GET() {
  try {
    const supabaseClient = createServerSupabaseClient();
    
    // Get basic user count
    const { data: usersResponse, error } = await supabaseClient.auth.admin.listUsers();
    
    if (error) {
      return NextResponse.json(
        { error: 'Failed to get user information' },
        { status: 500 }
      );
    }

    const totalUsers = usersResponse?.users?.length || 0;
    
    // Quick validation check
    const validation = await validateMetadataConsistency(supabaseClient);
    
    return NextResponse.json({
      totalUsers,
      metadataConsistent: validation.valid,
      issues: validation.issues.length,
      availableActions: ['dry-run', 'migrate', 'validate'],
      instructions: {
        'dry-run': 'Check what would be migrated without making changes',
        'migrate': 'Actually perform the metadata migration',
        'validate': 'Check current metadata consistency',
      },
    });

  } catch (error) {
    console.error('[Admin Migration] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}