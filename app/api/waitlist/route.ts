import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase/client"; // Import Supabase client

// Define the schema for validation
const formSchema = z.object({
  email: z
    .string()
    .min(1, { message: "Email is required" })
    .email({ message: "Must be a valid email address" }),
  examType: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = formSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { email, examType } = result.data;

    // Insert data into Supabase
    const { error: dbError } = await supabase
      .from("waitlist")
      .insert([{ email: email, exam_type: examType }]); // Map examType to exam_type

    if (dbError) {
      console.error("Supabase error:", dbError);
      // Handle potential unique constraint violation (email already exists)
      if (dbError.code === "23505") {
        return NextResponse.json(
          { error: "This email is already on the waitlist." },
          { status: 409 } // Conflict
        );
      }
      return NextResponse.json(
        { error: "Failed to save submission to database" },
        { status: 500 }
      );
    }

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
        }
      } catch (loopsError: Error | unknown) {
        const errorMessage = loopsError instanceof Error ? loopsError.message : "An unknown error occurred during Loops API call";
        console.error("Failed to send data to Loops:", errorMessage);
        // Log the error but don't fail the overall request
      }
    }
    // --- Loops Integration End ---

    return NextResponse.json({ success: true });

  } catch (error: Error | unknown) {
    console.error("API route error:", error);
    // Check if error is an instance of Error to access message property safely
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { error: `Failed to process submission: ${errorMessage}` },
      { status: 500 }
    );
  }
}
