// This script generates a sitemap.xml file for the website
// Run with: node scripts/generate-sitemap.js

const fs = require('fs');
const path = require('path');
const prettier = require('prettier');
const { faqData } = require('../lib/content/faqData'); // Import faqData

// Configuration
const SITE_URL = 'https://testero.ai'; // Used for sitemap <loc> tags
const LOCAL_API_URL = 'http://localhost:3000'; // Used for fetching data locally
const PUBLIC_DIR = path.join(__dirname, '../public');
const APP_DIR = path.join(__dirname, '../app');
const fetch = require('node-fetch'); // For making API calls
const HUB_CONTENT_DIR = path.join(__dirname, '../app/content/hub');
const SPOKE_CONTENT_DIR = path.join(__dirname, '../app/content/spokes');

// Get current date in YYYY-MM-DD format
const getCurrentDate = () => {
  const date = new Date();
  return date.toISOString().split('T')[0];
};

// Get all page routes from the app directory (excluding dynamic routes handled separately)
const getPageRoutes = (dir, basePath = '') => {
  let routes = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.join(basePath, entry.name);

    if (entry.isDirectory()) {
      // Skip directories that start with _ or .
      if (entry.name.startsWith('_') || entry.name.startsWith('.')) {
        continue;
      }

      // Skip api routes and dynamic route directories
      if (relativePath === 'api' || entry.name.includes('[') && entry.name.includes(']')) {
        continue;
      }

      // Recursively get routes from subdirectories
      routes = [...routes, ...getPageRoutes(fullPath, relativePath)];
    } else if (
      entry.name === 'page.tsx' ||
      entry.name === 'page.jsx' ||
      entry.name === 'page.js'
    ) {
      // Convert route path to URL path
      let routePath = basePath.replace(/\\/g, '/');

      // Handle index route
      if (routePath === '') {
        routes.push('/');
      } else {
        routes.push(`/${routePath}`);
      }
    }
  }

  return routes;
};

// Get slugs from markdown files in a directory
const getMarkdownSlugs = (dir, routePrefix) => {
  const files = fs.readdirSync(dir);
  return files
    .filter(file => file.endsWith('.md'))
    .map(file => {
      const slug = file.replace(/\.md$/, '');
      return `${routePrefix}/${slug}`;
    });
};


// Generate sitemap XML for specific routes and filename
const generateIndividualSitemap = async (routes, filename) => {
  const currentDate = getCurrentDate();

  const sitemap = `
    <?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${routes
        .map(route => {
          // Set priority based on route depth
          const depth = (route.match(/\//g) || []).length;
          const priority = Math.max(0.1, 1 - depth * 0.2).toFixed(1);

          return `
            <url>
              <loc>${SITE_URL}${route}</loc>
              <lastmod>${currentDate}</lastmod>
              <changefreq>${route === '/' ? 'weekly' : 'monthly'}</changefreq>
              <priority>${route === '/' ? '1.0' : priority}</priority>
            </url>
          `;
        })
        .join('')}
    </urlset>
  `;

  // Format XML with prettier
  const formattedSitemap = await prettier.format(sitemap, {
    parser: 'html',
    printWidth: 100,
  });

  fs.writeFileSync(path.join(PUBLIC_DIR, filename), formattedSitemap);
  console.log(`${filename} generated successfully!`);
};

// Generate sitemap index XML
const generateSitemapIndex = async (sitemapFiles) => {
  const currentDate = getCurrentDate();
  const sitemapIndex = `
    <?xml version="1.0" encoding="UTF-8"?>
    <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${sitemapFiles
        .map(sitemapFile => `
          <sitemap>
            <loc>${SITE_URL}/${sitemapFile}</loc>
            <lastmod>${currentDate}</lastmod>
          </sitemap>
        `)
        .join('')}
    </sitemapindex>
  `;

  const formattedSitemapIndex = await prettier.format(sitemapIndex, {
    parser: 'html',
    printWidth: 100,
  });

  fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap.xml'), formattedSitemapIndex);
  console.log('Sitemap index (sitemap.xml) generated successfully!');
};


// Fetch question IDs from the API
const getQuestionRoutes = async () => {
  try {
    const response = await fetch(`${LOCAL_API_URL}/api/questions/list`);
    if (!response.ok) {
      throw new Error(`Failed to fetch question list: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    if (!data.questionIds || !Array.isArray(data.questionIds)) {
      throw new Error('Invalid data format for question IDs');
    }
    return data.questionIds.map(id => `/practice/question/${id}`);
  } catch (error) {
    console.error('Error fetching question routes:', error);
    return []; // Return empty array on error
  }
};


// Main function
async function main() {
  try {
    // Install prettier and node-fetch if not already installed
    const packagesToInstall = [];
    try {
      require.resolve('prettier');
    } catch (error) {
      packagesToInstall.push('prettier');
    }
    try {
      require.resolve('node-fetch');
    } catch (error) {
      packagesToInstall.push('node-fetch@2'); // Specify version 2 for CommonJS compatibility
    }

    if (packagesToInstall.length > 0) {
      console.log(`Installing ${packagesToInstall.join(' and ')}...`);
      // It's generally better to ensure dev dependencies are installed via package.json
      // but for this script's self-containment, we'll keep it.
      require('child_process').execSync(`npm install --save-dev ${packagesToInstall.join(' ')}`);
      // Re-require fetch if it was just installed
      if (packagesToInstall.includes('node-fetch@2')) {
        global.fetch = require('node-fetch');
      }
    }


    // Generate sitemap for pages
    let pageRoutes = getPageRoutes(APP_DIR);

    // Add FAQ routes
    const faqRoutes = faqData.map(faq => `/faq/${faq.slug}`);
    pageRoutes = [...pageRoutes, ...faqRoutes];

    // Add Hub content routes
    const hubRoutes = getMarkdownSlugs(HUB_CONTENT_DIR, '/content/hub');
    pageRoutes = [...pageRoutes, ...hubRoutes];

    // Add Spoke content routes
    const spokeRoutes = getMarkdownSlugs(SPOKE_CONTENT_DIR, '/content/spoke');
    pageRoutes = [...pageRoutes, ...spokeRoutes];

    // Remove duplicate routes if any
    pageRoutes = [...new Set(pageRoutes)];
    await generateIndividualSitemap(pageRoutes, 'sitemap-pages.xml');

    // Generate sitemap for questions
    const questionRoutes = await getQuestionRoutes();
    if (questionRoutes.length > 0) {
      await generateIndividualSitemap(questionRoutes, 'sitemap-questions.xml');
    } else {
      console.log('No question routes found, skipping sitemap-questions.xml generation.');
    }

    // Generate sitemap index
    const sitemapFiles = ['sitemap-pages.xml'];
    if (questionRoutes.length > 0) {
      sitemapFiles.push('sitemap-questions.xml');
    }
    await generateSitemapIndex(sitemapFiles);

  } catch (error) {
    console.error('Error generating sitemaps:', error);
  }
}

main();
