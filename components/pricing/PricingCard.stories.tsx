import type { Meta, StoryObj } from "@storybook/react";
import { PricingCard } from "./PricingCard";

const meta: Meta<typeof PricingCard> = {
  title: "Pricing/PricingCard",
  component: PricingCard,
  args: { loading: false, onCheckout: () => console.log("Checkout → PMLE Pass") },
};
export default meta;
type Story = StoryObj<typeof meta>;
export const Pass: Story = {};
export const CheckoutLoading: Story = { args: { loading: true } };
