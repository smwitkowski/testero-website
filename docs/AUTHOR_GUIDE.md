# Content Author Guide

## Overview

This guide provides comprehensive instructions for content authors working with the Testero content system. Whether you're creating blog posts, tutorials, documentation, or FAQ entries, this guide will help you produce high-quality, SEO-optimized content that engages users and drives conversions.

## Table of Contents

- [Quick Start](#quick-start)
- [Content Types](#content-types)
- [Frontmatter Reference](#frontmatter-reference)
- [MDX Syntax Guide](#mdx-syntax-guide)
- [SEO Best Practices](#seo-best-practices)
- [Content Guidelines](#content-guidelines)
- [Publishing Workflow](#publishing-workflow)
- [Common Patterns](#common-patterns)
- [Troubleshooting](#troubleshooting)

## Quick Start

### Creating Your First Article

1. **Choose Content Type**: Decide whether you're creating a blog post, guide, hub content, or other content type
2. **Create File**: Create a new `.md` file in the appropriate directory
3. **Add Frontmatter**: Include all required metadata at the top of your file
4. **Write Content**: Use MDX syntax to create engaging, readable content
5. **Review & Publish**: Test locally and submit for review

### File Location Guide

```
app/content/
├── blog/          # Blog posts and articles
├── hub/           # Pillar content pages
├── spokes/        # Detailed guides linked to hubs
├── guides/        # Step-by-step tutorials
├── docs/          # Technical documentation  
└── faq/           # Frequently asked questions
```

### Basic Template

```markdown
---
title: "Your Compelling Article Title"
description: "A clear, concise description that explains what readers will learn"
publishedAt: "2025-01-15"
author: "Your Name"
category: "certification-guides"
tags: ["PMLE", "Google Cloud", "Machine Learning"]
readingTime: "8 min read"
featured: true
---

# Your Article Title

Your engaging introduction that hooks the reader and explains what they'll learn...

## Main Section

Your detailed content here...

### Subsection

More specific information...

## Conclusion

Summarize key points and provide next steps...
```

## Content Types

### Blog Posts

**Purpose**: Informational articles, guides, and thought leadership content
**Directory**: `/app/content/blog/`
**URL Pattern**: `/blog/[slug]`

**Use Cases**:
- PMLE certification guides
- Exam preparation tips
- Google Cloud updates and analysis
- Success stories and case studies

### Hub Content

**Purpose**: Comprehensive pillar pages that serve as central resources
**Directory**: `/app/content/hub/`
**URL Pattern**: `/content/hub/[slug]`

**Use Cases**:
- Complete certification roadmaps
- Technology overview pages
- Comprehensive topic guides
- Resource collections

### Spoke Content

**Purpose**: Detailed content that links back to hub pages
**Directory**: `/app/content/spokes/`
**URL Pattern**: `/content/spoke/[slug]`

**Use Cases**:
- Specific technology deep-dives
- Detailed implementation guides
- Chapter-like content series
- Supporting documentation

### Guides

**Purpose**: Step-by-step instructional content
**Directory**: `/app/content/guides/`
**URL Pattern**: `/guides/[slug]`

**Use Cases**:
- Setup tutorials
- Configuration walkthroughs
- Learning paths
- Project-based tutorials

### Documentation

**Purpose**: Technical reference material
**Directory**: `/app/content/docs/`
**URL Pattern**: `/docs/[slug]`

**Use Cases**:
- API documentation
- Technical specifications
- Reference materials
- System documentation

### FAQ

**Purpose**: Frequently asked questions and answers
**Directory**: `/app/content/faq/`
**URL Pattern**: `/faq/[slug]`

**Use Cases**:
- Common certification questions
- Troubleshooting guides
- Quick reference answers
- Support content

## Frontmatter Reference

### Required Fields (All Content Types)

```yaml
---
# REQUIRED: Content title (5-100 characters)
title: "PMLE Certification Complete Guide 2025"

# REQUIRED: SEO description (20-200 characters)
description: "Master the Google Professional ML Engineer exam with our comprehensive 2025 guide covering all domains and practice questions."

# REQUIRED: Publication date (ISO format)
publishedAt: "2025-01-15"

# REQUIRED: Author name (2-50 characters)
author: "Testero Team"

# REQUIRED: Content tags (1-10 tags)
tags: ["PMLE", "Google Cloud", "Machine Learning", "Certification"]

# REQUIRED: Reading time estimate
readingTime: "12 min read"
---
```

### Content-Type Specific Fields

#### Blog Posts

```yaml
---
# ... required fields above ...

# Content category (blog posts only)
category: "blog"

# Whether this post is featured
featured: true

# Optional excerpt for previews (50-300 characters)
excerpt: "Learn everything you need to pass the PMLE exam in 2025 with updated content, practice questions, and proven strategies."

# Blog-specific category
blogCategory: "certification-guides"
---
```

#### Hub Content

```yaml
---
# ... required fields above ...

category: "hub"
type: "hub"

# Cover image URL (optional)
coverImage: "/images/google-cloud-certification-guide.jpg"

# Legacy support fields
date: "2025-01-15"
lastModified: "2025-01-20"
---
```

#### Spoke Content

```yaml
---
# ... required fields above ...

category: "spoke"
type: "spoke"

# Hub this spoke belongs to
hubSlug: "google-cloud-certification-guide"

# Order within the hub (for navigation)
spokeOrder: 1

# Cover image URL (optional)
coverImage: "/images/vertex-ai-fundamentals.jpg"

# Legacy support fields  
date: "2025-01-15"
lastModified: "2025-01-20"
---
```

#### Guides

```yaml
---
# ... required fields above ...

category: "guide"

# Difficulty level
difficulty: "intermediate"

# Estimated completion time
completionTime: "2 hours"

# Prerequisites (up to 10)
prerequisites: 
  - "Basic Python knowledge"
  - "Google Cloud account"
  - "ML fundamentals"

# Learning objectives (1-15)
objectives:
  - "Set up Vertex AI environment"
  - "Train your first ML model"
  - "Deploy model to production"
  - "Monitor model performance"
---
```

#### Documentation

```yaml
---
# ... required fields above ...

category: "documentation"

# Documentation section
section: "API Reference"

# API version (format: "v1.2.3" or "1.2.3-beta")
apiVersion: "v2.1.0"

# Whether this is deprecated
deprecated: false
---
```

#### FAQ

```yaml
---
# ... required fields above ...

category: "faq"

# The question (10-200 characters)
question: "What are the PMLE exam requirements?"

# The answer (20-2000 characters)
answer: "The PMLE exam requires 3+ years of industry experience and 1+ year with Google Cloud ML solutions."

# FAQ category for grouping
faqCategory: "exam-requirements"

# Priority for ordering (0-100, higher = more important)
priority: 90
---
```

### Optional SEO Fields

```yaml
---
# ... other required fields ...

# Optional last update date
updatedAt: "2025-01-20"

# SEO overrides
seo:
  # Meta title override (10-60 characters)
  metaTitle: "PMLE Certification Guide 2025 - Pass Google ML Engineer Exam"
  
  # Meta description override (50-160 characters)
  metaDescription: "Complete PMLE certification guide with practice questions, study materials, and proven strategies to pass in 2025."
  
  # Canonical URL (for duplicate content)
  canonicalUrl: "https://testero.ai/blog/pmle-certification-guide-2025"
  
  # Open Graph image
  ogImage: "https://testero.ai/images/pmle-guide-og.jpg"
  
  # Twitter card type
  twitterCard: "summary_large_image"
---
```

## MDX Syntax Guide

### Basic Markdown

#### Headings

```markdown
# H1 - Main Title (automatically generated from frontmatter)
## H2 - Major Sections
### H3 - Subsections  
#### H4 - Sub-subsections
```

**Best Practice**: Use heading hierarchy properly for SEO and accessibility. Start with H2 for main sections.

#### Text Formatting

```markdown
**Bold text** for emphasis
*Italic text* for subtle emphasis
`Inline code` for technical terms
~~Strikethrough~~ for deprecated content

> **Pro Tip**: Use blockquotes for important callouts and tips.

> **Warning**: Use warning blockquotes for critical information.

> **Note**: Use note blockquotes for additional context.
```

#### Lists

```markdown
# Unordered Lists
- First item
- Second item
  - Nested item
  - Another nested item
- Third item

# Ordered Lists
1. First step
2. Second step
   1. Sub-step A
   2. Sub-step B
3. Third step

# Task Lists
- [x] Completed task
- [ ] Incomplete task
- [ ] Another task
```

#### Links and Images

```markdown
# Internal Links
[Link to another blog post](/blog/pmle-exam-tips)
[Link to hub content](/content/hub/google-cloud-guide)
[Link to external resource](https://cloud.google.com)

# Images
![Alt text describing the image](/images/vertex-ai-console.jpg)

# Images with captions
![Vertex AI Console Dashboard](/images/vertex-ai-dashboard.jpg)
*Figure 1: Vertex AI Console showing the main dashboard*
```

### Code Blocks

#### Syntax Highlighting

````markdown
```python
# Python code example
import tensorflow as tf
from google.cloud import aiplatform

def train_model():
    """Train a machine learning model."""
    model = tf.keras.Sequential([
        tf.keras.layers.Dense(128, activation='relu'),
        tf.keras.layers.Dense(10, activation='softmax')
    ])
    return model
```

```bash
# Terminal commands
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
pip install google-cloud-aiplatform
```

```yaml
# Configuration files
apiVersion: v1
kind: ConfigMap
metadata:
  name: ml-config
data:
  model_path: "gs://your-bucket/models"
  batch_size: "32"
```
````

#### Code Block Features

- **Line Highlighting**: Add `{highlight: [2, 5-7]}` after language
- **Filename Display**: Add filename in comments at the top
- **Copy Button**: Automatically added to all code blocks

### Tables

```markdown
| Feature | PMLE | AWS ML | Azure AI |
|---------|------|---------|----------|
| Cost | $ | $$ | $$$ |
| Ease of Use | High | Medium | Medium |
| Integration | Excellent | Good | Good |
| Support | 24/7 | Business | Business |
```

**Best Practice**: Keep tables simple and mobile-friendly. Consider using bullet lists for complex comparisons.

### Advanced MDX Features

#### Custom Components

```markdown
# Call-to-Action Blocks
> **Ready to Test Your Knowledge?**
> Take our [PMLE Diagnostic Assessment](/diagnostic) to identify your weak areas and get a personalized study plan.

# Embedded Widgets
<!-- Diagnostic CTA will be automatically inserted -->

# Math Expressions (if needed)
The accuracy formula is: $accuracy = \frac{correct\_predictions}{total\_predictions}$
```

#### Embedded Content

```markdown
# Video Embeds (YouTube)
https://www.youtube.com/watch?v=VIDEO_ID

# Tweet Embeds
https://twitter.com/username/status/TWEET_ID
```

## SEO Best Practices

### Title Optimization

```markdown
# ✅ Good Titles
"PMLE Certification Guide 2025: Complete Study Plan & Practice Questions"
"Vertex AI vs AutoML: Which Google Cloud ML Service Should You Choose?"
"How to Pass the Google ML Engineer Exam in 30 Days (2025 Update)"

# ❌ Poor Titles  
"ML Stuff"
"Google Cloud"
"Certification Guide"
```

**Title Guidelines**:
- 50-60 characters for optimal Google display
- Include primary keyword near the beginning
- Add year/date for freshness
- Make it compelling and specific
- Avoid keyword stuffing

### Description Optimization

```yaml
# ✅ Good Description
description: "Master the Google Professional ML Engineer exam with our comprehensive 2025 guide covering all 4 domains, practice questions, and proven study strategies."

# ❌ Poor Description
description: "Learn about ML engineering."
```

**Description Guidelines**:
- 150-160 characters for optimal Google display
- Include primary and secondary keywords naturally
- Explain the benefit/outcome for readers
- Use action words like "Master", "Learn", "Discover"
- Avoid duplicate descriptions across pages

### Keyword Strategy

#### Primary Keywords
Target one primary keyword per article:
- "PMLE certification guide"
- "Google ML engineer exam"
- "Vertex AI tutorial"
- "Cloud ML certification"

#### Secondary Keywords
Include 2-3 related keywords:
- "machine learning certification"
- "Google Cloud Professional"
- "ML engineer study guide"
- "cloud AI services"

#### Long-tail Keywords
Target specific questions:
- "how to pass PMLE exam"
- "what is Vertex AI used for"
- "PMLE exam requirements 2025"
- "Google Cloud ML services comparison"

### Content Structure for SEO

```markdown
# H1: Primary Keyword (automatically from title)

## H2: What is [Primary Keyword]? (Definition section)

Content answering the basic question...

## H2: Benefits of [Primary Keyword] (Value proposition)

Content explaining why it matters...

## H2: How to [Primary Keyword] (Action/Process)

Step-by-step content...

## H2: Best Practices for [Primary Keyword] (Advanced tips)

Expert-level content...

## H2: Conclusion (Summary and next steps)

Recap and call-to-action...
```

### Internal Linking Strategy

```markdown
# Link to Related Content
Learn more about [Vertex AI fundamentals](/content/spoke/vertex-ai-fundamentals) before diving into advanced topics.

# Link to Conversion Pages
Ready to test your knowledge? Take our [PMLE Diagnostic Assessment](/diagnostic) to get personalized recommendations.

# Link to Resource Pages
Check out our complete [Google Cloud Certification Roadmap](/content/hub/google-cloud-certification-guide) for more certifications.
```

**Internal Linking Guidelines**:
- Link to 3-5 related articles per post
- Use descriptive anchor text (not "click here")
- Link to both supporting content and conversion pages
- Create topic clusters around main themes

### Image SEO

```markdown
# Optimized Image Usage
![PMLE certification exam dashboard showing score breakdown](/images/pmle-exam-results-dashboard.jpg)

# Image File Naming
# ✅ Good: pmle-exam-results-dashboard.jpg
# ❌ Poor: IMG_1234.jpg
```

**Image Guidelines**:
- Use descriptive file names with keywords
- Add comprehensive alt text
- Optimize file sizes (< 100KB for web)
- Use WebP format when possible
- Include images every 300-500 words

## Content Guidelines

### Writing Style

#### Tone and Voice
- **Professional yet approachable**: Expert knowledge without intimidation
- **Action-oriented**: Focus on what readers can do
- **Encouraging**: Build confidence for exam success
- **Specific**: Use concrete examples and numbers

#### Writing Principles

```markdown
# ✅ Good Examples
"Complete these 5 practice exams to increase your PMLE pass rate by 40%"
"Vertex AI reduces model training time from 6 hours to 45 minutes"
"Follow this 30-day study plan to master all 4 PMLE domains"

# ❌ Poor Examples  
"Practice helps with exams"
"Vertex AI is faster"
"Study to pass the test"
```

### Content Structure

#### Article Introduction (First 100 words)
1. **Hook**: Compelling opening statement
2. **Problem**: What challenge does this solve?
3. **Solution**: What will readers learn?
4. **Benefit**: What outcome will they achieve?

```markdown
# Example Introduction
Failing the PMLE exam costs more than just the $200 fee—it delays your career advancement by months. With Google's 2025 exam updates covering new Vertex AI features and MLOps practices, outdated study materials won't cut it. This comprehensive guide provides everything you need to pass on your first attempt, including updated practice questions, domain-by-domain study plans, and insider tips from certified professionals. By following this roadmap, you'll master all four exam domains and join the 73% of candidates who pass using structured preparation.
```

#### Body Content Structure
1. **Definition/Overview**: What is this topic?
2. **Why It Matters**: Benefits and importance
3. **How It Works**: Technical details and process
4. **Implementation**: Step-by-step instructions
5. **Best Practices**: Expert tips and optimization
6. **Common Mistakes**: Pitfalls to avoid
7. **Examples**: Real-world applications

#### Conclusion Elements
1. **Summary**: Key takeaways (3-5 bullet points)
2. **Next Steps**: What readers should do next
3. **Call-to-Action**: Link to diagnostic, other content, or resources

### Content Quality Standards

#### Depth and Comprehensiveness
- **Minimum Length**: 1,500 words for blog posts, 3,000+ for guides
- **Complete Coverage**: Address all aspects of the topic
- **Multiple Perspectives**: Consider different use cases and scenarios
- **Actionable Content**: Include specific steps and examples

#### Accuracy and Credibility
- **Fact-Checking**: Verify all technical information
- **Current Information**: Use latest versions, dates, and best practices
- **Citations**: Link to official Google documentation when applicable
- **Expert Review**: Have technical content reviewed by certified professionals

#### User Experience
- **Scannable Format**: Use headers, bullet points, and short paragraphs
- **Visual Breaks**: Include images, code blocks, and callout boxes
- **Progressive Disclosure**: Start simple, add complexity gradually
- **Mobile-Friendly**: Test readability on mobile devices

### Conversion Optimization

#### Call-to-Action Placement
1. **After Introduction**: Soft CTA to diagnostic assessment
2. **Mid-Content**: Contextual links to related resources
3. **Conclusion**: Primary CTA to next step in user journey

```markdown
# Example CTAs

## Soft CTA (After Introduction)
> **Not sure where you stand?** Take our [5-minute PMLE readiness quiz](/diagnostic) to identify your strongest and weakest domains.

## Contextual CTA (Mid-Content)  
Ready to dive deeper into Vertex AI? Our [comprehensive Vertex AI guide](/content/spoke/vertex-ai-complete-guide) covers everything from setup to advanced features.

## Primary CTA (Conclusion)
**Ready to start your PMLE preparation?** Get your personalized study plan with our [comprehensive diagnostic assessment](/diagnostic) - it only takes 15 minutes and provides detailed recommendations for each exam domain.
```

### Content Maintenance

#### Freshness Signals
- Update "publishedAt" dates when making significant changes
- Add "updatedAt" field for minor updates
- Include current year in titles and content
- Reference latest exam versions and changes

#### Performance Monitoring
- Track page views, time on page, and bounce rate
- Monitor internal link clicks and conversion rates
- Update based on user feedback and comments
- Refresh outdated examples and screenshots

## Publishing Workflow

### Pre-Publishing Checklist

#### Content Review
- [ ] All required frontmatter fields completed
- [ ] Title optimized for SEO (50-60 characters)
- [ ] Description compelling and keyword-rich (150-160 characters)
- [ ] Content comprehensive and actionable
- [ ] Internal links to 3-5 related articles
- [ ] Images optimized with descriptive alt text
- [ ] Code examples tested and working
- [ ] Spelling and grammar checked

#### Technical Review
- [ ] File saved in correct directory
- [ ] Filename uses correct slug format (lowercase, hyphens)
- [ ] Frontmatter syntax valid (YAML)
- [ ] MDX syntax renders correctly
- [ ] All links functional (internal and external)
- [ ] Images load properly
- [ ] Mobile-friendly formatting

#### SEO Review
- [ ] Primary keyword in title and first paragraph
- [ ] Secondary keywords naturally integrated
- [ ] Meta description includes primary keyword
- [ ] Headers follow H2 → H3 → H4 hierarchy
- [ ] Internal linking strategy implemented
- [ ] Image alt text optimized

### Local Testing

```bash
# Start development server
npm run dev

# Navigate to your content
http://localhost:3000/blog/your-article-slug
http://localhost:3000/content/hub/your-hub-slug

# Check for errors in console
# Test mobile responsiveness
# Verify all links and images work
```

### Publishing Process

1. **Create/Update Content**: Write and save your `.md` file
2. **Local Testing**: Test on development server
3. **Commit Changes**: Add to Git with descriptive commit message
4. **Submit for Review**: Create pull request if working with team
5. **Deploy**: Content automatically deployed on merge to main branch

## Common Patterns

### Article Templates

#### Certification Guide Template

```markdown
---
title: "[Certification Name] Complete Guide 2025"
description: "Master the [certification] exam with our comprehensive guide covering all domains, practice questions, and study strategies."
publishedAt: "2025-01-15"
author: "Testero Team"
tags: ["certification-name", "Google Cloud", "study-guide"]
readingTime: "15 min read"
category: "certification-guides"
featured: true
---

# [Certification Name] Complete Guide 2025

Passing the [certification name] exam opens doors to [career benefits]. With [recent updates/changes], candidates need updated preparation strategies to succeed. This guide provides everything you need to pass on your first attempt.

## What is the [Certification Name]?

[Definition and overview]

## Exam Overview

### Exam Format
- **Questions**: [number] questions
- **Duration**: [time] minutes  
- **Passing Score**: [score]%
- **Cost**: $[amount]
- **Delivery**: Proctored online or test center

### Exam Domains
1. **Domain 1**: [percentage]%
2. **Domain 2**: [percentage]%
3. **Domain 3**: [percentage]%
4. **Domain 4**: [percentage]%

## Study Plan

### Phase 1: Foundation (Weeks 1-2)
[Content for each phase]

### Phase 2: Deep Dive (Weeks 3-6)
[Detailed study topics]

### Phase 3: Practice & Review (Weeks 7-8)
[Practice exams and review strategy]

## Practice Questions

[Sample questions with explanations]

## Resources

### Official Resources
- [Links to official documentation]

### Practice Tests
- [Links to practice exams]

## Tips for Exam Day

[Practical advice for taking the exam]

## Conclusion

[Summary and next steps]

> **Start Your Preparation Today**: Take our [diagnostic assessment](/diagnostic) to identify your current level and get a personalized study plan.
```

#### Tutorial/Guide Template

```markdown
---
title: "How to [Accomplish Task]: Complete [Platform] Guide"
description: "Learn to [accomplish task] with [platform] using this step-by-step guide with examples and best practices."
publishedAt: "2025-01-15"
author: "Your Name"
tags: ["platform", "tutorial", "guide"]
readingTime: "10 min read"
category: "guide"
difficulty: "intermediate"
completionTime: "1 hour"
prerequisites: ["Basic knowledge", "Platform access"]
objectives:
  - "Objective 1"
  - "Objective 2"
  - "Objective 3"
---

# How to [Accomplish Task]: Complete [Platform] Guide

[Introduction explaining the task and its benefits]

## Prerequisites

Before starting, ensure you have:
- [Requirement 1]
- [Requirement 2] 
- [Requirement 3]

## Step 1: [First Step]

[Detailed instructions with screenshots]

```bash
# Code example if applicable
command --example
```

## Step 2: [Second Step]

[Continue with subsequent steps]

## Best Practices

- **Tip 1**: [Practical advice]
- **Tip 2**: [Optimization suggestion]
- **Tip 3**: [Common pitfall to avoid]

## Troubleshooting

### Common Issue 1
**Problem**: [Description of issue]
**Solution**: [How to resolve]

### Common Issue 2
**Problem**: [Description of issue]  
**Solution**: [How to resolve]

## Conclusion

You've successfully [accomplished task]. Key takeaways:
- [Key point 1]
- [Key point 2]
- [Key point 3]

## Next Steps

- [Suggested follow-up action 1]
- [Suggested follow-up action 2]
- [Link to related content]

> **Ready for the next level?** Check out our [advanced guide](/link) to learn more complex techniques.
```

### Content Series Patterns

#### Hub and Spoke Structure

**Hub Content**: Comprehensive overview with links to detailed content

```markdown
# Google Cloud Certification Complete Roadmap

This comprehensive guide covers all Google Cloud certifications...

## Available Certifications

### Associate Level
- [Cloud Engineer](/content/spoke/cloud-engineer-certification)
- [Data Engineer](/content/spoke/data-engineer-certification)

### Professional Level  
- [ML Engineer](/content/spoke/ml-engineer-certification)
- [Data Engineer](/content/spoke/professional-data-engineer)

## Getting Started
[Overview content with links to specific guides]
```

**Spoke Content**: Detailed implementation linking back to hub

```markdown
# Google Cloud Professional ML Engineer Certification

[Detailed content about PMLE certification]

## Related Certifications
This certification pairs well with other Google Cloud certs. See our [complete certification roadmap](/content/hub/google-cloud-certification-roadmap) for the full picture.
```

## Troubleshooting

### Common Issues

#### Frontmatter Validation Errors

```yaml
# ❌ Common Errors
publishedAt: 2025-01-15  # Missing quotes
tags: PMLE, Google       # Not an array
readingTime: 5 minutes   # Wrong format

# ✅ Correct Format
publishedAt: "2025-01-15"
tags: ["PMLE", "Google Cloud"]
readingTime: "5 min read"
```

#### Content Not Appearing

1. **Check file location**: Ensure file is in correct directory
2. **Verify filename**: Use kebab-case with `.md` extension
3. **Validate frontmatter**: All required fields present and properly formatted
4. **Check date**: `publishedAt` must not be in future

#### Images Not Loading

```markdown
# ❌ Incorrect paths
![Alt text](images/screenshot.jpg)
![Alt text](/src/images/screenshot.jpg)

# ✅ Correct paths
![Alt text](/images/screenshot.jpg)
![Alt text](https://cdn.example.com/screenshot.jpg)
```

#### Build Errors

1. **YAML Syntax**: Use quotes around dates, strings with special characters
2. **Markdown Syntax**: Close all code blocks, check heading hierarchy
3. **Missing Fields**: Ensure all required frontmatter fields present
4. **Invalid Characters**: Avoid special characters in slugs and filenames

### Getting Help

#### Content Questions
- Review this guide for syntax and structure questions
- Check existing content for examples and patterns
- Test locally before submitting

#### Technical Issues
- Check browser console for JavaScript errors
- Verify all links and images work locally
- Ensure file encoding is UTF-8

#### SEO Questions  
- Use keyword research tools for target keywords
- Follow the SEO checklist in this guide
- Monitor performance after publishing

## Content Quality Checklist

### Before Publishing

- [ ] **Value**: Does this content solve a real problem for PMLE candidates?
- [ ] **Completeness**: Have I covered the topic comprehensively?
- [ ] **Accuracy**: Is all technical information current and correct?
- [ ] **Actionability**: Can readers implement what they've learned?
- [ ] **SEO**: Is the content optimized for target keywords?
- [ ] **Readability**: Is it easy to scan and understand?
- [ ] **Engagement**: Will readers find this interesting and useful?
- [ ] **Conversion**: Does it guide readers toward our diagnostic assessment?

### After Publishing

- [ ] **Performance**: Monitor page views and user engagement
- [ ] **Feedback**: Collect and respond to reader comments
- [ ] **Updates**: Keep content current with platform changes
- [ ] **Internal Linking**: Link from new related content
- [ ] **Promotion**: Share on appropriate channels
- [ ] **Conversion Tracking**: Monitor diagnostic assessment signups

This comprehensive author guide ensures consistent, high-quality content creation that serves both user needs and business objectives. Follow these guidelines to create content that engages readers, ranks well in search engines, and drives meaningful conversions.