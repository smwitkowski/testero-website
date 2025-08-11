#!/usr/bin/env node

/**
 * Content validation CLI tool
 * 
 * This script validates all content files using the Zod schemas
 * and provides detailed reports on any validation issues.
 * 
 * Usage:
 *   npm run validate:content
 *   node scripts/validate-content.js
 *   node scripts/validate-content.js --type blog
 *   node scripts/validate-content.js --fix
 */

const fs = require('fs').promises;
const path = require('path');
const matter = require('gray-matter');

// Import validation utilities (using require since this is a Node.js script)
async function loadValidators() {
  try {
    // Try to load compiled TypeScript first
    const validators = await import('../lib/content/validators.js').catch(() => {
      // Fallback to ts-node compilation
      require('ts-node/register');
      return require('../lib/content/validators.ts');
    });
    return validators;
  } catch (error) {
    console.error('❌ Failed to load validators. Make sure the project is built or ts-node is available.');
    console.error(error.message);
    process.exit(1);
  }
}

// CLI argument parsing
const args = process.argv.slice(2);
const options = {
  type: args.includes('--type') ? args[args.indexOf('--type') + 1] : null,
  fix: args.includes('--fix'),
  verbose: args.includes('--verbose') || args.includes('-v'),
  help: args.includes('--help') || args.includes('-h'),
};

if (options.help) {
  console.log(`
Content Validation CLI

Usage:
  npm run validate:content              # Validate all content
  node scripts/validate-content.js      # Same as above
  node scripts/validate-content.js --type blog    # Validate only blog posts
  node scripts/validate-content.js --fix          # Attempt to fix common issues
  node scripts/validate-content.js --verbose      # Show detailed output
  node scripts/validate-content.js --help         # Show this help

Options:
  --type <type>    Only validate specific content type (blog, guide, hub, spoke, documentation, faq)
  --fix            Attempt to fix common validation issues
  --verbose, -v    Show detailed validation output
  --help, -h       Show this help message

Examples:
  node scripts/validate-content.js --type guide --fix
  npm run validate:content
  `);
  process.exit(0);
}

// Content directories configuration
const CONTENT_DIRS = {
  blog: path.join(process.cwd(), 'app/content/blog'),
  guide: path.join(process.cwd(), 'app/content/guides'),
  hub: path.join(process.cwd(), 'app/content/hub'),
  spoke: path.join(process.cwd(), 'app/content/spokes'),
  documentation: path.join(process.cwd(), 'app/content/docs'),
  faq: path.join(process.cwd(), 'app/content/faq'),
};

