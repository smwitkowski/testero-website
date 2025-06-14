// scripts/generate_content_from_brief.ts
import fs from 'fs/promises'; // Use promises for async/await
import path from 'path';
import { generateObject } from 'ai'; // Changed from generateText
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import dotenv from 'dotenv';
import { z } from 'zod'; // Import Zod

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') }); // Corrected path to root .env relative to scripts/

async function processSingleBrief(formattedBriefPath: string, outputDirForThisRun: string) {
  console.log(`\nProcessing brief: ${formattedBriefPath}`);
  try {
    // 2. File Reading
    const formattedBriefContent = await fs.readFile(formattedBriefPath, 'utf-8');

    // 3. LLM Configuration & Interaction (API key check is done once in main)
    const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY! });
    const model = openrouter.chat('anthropic/claude-sonnet-4');
    const articleSchema = z.object({
      title: z.string().describe("The SEO-optimized title of the article that demands clicks."),
      metaDescription: z.string().describe("A compelling meta description, around 150 characters."),
      authorName: z.string().optional().describe("Author's name. Defaults to 'Testero Team' if not provided."),
      datePublished: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Publication date in YYYY-MM-DD format."),
      featuredImageUrl: z.string().url().optional().describe("URL of the featured image for the article."),
      keywords: z.array(z.string()).optional().describe("List of relevant keywords/tags for the article."),
      introduction: z.string().describe("The introduction section of the article (Markdown content)."),
      mainContent: z.string().describe("The main body of the article (Markdown content)."),
      competitiveAdvantages: z.array(z.string()).min(3).optional().describe("List of at least 3 unique insights."),
      conclusion: z.string().describe("The conclusion section of the article (Markdown content)."),
    });
    const systemPrompt = `You are an expert content strategist specializing in technical and professional development content. Your task is to generate a comprehensive, high-quality article based on the provided content brief.

    CONTENT QUALITY STANDARDS:
    1. **Writing Style**: 
      - Use clear, professional language accessible to your target audience
      - Balance technical accuracy with readability
      - Vary sentence structure and paragraph length for engagement
      - Write in active voice when possible

    2. **SEO Optimization**:
      - Title should be 50-60 characters, compelling and keyword-rich
      - Meta description must be 150-160 characters, include primary keyword, and encourage clicks
      - Keywords should reflect actual search intent and include long-tail variations
      - Use keywords naturally throughout content (1-2% density)

    3. **Content Structure**:
      - Introduction: Hook readers within first 2 sentences, clearly state value proposition
      - MainContent: Use proper heading hierarchy (H2, H3), include bullet points and numbered lists for scannability
      - Each section should be 200-400 words for optimal readability
      - Total article length: 1,500-3,000 words unless brief specifies otherwise

    4. **Field-Specific Guidelines**:
      - **competitiveAdvantages**: Provide genuinely unique insights not commonly found elsewhere
      - **introduction**: 150-250 words that preview the article's value
      - **mainContent**: Organize with clear sections, subheadings every 300-500 words
      - **conclusion**: 200-300 words with clear call-to-action and key takeaways

    5. **Coherence Requirements**:
      - Ensure all fields work together as a cohesive piece
      - Keywords should appear naturally in title, meta description, and throughout content
      - Competitive advantages should be woven into the main content, not feel disconnected

    6. **Audience Considerations**:
      - Identify and write for the specific audience mentioned in the brief
      - Adjust technical depth based on audience expertise level
      - Include practical examples relevant to the audience's context

    7. **Originality and Value**:
      - Generate unique perspectives, not generic advice
      - Include specific, actionable steps readers can implement
      - Support claims with logical reasoning or industry best practices
      - Add depth through nuanced analysis, not just surface-level information

    8. **Markdown Formatting**:
      - Use ## for main sections, ### for subsections
      - Bold key terms and important takeaways
      - Use > for important quotes or callouts
      - Include - or * for unordered lists, 1. 2. 3. for ordered lists
      - Add line breaks between sections for readability

    OUTPUT REQUIREMENTS:
    - Generate a complete JSON object adhering to the provided Zod schema
    - Do not include any XML tags or schema definitions in your response
    - Ensure all required fields are populated with appropriate content
    - The 'mainContent' field should contain ALL body sections as a single Markdown string

    Remember: The goal is to create content that ranks well in search engines while providing genuine value to human readers. Prioritize helpfulness and accuracy over keyword stuffing or clickbait tactics.`;

    console.log(`Sending formatted brief to OpenRouter model: ${model.modelId} for structured object generation...`);
    const { object: generatedArticle } = await generateObject({
      model,
      schema: articleSchema,
      prompt: formattedBriefContent,
      system: systemPrompt,
    });
    console.log('Structured LLM response received.');
    console.log('\n--- Raw Structured LLM Response (generatedArticle object) ---');
    console.log(JSON.stringify(generatedArticle, null, 2));
    console.log('--- End Raw Structured LLM Response ---\n');

    const frontmatter: Record<string, any> = {
      title: generatedArticle.title,
      description: generatedArticle.metaDescription,
      author: generatedArticle.authorName || 'Testero Team',
      date: generatedArticle.datePublished,
      coverImage: generatedArticle.featuredImageUrl || '',
      tags: generatedArticle.keywords || ['Generated Content', 'AI'],
    };
    const body = [
      generatedArticle.introduction,
      generatedArticle.mainContent,
      generatedArticle.conclusion
    ].filter(Boolean).join('\n\n').trim();

    console.log('\n--- Constructed Frontmatter ---');
    console.log(JSON.stringify(frontmatter, null, 2));
    console.log('--- End Constructed Frontmatter ---\n');
    console.log('\n--- Constructed Body (First 500 chars) ---');
    console.log(body.substring(0, 500) + (body.length > 500 ? '...' : ''));
    console.log('--- End Constructed Body ---\n');

    const finalMarkdown = matter.stringify(body, frontmatter);
    let fileName = `generated-content-${Date.now()}.md`;
    if (frontmatter.title) {
      fileName = frontmatter.title.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '.md';
      if (!fileName.endsWith('.md') || fileName === ".md" || fileName.length < 4) {
        fileName = `generated-content-${Date.now()}.md`;
      }
    }
    const outputFilePath = path.join(outputDirForThisRun, fileName);
    await fs.writeFile(outputFilePath, finalMarkdown);
    console.log(`Successfully generated content and saved to: ${outputFilePath}`);

  } catch (error) {
    console.error(`Error processing brief ${formattedBriefPath}:`, error);
    // Continue to next file in case of error
  }
}

