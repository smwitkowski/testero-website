import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/auth/rate-limiter";

// Zod schema for variant assignment request
const VariantAssignmentSchema = z.object({
  userId: z.string().uuid("Invalid user ID format").optional(),
  forceVariant: z.enum(["A", "B"]).optional(), // For testing purposes
});

interface VariantAssignmentResponse {
  variant: "A" | "B";
  assigned: boolean; // Whether this was a new assignment or existing
}

/**
 * Assigns A/B test variant to authenticated users in a secure, server-side manner
 * Uses deterministic hashing based on user ID to ensure consistency
 */
export async function POST(req: Request) {
  const supabase = createServerSupabaseClient();

  try {
    // Extract IP address for rate limiting
    const ip = req.headers.get("x-forwarded-for") || 
               req.headers.get("x-real-ip") || 
               "unknown";

    // Check rate limit
    if (!(await checkRateLimit(ip))) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch {
      requestBody = {}; // Default to empty object for GET-like behavior
    }

    // Validate input
    const validationResult = VariantAssignmentSchema.safeParse(requestBody);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      
      return NextResponse.json(
        { error: `Invalid request data: ${errors}` },
        { status: 400 }
      );
    }

    const { forceVariant } = validationResult.data;

    // Check if user already has a variant assigned in their metadata
    let existingVariant = user.user_metadata?.beta_variant as "A" | "B" | undefined;

    // If forcing a variant (for testing), override existing
    if (forceVariant && (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test')) {
      existingVariant = forceVariant;
    }

    // If user already has a variant, return it
    if (existingVariant === "A" || existingVariant === "B") {
      return NextResponse.json({
        variant: existingVariant,
        assigned: false
      } as VariantAssignmentResponse);
    }

    // Assign variant based on deterministic hash of user ID
    // This ensures consistent assignment across sessions
    const variant = assignVariantFromUserId(user.id);

    // Update user metadata with assigned variant
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          ...user.user_metadata,
          beta_variant: variant
        }
      });

      if (updateError) {
        console.error("Error updating user metadata with variant:", updateError);
        // Don't fail the request if metadata update fails
        // Return the assigned variant anyway
      }
    } catch (metadataError) {
      console.error("Error updating user metadata:", metadataError);
      // Continue without failing
    }

    return NextResponse.json({
      variant,
      assigned: true
    } as VariantAssignmentResponse);

  } catch (error) {
    console.error("Error in variant assignment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Simple deterministic hash function to assign variants based on user ID
 * Ensures 50/50 split and consistency across sessions
 */
function assignVariantFromUserId(userId: string): "A" | "B" {
  // Simple hash function - convert user ID to number and use modulo
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Use absolute value and modulo to get 0 or 1, then map to A or B
  return Math.abs(hash) % 2 === 0 ? "A" : "B";
}

/**
 * GET endpoint for retrieving current variant assignment
 */
export async function GET(req: Request) {
  const supabase = createServerSupabaseClient();

  try {
    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const existingVariant = user.user_metadata?.beta_variant as "A" | "B" | undefined;

    if (existingVariant === "A" || existingVariant === "B") {
      return NextResponse.json({
        variant: existingVariant,
        assigned: false
      } as VariantAssignmentResponse);
    }

    // If no variant assigned, trigger assignment
    return POST(req);

  } catch (error) {
    console.error("Error retrieving variant:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}