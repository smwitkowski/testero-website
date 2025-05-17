const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { XMLParser } = require('fast-xml-parser'); // Using a common XML parsing library

// --- Configuration ---
const INDEXNOW_API_KEY = process.env.INDEXNOW_KEY || process.argv[2];
const SITEMAP_PATH = path.join(__dirname, '..', 'public', 'sitemap.xml');
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'; // Generic endpoint, also Yandex, Bing, Seznam etc. have their own
const HOST_DOMAIN = 'testero.ai'; // Replace with your actual domain if different, or make it dynamic
const MAX_URLS_PER_REQUEST = 10000;

// --- Helper Functions ---
async function getUrlsFromSitemap(sitemapPath) {
    try {
        const sitemapXml = fs.readFileSync(sitemapPath, 'utf-8');
        const parser = new XMLParser();
        const sitemapJson = parser.parse(sitemapXml);

        if (sitemapJson.urlset && Array.isArray(sitemapJson.urlset.url)) {
            return sitemapJson.urlset.url.map(entry => entry.loc);
        } else if (sitemapJson.sitemapindex && Array.isArray(sitemapJson.sitemapindex.sitemap)) {
            // Handle sitemap index files by recursively fetching and parsing sub-sitemaps
            let allUrls = [];
            for (const subSitemapEntry of sitemapJson.sitemapindex.sitemap) {
                // Assuming sub-sitemaps are also locally available or accessible via http
                // This part might need adjustment based on how sub-sitemaps are structured/hosted
                console.warn(`Sitemap index found. This script currently doesn't recursively fetch sub-sitemaps. Please submit them individually or enhance this script. Skipping: ${subSitemapEntry.loc}`);
            }
            return allUrls;
        }
        console.error('Could not parse URLs from sitemap. Ensure it follows a standard format.');
        return [];
    } catch (error) {
        console.error(`Error reading or parsing sitemap at ${sitemapPath}:`, error.message);
        return [];
    }
}

async function submitUrlsToIndexNow(apiKey, urls, host) {
    if (!apiKey) {
        console.error('Error: IndexNow API key is missing. Provide it via INDEXNOW_KEY environment variable or as a command-line argument.');
        return;
    }
    if (!urls || urls.length === 0) {
        console.log('No URLs to submit.');
        return;
    }

    console.log(`Preparing to submit ${urls.length} URL(s) to IndexNow for host: ${host}`);

    for (let i = 0; i < urls.length; i += MAX_URLS_PER_REQUEST) {
        const batchUrls = urls.slice(i, i + MAX_URLS_PER_REQUEST);
        const payload = {
            host: host,
            key: apiKey,
            keyLocation: `https://${host}/${apiKey}.txt`, // Assuming key file is at root
            urlList: batchUrls,
        };

        try {
            console.log(`Submitting batch of ${batchUrls.length} URLs...`);
            const response = await axios.post(INDEXNOW_ENDPOINT, payload, {
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                },
                timeout: 10000, // 10 seconds timeout
            });

            if (response.status === 200) {
                console.log(`Batch submitted successfully to ${INDEXNOW_ENDPOINT}. Status: ${response.status}`);
            } else if (response.status === 202) {
                 console.log(`Batch accepted for processing by ${INDEXNOW_ENDPOINT}. Status: ${response.status}. It might take some time to process.`);
            }
            else {
                console.warn(`Warning: Submission to ${INDEXNOW_ENDPOINT} returned status ${response.status}. Response:`, response.data);
            }
        } catch (error) {
            console.error(`Error submitting batch to ${INDEXNOW_ENDPOINT}:`, error.response ? error.response.data : error.message);
            if (error.response && error.response.status === 403) {
                console.error("A 403 Forbidden error often means the API key is invalid or the key file is not accessible/correct.");
            }
        }
    }
    console.log('All URL submissions attempted.');
}

// --- Main Execution ---
async function main() {
    if (!INDEXNOW_API_KEY) {
        console.error("Error: IndexNow API key must be provided either as the first command-line argument or via the INDEXNOW_KEY environment variable.");
        console.log("Usage: node scripts/submit-to-indexnow.js YOUR_API_KEY [url1 url2 ...]");
        console.log("Or (reading from sitemap): INDEXNOW_KEY=YOUR_API_KEY node scripts/submit-to-indexnow.js");
        return;
    }

    let urlsToSubmit = [];
    const additionalArgs = process.argv.slice(3); // URLs passed as command line arguments

    if (additionalArgs.length > 0) {
        urlsToSubmit = additionalArgs.filter(arg => arg.startsWith('http'));
        console.log(`Received ${urlsToSubmit.length} URL(s) from command line arguments.`);
    } else {
        console.log(`No URLs provided via command line, attempting to read from sitemap: ${SITEMAP_PATH}`);
        urlsToSubmit = await getUrlsFromSitemap(SITEMAP_PATH);
    }

    if (urlsToSubmit.length === 0) {
        console.log("No URLs found to submit from sitemap or arguments.");
        // As per TES-207, at least submit the homepage if nothing else.
        const homepageUrl = `https://${HOST_DOMAIN}/`;
        console.log(`Adding homepage ${homepageUrl} for submission.`);
        urlsToSubmit.push(homepageUrl);
    }

    await submitUrlsToIndexNow(INDEXNOW_API_KEY, urlsToSubmit, HOST_DOMAIN);
}

main().catch(error => {
    console.error("An unexpected error occurred:", error);
});
