import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

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

    // Simulate storing the data (replace with DB logic as needed)
    console.log("Waitlist submission:", result.data);

    return NextResponse.json({ success: true });
  } catch (error: Error | unknown) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to process submission" },
      { status: 500 }
    );
  }
}
