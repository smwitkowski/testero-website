import { NextRequest } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSuccessResponse, createErrorResponse, commonErrors } from "@/lib/api/response-utils";

// Define the schema for validation
const formSchema = z.object({
  email: z
    .string()
    .min(1, { message: "Email is required" })
    .email({ message: "Must be a valid email address" }),
  examType: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch {
    return commonErrors.invalidJson();
  }

  try {
    const result = formSchema.safeParse(body);

    if (!result.success) {
      return createErrorResponse(result.error.errors[0]?.message || "Invalid input");
    }

    const { email, examType } = result.data;

    // Insert data into Supabase
    const supabase = createServerSupabaseClient();
    const { data, error: dbError } = await supabase
      .from("waitlist")
      .insert([{ email: email, exam_type: examType }]) // Map examType to exam_type
      .select();

    if (dbError) {
      console.error("Supabase error:", dbError);
      // Handle potential unique constraint violation (email already exists)
      if (dbError.code === "23505") {
        return createErrorResponse("This email is already on the waitlist.", 409);
      }
      return createErrorResponse("Failed to save submission to database", 500);
    }

    console.log("Waitlist submission saved:", data);

    // --- Loops Integration Start ---
    const loopsApiKey = process.env.LOOPS_API_KEY;
    if (!loopsApiKey) {
      console.error("Loops API Key not configured. Skipping Loops integration.");
      // Decide if this should be a hard error or just a log
      // For now, log and continue, as waitlist signup succeeded.
    } else {
      try {
        const loopsResponse = await fetch('https://app.loops.so/api/v1/contacts/create', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${loopsApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email,
            // Assuming Loops uses userGroup or similar for segmentation
            // Adjust based on actual Loops setup if different
            ...(examType && { examType: examType }), // Pass examType if provided
            // Add any other relevant properties or transactional IDs here
            // e.g., source: 'Waitlist Signup'
            userGroup: 'Waitlist', // Example group
          }),
        });

        if (!loopsResponse.ok) {
          const errorBody = await loopsResponse.text();
          console.error(`Loops API Error (${loopsResponse.status}): ${errorBody}`);
          // Log the error but don't fail the overall request
        } else {
          const loopsData = await loopsResponse.json();
          console.log("Loops contact created/updated successfully:", loopsData);
        }
      } catch (loopsError: Error | unknown) {
        const errorMessage = loopsError instanceof Error ? loopsError.message : "An unknown error occurred during Loops API call";
        console.error("Failed to send data to Loops:", errorMessage);
        // Log the error but don't fail the overall request
      }
    }
    // --- Loops Integration End ---

    return createSuccessResponse();

  } catch (error: Error | unknown) {
    console.error("API route error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return createErrorResponse(`Failed to process submission: ${errorMessage}`, 500);
  }
}
