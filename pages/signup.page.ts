import { Page, expect } from '@playwright/test';

export class SignupPage {
  constructor(private page: Page) {}

  async navigateToSignup(): Promise<void> {
    await this.page.goto('/signup'); // SELECTOR: update path if different
  }

  async fillRegistrationForm(email: string, name: string, password: string): Promise<void> {
    await this.page.locator('[data-testid="email"]').fill(email); // SELECTOR
    await this.page.locator('[data-testid="displayname"]').fill(name); // SELECTOR
    await this.page.locator('[data-testid="password"]').fill(password); // SELECTOR
    await this.page.locator('[data-testid="submit"]').click(); // SELECTOR
  }

  async handleLoginIfRequired(email: string, password: string): Promise<void> {
    const loginForm = this.page.locator('[data-testid="login-form"]'); // SELECTOR
    const isVisible = await loginForm.isVisible().catch(() => false);
    if (!isVisible) return;
    await this.page.locator('[data-testid="login-username"]').fill(email); // SELECTOR
    await this.page.locator('[data-testid="login-password"]').fill(password); // SELECTOR
    await this.page.locator('[data-testid="login-button"]').click(); // SELECTOR
  }

  async navigateToSubscription(): Promise<void> {
    await this.page.goto('/premium'); // SELECTOR: update if different
  }

  async selectCarrierBilling(): Promise<void> {
    await this.page.locator('[data-testid="carrier-billing"]').click(); // SELECTOR
  }

  async enterPhoneNumber(phone: string): Promise<void> {
    await this.page.locator('[data-testid="phone-number"]').fill(phone); // SELECTOR
    await this.page.locator('[data-testid="phone-submit"]').click(); // SELECTOR
  }

  async enterOtp(otp: string): Promise<void> {
    await this.page.locator('[data-testid="otp-input"]').fill(otp); // SELECTOR
    await this.page.locator('[data-testid="otp-submit"]').click(); // SELECTOR
  }

  async assertTrialActive(): Promise<void> {
    await expect(
      this.page.locator('[data-testid="trial-active"]') // SELECTOR
    ).toBeVisible({ timeout: 15_000 });
  }
}
