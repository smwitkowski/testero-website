#!/usr/bin/env tsx
/**
 * Script to archive legacy Stripe products and their associated prices
 * 
 * Usage:
 *   npm run stripe:archive-legacy
 * 
 * Or directly:
 *   STRIPE_SECRET_KEY=sk_test_... tsx scripts/archive-legacy-stripe-products.ts
 */

import Stripe from "stripe";

// Legacy products to archive
const LEGACY_PRODUCTS = [
  {
    productId: "prod_TKLt7MXKy8eStk", // "Pro" (legacy)
    priceIds: ["price_1SNhBTRqq8mPUhErD8YLVnzY"], // $15/month
  },
  {
    productId: "prod_TKLsKjYIRzCuYD", // "starter" (legacy)
    priceIds: ["price_1SNhB0Rqq8mPUhErjRRM8N4v"], // $0/month
  },
  {
    productId: "prod_SpUBrzr2mfMdGa", // "Testero Pro" (legacy)
    priceIds: ["price_1RtpDBRqq8mPUhErB7muGjch"], // $549/year
  },
  {
    productId: "prod_SpUAm7kUlnBAdc", // "Testero Pro" (legacy)
    priceIds: ["price_1RtpCcRqq8mPUhErSqm70upQ"], // $59/month
  },
];

async function archiveLegacyProducts() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    console.error("❌ STRIPE_SECRET_KEY environment variable is required");
    console.error("Usage: STRIPE_SECRET_KEY=sk_test_... ts-node scripts/archive-legacy-stripe-products.ts");
    process.exit(1);
  }

  const stripe = new Stripe(stripeSecretKey, {
    // Use the default API version from the Stripe dashboard
    // or specify a valid version via environment variable
    apiVersion: process.env.STRIPE_API_VERSION as Stripe.LatestApiVersion | undefined,
    typescript: true,
  });

  console.log("🔄 Starting legacy product archival process...\n");

  for (const legacy of LEGACY_PRODUCTS) {
    try {
      console.log(`📦 Processing product: ${legacy.productId}`);

      // First, archive all associated prices
      for (const priceId of legacy.priceIds) {
        try {
          console.log(`  📍 Archiving price: ${priceId}`);
          await stripe.prices.update(priceId, {
            active: false,
          });
          console.log(`  ✅ Price ${priceId} archived successfully`);
        } catch (error) {
          if (error instanceof Stripe.errors.StripeError) {
            if (error.code === "resource_missing") {
              console.log(`  ⚠️  Price ${priceId} not found (may already be archived)`);
            } else {
              console.error(`  ❌ Error archiving price ${priceId}:`, error.message);
            }
          } else {
            console.error(`  ❌ Unexpected error archiving price ${priceId}:`, error);
          }
        }
      }

      // Then, archive the product itself
      try {
        await stripe.products.update(legacy.productId, {
          active: false,
        });
        console.log(`✅ Product ${legacy.productId} archived successfully\n`);
      } catch (error) {
        if (error instanceof Stripe.errors.StripeError) {
          if (error.code === "resource_missing") {
            console.log(`⚠️  Product ${legacy.productId} not found (may already be archived)\n`);
          } else {
            console.error(`❌ Error archiving product ${legacy.productId}:`, error.message);
            console.error("   Continuing with next product...\n");
          }
        } else {
          console.error(`❌ Unexpected error archiving product ${legacy.productId}:`, error);
          console.error("   Continuing with next product...\n");
        }
      }
    } catch (error) {
      console.error(`❌ Unexpected error processing ${legacy.productId}:`, error);
      console.error("   Continuing with next product...\n");
    }
  }

  console.log("✨ Legacy product archival process completed!");
  console.log("\n📝 Note: Archived products and prices are still visible in Stripe Dashboard");
  console.log("   but cannot be used for new purchases. Existing subscriptions using");
  console.log("   these prices will continue to work until cancelled.");
}

// Run the script
archiveLegacyProducts().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});

