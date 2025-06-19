/**
 * @jest-environment jsdom
 */

import {
  migrateEarlyAccessMetadata,
  checkUserMetadata,
  validateMetadataConsistency,
} from '@/lib/auth/metadata-migration';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('Early Access Metadata Migration', () => {
  let mockSupabaseClient: jest.Mocked<SupabaseClient>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Supabase client
    mockSupabaseClient = {
      auth: {
        admin: {
          listUsers: jest.fn(),
          updateUserById: jest.fn(),
          getUserById: jest.fn(),
        },
      },
    } as any;
  });

  describe('migrateEarlyAccessMetadata', () => {
    test('should migrate users with old early_access key', async () => {
      const mockUsers = [
        {
          id: 'user_1',
          user_metadata: { early_access: true, other_field: 'value1' },
        },
        {
          id: 'user_2',
          user_metadata: { early_access: false, other_field: 'value2' },
        },
        {
          id: 'user_3',
          user_metadata: { is_early_access: true }, // Already migrated
        },
      ];

      (mockSupabaseClient.auth.admin.listUsers as jest.Mock).mockResolvedValue({
        data: { users: mockUsers },
        error: null,
      });

      (mockSupabaseClient.auth.admin.updateUserById as jest.Mock).mockResolvedValue({
        error: null,
      });

      const result = await migrateEarlyAccessMetadata(mockSupabaseClient, false);

      expect(result.success).toBe(true);
      expect(result.usersChecked).toBe(3);
      expect(result.usersMigrated).toBe(2);
      expect(result.errors).toHaveLength(0);

      // Verify updateUserById was called for the right users
      expect(mockSupabaseClient.auth.admin.updateUserById).toHaveBeenCalledTimes(2);
      
      expect(mockSupabaseClient.auth.admin.updateUserById).toHaveBeenCalledWith('user_1', {
        user_metadata: { is_early_access: true, other_field: 'value1' },
      });
      
      expect(mockSupabaseClient.auth.admin.updateUserById).toHaveBeenCalledWith('user_2', {
        user_metadata: { is_early_access: false, other_field: 'value2' },
      });
    });

    test('should add default is_early_access for users without any early access metadata', async () => {
      const mockUsers = [
        {
          id: 'user_1',
          user_metadata: { name: 'John Doe' }, // No early access metadata
        },
        {
          id: 'user_2',
          user_metadata: {}, // Empty metadata
        },
      ];

      (mockSupabaseClient.auth.admin.listUsers as jest.Mock).mockResolvedValue({
        data: { users: mockUsers },
        error: null,
      });

      (mockSupabaseClient.auth.admin.updateUserById as jest.Mock).mockResolvedValue({
        error: null,
      });

      const result = await migrateEarlyAccessMetadata(mockSupabaseClient, false);

      expect(result.success).toBe(true);
      expect(result.usersChecked).toBe(2);
      expect(result.usersMigrated).toBe(2);

      expect(mockSupabaseClient.auth.admin.updateUserById).toHaveBeenCalledWith('user_1', {
        user_metadata: { name: 'John Doe', is_early_access: false },
      });
      
      expect(mockSupabaseClient.auth.admin.updateUserById).toHaveBeenCalledWith('user_2', {
        user_metadata: { is_early_access: false },
      });
    });

    test('should handle dry run mode without making changes', async () => {
      const mockUsers = [
        {
          id: 'user_1',
          user_metadata: { early_access: true },
        },
      ];

      (mockSupabaseClient.auth.admin.listUsers as jest.Mock).mockResolvedValue({
        data: { users: mockUsers },
        error: null,
      });

      const result = await migrateEarlyAccessMetadata(mockSupabaseClient, true);

      expect(result.success).toBe(true);
      expect(result.usersChecked).toBe(1);
      expect(result.usersMigrated).toBe(1);
      
      // Should not have called updateUserById in dry run mode
      expect(mockSupabaseClient.auth.admin.updateUserById).not.toHaveBeenCalled();
    });

    test('should handle users with null/undefined metadata', async () => {
      const mockUsers = [
        {
          id: 'user_1',
          user_metadata: null,
        },
        {
          id: 'user_2',
          // No user_metadata property
        },
      ];

      (mockSupabaseClient.auth.admin.listUsers as jest.Mock).mockResolvedValue({
        data: { users: mockUsers },
        error: null,
      });

      (mockSupabaseClient.auth.admin.updateUserById as jest.Mock).mockResolvedValue({
        error: null,
      });

      const result = await migrateEarlyAccessMetadata(mockSupabaseClient, false);

      expect(result.success).toBe(true);
      expect(result.usersChecked).toBe(2);
      expect(result.usersMigrated).toBe(2);

      expect(mockSupabaseClient.auth.admin.updateUserById).toHaveBeenCalledWith('user_1', {
        user_metadata: { is_early_access: false },
      });
      
      expect(mockSupabaseClient.auth.admin.updateUserById).toHaveBeenCalledWith('user_2', {
        user_metadata: { is_early_access: false },
      });
    });

    test('should handle errors during user update', async () => {
      const mockUsers = [
        {
          id: 'user_1',
          user_metadata: { early_access: true },
        },
        {
          id: 'user_2',
          user_metadata: { early_access: false },
        },
      ];

      (mockSupabaseClient.auth.admin.listUsers as jest.Mock).mockResolvedValue({
        data: { users: mockUsers },
        error: null,
      });

      // Mock first update to fail, second to succeed
      (mockSupabaseClient.auth.admin.updateUserById as jest.Mock)
        .mockResolvedValueOnce({
          error: { message: 'Update failed for user_1' },
        })
        .mockResolvedValueOnce({
          error: null,
        });

      const result = await migrateEarlyAccessMetadata(mockSupabaseClient, false);

      expect(result.success).toBe(false);
      expect(result.usersChecked).toBe(2);
      expect(result.usersMigrated).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to update user user_1');
    });

    test('should handle listUsers error', async () => {
      (mockSupabaseClient.auth.admin.listUsers as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      });

      const result = await migrateEarlyAccessMetadata(mockSupabaseClient, false);

      expect(result.success).toBe(false);
      expect(result.usersChecked).toBe(0);
      expect(result.usersMigrated).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to list users');
    });

    test('should skip users that already have correct metadata', async () => {
      const mockUsers = [
        {
          id: 'user_1',
          user_metadata: { is_early_access: true }, // Already correct
        },
        {
          id: 'user_2',
          user_metadata: { is_early_access: false }, // Already correct
        },
      ];

      (mockSupabaseClient.auth.admin.listUsers as jest.Mock).mockResolvedValue({
        data: { users: mockUsers },
        error: null,
      });

      const result = await migrateEarlyAccessMetadata(mockSupabaseClient, false);

      expect(result.success).toBe(true);
      expect(result.usersChecked).toBe(2);
      expect(result.usersMigrated).toBe(0);
      
      // Should not have called updateUserById
      expect(mockSupabaseClient.auth.admin.updateUserById).not.toHaveBeenCalled();
    });
  });

  describe('checkUserMetadata', () => {
    test('should correctly identify user metadata format', async () => {
      const mockUser = {
        id: 'user_1',
        user_metadata: { early_access: true, other_field: 'value' },
      };

      (mockSupabaseClient.auth.admin.getUserById as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const result = await checkUserMetadata(mockSupabaseClient, 'user_1');

      expect(result).toEqual({
        userId: 'user_1',
        hasOldKey: true,
        hasNewKey: false,
        earlyAccessValue: true,
        metadata: { early_access: true, other_field: 'value' },
      });
    });

    test('should handle user with new key format', async () => {
      const mockUser = {
        id: 'user_2',
        user_metadata: { is_early_access: false },
      };

      (mockSupabaseClient.auth.admin.getUserById as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const result = await checkUserMetadata(mockSupabaseClient, 'user_2');

      expect(result).toEqual({
        userId: 'user_2',
        hasOldKey: false,
        hasNewKey: true,
        earlyAccessValue: false,
        metadata: { is_early_access: false },
      });
    });

    test('should handle getUserById error', async () => {
      (mockSupabaseClient.auth.admin.getUserById as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'User not found' },
      });

      await expect(checkUserMetadata(mockSupabaseClient, 'nonexistent')).rejects.toThrow(
        'Failed to get user nonexistent: User not found'
      );
    });
  });

  describe('validateMetadataConsistency', () => {
    test('should validate consistent metadata', async () => {
      const mockUsers = [
        {
          id: 'user_1',
          user_metadata: { is_early_access: true },
        },
        {
          id: 'user_2',
          user_metadata: { is_early_access: false },
        },
      ];

      (mockSupabaseClient.auth.admin.listUsers as jest.Mock).mockResolvedValue({
        data: { users: mockUsers },
        error: null,
      });

      const result = await validateMetadataConsistency(mockSupabaseClient);

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    test('should identify inconsistent metadata', async () => {
      const mockUsers = [
        {
          id: 'user_1',
          user_metadata: { early_access: true }, // Old key
        },
        {
          id: 'user_2',
          user_metadata: { name: 'John' }, // Missing key
        },
        {
          id: 'user_3',
          user_metadata: { is_early_access: 'yes' }, // Wrong type
        },
      ];

      (mockSupabaseClient.auth.admin.listUsers as jest.Mock).mockResolvedValue({
        data: { users: mockUsers },
        error: null,
      });

      const result = await validateMetadataConsistency(mockSupabaseClient);

      expect(result.valid).toBe(false);
      expect(result.issues).toHaveLength(4);
      expect(result.issues).toContain("User user_1 still has old 'early_access' key");
      expect(result.issues).toContain("User user_1 missing 'is_early_access' key");
      expect(result.issues).toContain("User user_2 missing 'is_early_access' key");
      expect(result.issues).toContain("User user_3 has invalid 'is_early_access' value: yes");
    });

    test('should handle listUsers error in validation', async () => {
      (mockSupabaseClient.auth.admin.listUsers as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const result = await validateMetadataConsistency(mockSupabaseClient);

      expect(result.valid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toContain('Failed to list users');
    });
  });
});