async function main() {
  // 1. Argument Parsing
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: ts-node scripts/generate_content_from_brief.ts <formatted-briefs-input-dir> [base-output-dir]');
    process.exit(1);
  }
  const inputDir = args[0];
  const baseOutputDir = args[1] || path.join(__dirname, '../app/content/generated');

  if (!process.env.OPENROUTER_API_KEY) {
    console.error('OPENROUTER_API_KEY is not set in the environment variables.');
    process.exit(1);
  }

  // Create a datetime-stamped subfolder for this run
  const now = new Date();
  const timestamp = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
  const outputDirForThisRun = path.join(baseOutputDir, timestamp);
  
  try {
    await fs.mkdir(outputDirForThisRun, { recursive: true });
    console.log(`Outputting to directory: ${outputDirForThisRun}`);

    const files = await fs.readdir(inputDir);
    const briefFiles = files.filter(file => file.endsWith('.md'));

    if (briefFiles.length === 0) {
      console.log(`No .md files found in input directory: ${inputDir}`);
      return;
    }

    console.log(`Found ${briefFiles.length} brief(s) to process.`);

    for (const briefFile of briefFiles) {
      const formattedBriefPath = path.join(inputDir, briefFile);
      await processSingleBrief(formattedBriefPath, outputDirForThisRun);
    }

    console.log('\nAll briefs processed.');

  } catch (error) {
    console.error('Error in main processing loop:', error);
    process.exit(1);
  }
}

// The parseLlmResponse function is no longer needed as the output is already structured.
// The extractContent function is also no longer needed.

// Need to import gray-matter
import matter from 'gray-matter';

main(); // Call the main function
