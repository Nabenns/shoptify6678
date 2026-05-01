import { Page, expect } from '@playwright/test';

export class SignupPage {
  constructor(private page: Page) {}

  async navigateToSignup(): Promise<void> {
    await this.page.goto('/signup'); // SELECTOR: update path if different
  }

  async fillRegistrationForm(email: string, name: string, password: string): Promise<void> {
    await this.page.fill('[data-testid="email"]', email); // SELECTOR
    await this.page.fill('[data-testid="displayname"]', name); // SELECTOR
    await this.page.fill('[data-testid="password"]', password); // SELECTOR
    await this.page.click('[data-testid="submit"]'); // SELECTOR
  }

  async handleLoginIfRequired(email: string, password: string): Promise<void> {
    const loginForm = this.page.locator('[data-testid="login-form"]'); // SELECTOR
    const isVisible = await loginForm.isVisible().catch(() => false);
    if (!isVisible) return;
    await this.page.fill('[data-testid="login-username"]', email); // SELECTOR
    await this.page.fill('[data-testid="login-password"]', password); // SELECTOR
    await this.page.click('[data-testid="login-button"]'); // SELECTOR
  }

  async navigateToSubscription(): Promise<void> {
    await this.page.goto('/premium'); // SELECTOR: update if different
  }

  async selectCarrierBilling(): Promise<void> {
    await this.page.click('[data-testid="carrier-billing"]'); // SELECTOR
  }

  async enterPhoneNumber(phone: string): Promise<void> {
    await this.page.fill('[data-testid="phone-number"]', phone); // SELECTOR
    await this.page.click('[data-testid="phone-submit"]'); // SELECTOR
  }

  async enterOtp(otp: string): Promise<void> {
    await this.page.fill('[data-testid="otp-input"]', otp); // SELECTOR
    await this.page.click('[data-testid="otp-submit"]'); // SELECTOR
  }

  async assertTrialActive(): Promise<void> {
    await expect(
      this.page.locator('[data-testid="trial-active"]') // SELECTOR
    ).toBeVisible({ timeout: 15_000 });
  }
}
