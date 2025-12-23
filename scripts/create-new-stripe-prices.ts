#!/usr/bin/env tsx
/**
 * Script to create new Stripe prices for the updated pricing model
 * 
 * Creates:
 * - Basic monthly: $14.99/month (replaces old $39/month)
 * - Basic 3-month: $39.99 every 3 months (replaces annual)
 * 
 * Usage:
 *   npm run stripe:create-prices
 * 
 * Or directly:
 *   STRIPE_SECRET_KEY=sk_test_... tsx scripts/create-new-stripe-prices.ts
 */

import Stripe from "stripe";

// Product IDs from Stripe (live mode IDs - will create in test mode if needed)
const PRODUCTS = {
  BASIC: "prod_TKP1Qa6MF9RIX9",
  PRO: "prod_TKP2zVCiYtDZcY",
  ALL_ACCESS: "prod_TKP2Bog4uwEo6H",
};

// Product definitions for creation if they don't exist in test mode
const PRODUCT_DEFINITIONS = {
  BASIC: {
    name: "Basic",
    description: "Perfect for focused certification prep - 1 certification track, core practice questions, basic analytics",
  },
  PRO: {
    name: "Pro",
    description: "Most popular for serious learners - 3 certification tracks, all practice modes, advanced analytics, priority support",
  },
  ALL_ACCESS: {
    name: "All-Access",
    description: "Ultimate learning experience - All certifications, unlimited tracks, team features, API access, white-glove support",
  },
};

// Prices to create
const PRICES_TO_CREATE = [
  {
    productId: PRODUCTS.BASIC,
    name: "Basic Monthly",
    amount: 1499, // $14.99 in cents
    currency: "usd",
    recurring: {
      interval: "month" as const,
      interval_count: 1,
    },
  },
  {
    productId: PRODUCTS.BASIC,
    name: "Basic 3-Month",
    amount: 3999, // $39.99 in cents
    currency: "usd",
    recurring: {
      interval: "month" as const,
      interval_count: 3, // Every 3 months
    },
  },
];