// Main validation function
async function validateContent() {
  console.log('🔍 Content Validation Tool');
  console.log('=' .repeat(50));
  
  const validators = await loadValidators();
  const { validateContentByType, generateErrorSummary } = validators;
  
  const results = {
    totalFiles: 0,
    validFiles: 0,
    invalidFiles: 0,
    errors: [],
    warnings: [],
  };

  // Determine which content types to validate
  const typesToValidate = options.type 
    ? [options.type]
    : Object.keys(CONTENT_DIRS);

  for (const contentType of typesToValidate) {
    const contentDir = CONTENT_DIRS[contentType];
    
    if (!contentDir) {
      console.error(`❌ Unknown content type: ${contentType}`);
      continue;
    }

    console.log(`\n📁 Validating ${contentType.toUpperCase()} content...`);
    
    try {
      // Check if directory exists
      await fs.access(contentDir);
    } catch {
      console.log(`⚠️  Directory ${contentDir} does not exist, skipping...`);
      continue;
    }

    try {
      const files = await fs.readdir(contentDir);
      const markdownFiles = files.filter(file => /\.mdx?$/i.test(file));
      
      if (markdownFiles.length === 0) {
        console.log(`ℹ️  No markdown files found in ${contentDir}`);
        continue;
      }

      console.log(`   Found ${markdownFiles.length} files to validate`);
      
      for (const file of markdownFiles) {
        const filePath = path.join(contentDir, file);
        results.totalFiles++;
        
        try {
          const fileContent = await fs.readFile(filePath, 'utf-8');
          const { data: frontmatter } = matter(fileContent);
          
          // Add missing fields that can be inferred
          if (!frontmatter.slug) {
            frontmatter.slug = file.replace(/\.mdx?$/i, '').toLowerCase().replace(/[^a-z0-9-]/g, '-');
          }
          
          if (!frontmatter.category) {
            frontmatter.category = contentType;
          }

          // Convert date strings to Date objects
          if (frontmatter.publishedAt && typeof frontmatter.publishedAt === 'string') {
            frontmatter.publishedAt = new Date(frontmatter.publishedAt);
          }
          if (frontmatter.updatedAt && typeof frontmatter.updatedAt === 'string') {
            frontmatter.updatedAt = new Date(frontmatter.updatedAt);
          }
          if (frontmatter.date && typeof frontmatter.date === 'string' && !frontmatter.publishedAt) {
            frontmatter.publishedAt = new Date(frontmatter.date);
          }

          // Validate content
          const validationResult = validateContentByType(frontmatter, contentType);
          
          if (validationResult.valid) {
            results.validFiles++;
            if (options.verbose) {
              console.log(`   ✅ ${file}`);
            }
          } else {
            results.invalidFiles++;
            const errorSummary = generateErrorSummary(validationResult.errors);
            
            results.errors.push({
              file: filePath,
              type: contentType,
              summary: errorSummary,
              errors: validationResult.errors,
            });
            
            console.log(`   ❌ ${file}`);
            if (options.verbose) {
              console.log(`      ${errorSummary.split('\n').join('\n      ')}`);
            }
          }
          
        } catch (fileError) {
          results.invalidFiles++;
          const errorMsg = `Failed to process file: ${fileError.message}`;
          
          results.errors.push({
            file: filePath,
            type: contentType,
            summary: errorMsg,
            errors: [{ field: 'file', message: errorMsg, code: 'file_error' }],
          });
          
          console.log(`   ❌ ${file} - ${errorMsg}`);
        }
      }
      
    } catch (dirError) {
      console.error(`❌ Failed to process directory ${contentDir}: ${dirError.message}`);
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 VALIDATION SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total files processed: ${results.totalFiles}`);
  console.log(`Valid files: ${results.validFiles} (${Math.round(results.validFiles/results.totalFiles*100)}%)`);
  console.log(`Invalid files: ${results.invalidFiles} (${Math.round(results.invalidFiles/results.totalFiles*100)}%)`);

  if (results.errors.length > 0) {
    console.log('\n❌ VALIDATION ERRORS:');
    console.log('-'.repeat(30));
    
    results.errors.forEach(({ file, summary }) => {
      console.log(`\n📄 ${file}`);
      console.log(`   ${summary.split('\n').join('\n   ')}`);
    });

    if (options.fix) {
      console.log('\n🔧 AUTO-FIX SUGGESTIONS:');
      console.log('-'.repeat(30));
      console.log('Auto-fix is not implemented yet. Common fixes:');
      console.log('• Add missing required fields (title, description, publishedAt, etc.)');
      console.log('• Fix slug format (lowercase, hyphens only)');
      console.log('• Ensure tags array is not empty');
      console.log('• Add proper reading time format ("X min read")');
      console.log('• Validate date formats');
    }
  }

  // Exit with error code if validation failed
  if (results.invalidFiles > 0) {
    console.log('\n❌ Content validation failed. Please fix the errors above.');
    process.exit(1);
  } else {
    console.log('\n✅ All content files are valid!');
    process.exit(0);
  }
}

// Run validation
validateContent().catch(error => {
  console.error('\n❌ Validation script failed:', error.message);
  if (options.verbose) {
    console.error(error.stack);
  }
  process.exit(1);
});