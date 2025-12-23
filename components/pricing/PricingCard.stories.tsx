import type { Meta, StoryObj } from "@storybook/react"

import { PricingCard } from "./PricingCard"

const baseTier = {
  id: "starter",
  name: "Starter",
  description: "Essentials for individual learners preparing for Testero exams.",
  monthlyPrice: 29,
  threeMonthPrice: 75,
  monthlyPriceId: "price_monthly",
  threeMonthPriceId: "price_3month",
  features: [
    "Adaptive practice exams",
    "Weekly study plan",
    "Email reminders",
  ],
  highlighted: ["Exam-day readiness checklist"],
  recommended: false,
  savingsPercentage: 15,
}

const recommendedTier = {
  ...baseTier,
  id: "pro",
  name: "Pro",
  monthlyPrice: 59,
  threeMonthPrice: 150,
  highlighted: ["1:1 readiness review", "Priority question support"],
  features: [...baseTier.features, "Live cohort workshops"],
  recommended: true,
  savingsPercentage: 10,
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
      options: ["monthly", "three_month"],
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
    billingInterval: "three_month",
  },
}
