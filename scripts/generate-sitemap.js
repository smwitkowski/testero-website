// This script generates a sitemap.xml file for the website
// Run with: node scripts/generate-sitemap.js

const fs = require('fs');
const path = require('path');
const prettier = require('prettier');
const { faqData } = require('../lib/content/faqData'); // Import faqData

// Configuration
const SITE_URL = 'https://testero.ai';
const PUBLIC_DIR = path.join(__dirname, '../public');
const APP_DIR = path.join(__dirname, '../app');
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


// Generate sitemap XML
const generateSitemap = async (routes) => {
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

  fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap.xml'), formattedSitemap);
  console.log('Sitemap generated successfully!');
};

// Main function
async function main() {
  try {
    // Install prettier if not already installed
    try {
      require.resolve('prettier');
    } catch (error) {
      console.log('Installing prettier...');
      // It's generally better to ensure dev dependencies are installed via package.json
      // but for this script's self-containment, we'll keep it.
      // Consider moving prettier to devDependencies in package.json
      require('child_process').execSync('npm install --save-dev prettier');
    }

    let routes = getPageRoutes(APP_DIR);

    // Add FAQ routes
    const faqRoutes = faqData.map(faq => `/faq/${faq.slug}`);
    routes = [...routes, ...faqRoutes];

    // Add Hub content routes
    const hubRoutes = getMarkdownSlugs(HUB_CONTENT_DIR, '/content/hub');
    routes = [...routes, ...hubRoutes];

    // Add Spoke content routes
    const spokeRoutes = getMarkdownSlugs(SPOKE_CONTENT_DIR, '/content/spoke');
    routes = [...routes, ...spokeRoutes];


    // Remove duplicate routes if any
    routes = [...new Set(routes)];

    await generateSitemap(routes);
  } catch (error) {
    console.error('Error generating sitemap:', error);
  }
}

main();
