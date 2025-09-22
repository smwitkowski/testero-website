import type { Meta, StoryObj } from "@storybook/react"

import { PricingCard } from "./PricingCard"

const baseTier = {
  id: "starter",
  name: "Starter",
  description: "Essentials for individual learners preparing for Testero exams.",
  monthlyPrice: 29,
  annualPrice: 290,
  monthlyPriceId: "price_monthly",
  annualPriceId: "price_annual",
  aiCredits: 200,
  features: [
    "Adaptive practice exams",
    "Weekly study plan",
    "Email reminders",
  ],
  highlighted: ["Exam-day readiness checklist"],
  recommended: false,
  savingsPercentage: 20,
}

const recommendedTier = {
  ...baseTier,
  id: "pro",
  name: "Pro",
  monthlyPrice: 59,
  annualPrice: 590,
  aiCredits: 500,
  highlighted: ["1:1 readiness review", "Priority question support"],
  features: [...baseTier.features, "Live cohort workshops"],
  recommended: true,
  savingsPercentage: 25,
}

const meta: Meta<typeof PricingCard> = {
  title: "Pricing/PricingCard",
  component: PricingCard,
  args: {
    billingInterval: "monthly",
    loading: false,
    loadingId: null,
    onCheckout: (priceId: string, tierName: string) => {
      console.log(`Checkout → ${tierName} (${priceId})`)
    },
  },
  argTypes: {
    billingInterval: {
      control: { type: "inline-radio" },
      options: ["monthly", "annual"],
    },
  },
}

export default meta

type Story = StoryObj<typeof meta>

export const Monthly: Story = {
  args: {
    tier: baseTier,
  },
}

export const AnnualRecommended: Story = {
  args: {
    tier: recommendedTier,
    billingInterval: "annual",
  },
}
