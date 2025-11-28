/**
 * Admin authentication helper
 * 
 * Checks if a user is an admin by comparing their user ID or email
 * against environment variables ADMIN_USER_IDS and ADMIN_EMAILS.
 * 
 * Environment variables:
 * - ADMIN_USER_IDS: Comma-separated list of Supabase auth.users.id values
 * - ADMIN_EMAILS: Comma-separated list of email addresses (fallback)
 */

/**
 * Get admin user IDs from ADMIN_USER_IDS environment variable
 * @returns Array of admin user IDs (trimmed, empty array if not set)
 */
export function getAdminUserIds(): string[] {
  const adminUserIds = process.env.ADMIN_USER_IDS;
  if (!adminUserIds || adminUserIds.trim() === "") {
    return [];
  }
  return adminUserIds.split(",").map((id) => id.trim()).filter((id) => id.length > 0);
}

/**
 * Get admin emails from ADMIN_EMAILS environment variable
 * @returns Array of admin emails (trimmed, empty array if not set)
 */
export function getAdminEmails(): string[] {
  const adminEmails = process.env.ADMIN_EMAILS;
  if (!adminEmails || adminEmails.trim() === "") {
    return [];
  }
  return adminEmails.split(",").map((email) => email.trim()).filter((email) => email.length > 0);
}

/**
 * Check if a user is an admin
 * 
 * A user is considered an admin if:
 * - Their user ID matches any ID in ADMIN_USER_IDS, OR
 * - Their email matches any email in ADMIN_EMAILS
 * 
 * @param user - User object with id and optional email
 * @returns true if user is an admin, false otherwise
 */
export function isAdmin(user: { id: string; email?: string | null }): boolean {
  if (!user || !user.id) {
    return false;
  }

  const adminUserIds = getAdminUserIds();
  const adminEmails = getAdminEmails();

  // Check if user ID matches any admin ID
  if (adminUserIds.includes(user.id)) {
    return true;
  }

  // Check if user email matches any admin email
  if (user.email && adminEmails.includes(user.email)) {
    return true;
  }

  return false;
}

