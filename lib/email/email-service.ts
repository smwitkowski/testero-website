import { Resend } from "resend";

export class EmailService {
  private resend: Resend;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY || "re_test_key";
    this.resend = new Resend(apiKey);
  }

  async sendPaymentConfirmation(email: string, amount: number, currency: string): Promise<void> {
    try {
      await this.resend.emails.send({
        from: "Testero <noreply@testero.ai>",
        to: email,
        subject: "Payment Confirmation",
        html: `
          <h2>Payment Confirmed</h2>
          <p>Thank you for your payment of ${this.formatCurrency(amount, currency)}.</p>
          <p>Your subscription is now active.</p>
        `,
      });
    } catch (error) {
      console.error("Failed to send payment confirmation email:", error);
      // Don't throw - email failure shouldn't break the webhook
    }
  }

  async sendSubscriptionCancelled(email: string): Promise<void> {
    try {
      await this.resend.emails.send({
        from: "Testero <noreply@testero.ai>",
        to: email,
        subject: "Subscription Cancelled",
        html: `
          <h2>Subscription Cancelled</h2>
          <p>Your subscription has been cancelled and will end at the end of your current billing period.</p>
          <p>You can reactivate your subscription at any time from your dashboard.</p>
        `,
      });
    } catch (error) {
      console.error("Failed to send cancellation email:", error);
    }
  }

  async sendPaymentFailed(email: string): Promise<void> {
    try {
      await this.resend.emails.send({
        from: "Testero <noreply@testero.ai>",
        to: email,
        subject: "Payment Failed",
        html: `
          <h2>Payment Failed</h2>
          <p>We were unable to process your payment. Please update your payment method to continue your subscription.</p>
        `,
      });
    } catch (error) {
      console.error("Failed to send payment failed email:", error);
    }
  }

  private formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  }
}