async function createNewPrices() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    console.error("❌ STRIPE_SECRET_KEY environment variable is required");
    console.error("Usage: STRIPE_SECRET_KEY=sk_test_... tsx scripts/create-new-stripe-prices.ts");
    process.exit(1);
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: process.env.STRIPE_API_VERSION as Stripe.LatestApiVersion | undefined,
    typescript: true,
  });

  console.log("🔄 Starting price creation process...\n");
  console.log("📋 Prices to create:");
  PRICES_TO_CREATE.forEach((price) => {
    console.log(`  - ${price.name}: $${(price.amount / 100).toFixed(2)} (${price.recurring.interval_count === 1 ? "monthly" : `every ${price.recurring.interval_count} months`})`);
  });
  console.log("");

  const createdPrices: Array<{ name: string; priceId: string; amount: number }> = [];
  const productCache: Record<string, string> = {}; // Cache product IDs to avoid creating duplicates

  // Helper function to get or create product in test mode
  async function getOrCreateProduct(productId: string, productName: string, description: string): Promise<string> {
    try {
      const product = await stripe.products.retrieve(productId);
      if (product.livemode) {
        console.log(`  ⚠️  Product ${productId} exists in live mode, creating new product in test mode...`);
        // Product exists in live mode but not test mode - create it in test mode
        const newProduct = await stripe.products.create({
          name: productName,
          description: description,
          metadata: {
            copied_from_live: productId,
          },
        });
        console.log(`  ✅ Created product in test mode: ${newProduct.id}`);
        return newProduct.id;
      }
      console.log(`  ✅ Product found: ${product.name} (${product.id})`);
      return product.id;
    } catch (error) {
      if (error instanceof Stripe.errors.StripeError && error.code === "resource_missing") {
        console.log(`  ⚠️  Product ${productId} not found in test mode, creating...`);
        const newProduct = await stripe.products.create({
          name: productName,
          description: description,
          metadata: {
            original_id: productId,
          },
        });
        console.log(`  ✅ Created product: ${newProduct.id}`);
        return newProduct.id;
      }
      throw error;
    }
  }

  for (const priceConfig of PRICES_TO_CREATE) {
    try {
      console.log(`📦 Creating price: ${priceConfig.name}`);

      // Get product name and description based on product ID
      let productName = "Basic";
      let productDescription = "Perfect for focused certification prep - 1 certification track, core practice questions, basic analytics";
      if (priceConfig.productId === PRODUCTS.PRO) {
        productName = PRODUCT_DEFINITIONS.PRO.name;
        productDescription = PRODUCT_DEFINITIONS.PRO.description;
      } else if (priceConfig.productId === PRODUCTS.ALL_ACCESS) {
        productName = PRODUCT_DEFINITIONS.ALL_ACCESS.name;
        productDescription = PRODUCT_DEFINITIONS.ALL_ACCESS.description;
      }

      // Get or create product in test mode (use cache if already created)
      if (!productCache[priceConfig.productId]) {
        productCache[priceConfig.productId] = await getOrCreateProduct(priceConfig.productId, productName, productDescription);
      }
      const actualProductId = productCache[priceConfig.productId];

      // Create the price
      const price = await stripe.prices.create({
        product: actualProductId,
        unit_amount: priceConfig.amount,
        currency: priceConfig.currency,
        recurring: priceConfig.recurring,
        metadata: {
          created_by: "create-new-stripe-prices-script",
          created_at: new Date().toISOString(),
        },
      });

      console.log(`  ✅ Price created successfully!`);
      console.log(`     Price ID: ${price.id}`);
      console.log(`     Amount: $${(price.unit_amount! / 100).toFixed(2)}`);
      console.log(`     Interval: ${price.recurring?.interval} (count: ${price.recurring?.interval_count})`);
      console.log("");

      createdPrices.push({
        name: priceConfig.name,
        priceId: price.id,
        amount: priceConfig.amount,
      });
    } catch (error) {
      if (error instanceof Stripe.errors.StripeError) {
        console.error(`  ❌ Error creating price ${priceConfig.name}:`, error.message);
        if (error.code === "resource_missing") {
          console.error(`     Product ${priceConfig.productId} not found`);
        }
      } else {
        console.error(`  ❌ Unexpected error creating price ${priceConfig.name}:`, error);
      }
      console.error("   Continuing with next price...\n");
    }
  }

  console.log("✨ Price creation process completed!\n");

  if (createdPrices.length > 0) {
    console.log("📝 Created Prices Summary:");
    console.log("=" .repeat(60));
    createdPrices.forEach((price) => {
      console.log(`${price.name}:`);
      console.log(`  Price ID: ${price.priceId}`);
      console.log(`  Amount: $${(price.amount / 100).toFixed(2)}`);
      console.log("");
    });

    console.log("🔧 Next Steps:");
    console.log("1. Update environment variables with the new price IDs:");
    console.log("");
    createdPrices.forEach((price) => {
      if (price.name.includes("Monthly")) {
        console.log(`   NEXT_PUBLIC_STRIPE_BASIC_MONTHLY=${price.priceId}`);
      } else if (price.name.includes("3-Month")) {
        console.log(`   NEXT_PUBLIC_STRIPE_BASIC_3MONTH=${price.priceId}`);
      }
    });
    console.log("");
    console.log("2. Archive the old monthly price ($39/month) in Stripe Dashboard:");
    console.log("   - Go to Products > Basic > Prices");
    console.log("   - Find price_1SNkDtRqq8mPUhEry3BHJl1K ($39/month)");
    console.log("   - Click 'Archive' (don't delete - keep for reference)");
    console.log("");
    console.log("3. Archive the old annual price ($349/year) in Stripe Dashboard:");
    console.log("   - Find price_1SNkDvRqq8mPUhErb1atjbrv ($349/year)");
    console.log("   - Click 'Archive' (keep for grandfathered subscriptions)");
    console.log("");
    console.log("4. Update your .env.local file and GitHub Secrets with the new price IDs");
    console.log("5. Test checkout flow with the new prices");
  } else {
    console.log("⚠️  No prices were created. Please check the errors above.");
  }
}

// Run the script
createNewPrices().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
