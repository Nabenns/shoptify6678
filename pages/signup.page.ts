import { Page, expect } from '@playwright/test';
import { solveRecaptchaV2 } from '../fixtures/capsolver';

export class SignupPage {
  constructor(private page: Page, private capsolverKey: string) {}

  async navigateToSignup(): Promise<void> {
    await this.page.goto('/cl/premium/');
    await this.page.getByRole('link', { name: 'Finalizar la compra de' }).click();
    await this.page.waitForURL(/accounts\.spotify\.com/, { timeout: 15_000 });
    await this.page.getByTestId('signup-btn-link').click();
    await this.page.waitForURL(/\/cl\/signup/, { timeout: 15_000 });
  }

  async fillRegistrationForm(email: string, name: string, password: string): Promise<void> {
    // Wait for page to settle then nuke cookie banner + any overlay via JS
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.evaluate(() => {
      ['#onetrust-banner-sdk', '#onetrust-consent-sdk', '.onetrust-pc-dark-filter',
        '#onetrust-overlay', '#onetrust-backdrop', '#onetrust-group-container'].forEach(sel => {
        document.querySelectorAll<HTMLElement>(sel).forEach(el => {
          el.style.setProperty('display', 'none', 'important');
        });
      });
    });

    // Step 1: Email — waitFor ensures element is in DOM, then dispatchEvent bypasses any remaining overlay
    await this.page.getByRole('textbox', { name: 'Email address' }).waitFor();
    await this.page.getByRole('textbox', { name: 'Email address' }).fill(email);
    await this.page.getByRole('button', { name: 'Next' }).waitFor();
    await this.page.getByRole('button', { name: 'Next' }).dispatchEvent('click');

    // Step 2: Password
    await this.page.locator('input[type="password"]').waitFor();
    await this.page.locator('input[type="password"]').fill(password);
    await this.page.getByRole('button', { name: 'Next' }).waitFor();
    await this.page.getByRole('button', { name: 'Next' }).dispatchEvent('click');

    // Step 3: Profile — name, birthday, gender
    await this.page.getByRole('textbox', { name: 'Name' }).fill(name);
    await this.page.getByTestId('birthDateDay').fill('2');
    await this.page.getByTestId('birthDateMonth').selectOption('11');
    await this.page.getByTestId('birthDateYear').fill('2000');
    await this.page.locator('label').filter({ hasText: /^Man$/ }).click();
    await this.page.getByTestId('submit').click();

    // Step 4: Consent / terms step
    await this.page.getByTestId('submit').click();

    // Step 5: reCAPTCHA on challenge.spotify.com
    await this._solveCaptchaIfRequired();
  }

  private async _solveCaptchaIfRequired(): Promise<void> {
    try {
      await this.page.waitForURL('**/challenge**', { timeout: 8_000 });
    } catch {
      return;
    }

    const sitekey = await this.page.$eval(
      '.g-recaptcha, [data-sitekey]',
      (el: Element) => el.getAttribute('data-sitekey') ?? ''
    );
    if (!sitekey) throw new Error('reCAPTCHA sitekey not found on challenge page');

    const token = await solveRecaptchaV2(this.capsolverKey, this.page.url(), sitekey);

    await this.page.evaluate((t: string) => {
      document
        .querySelectorAll<HTMLTextAreaElement>('#g-recaptcha-response, [name="g-recaptcha-response"]')
        .forEach(el => {
          Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(el, t);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }, token);

    await this.page.getByRole('button', { name: 'Continue' }).click();
    // After captcha solve, Spotify redirects to payments checkout
    await this.page.waitForURL(/payments\.spotify\.com/, { timeout: 30_000 });
  }

  async handleLoginIfRequired(email: string, password: string): Promise<void> {
    const loginForm = this.page.locator('[data-testid="login-form"]');
    if (!await loginForm.isVisible().catch(() => false)) return;
    await this.page.locator('[data-testid="login-username"]').fill(email);
    await this.page.locator('[data-testid="login-password"]').fill(password);
    await this.page.locator('[data-testid="login-button"]').click();
  }

  async navigateToSubscription(): Promise<void> {
    // After signup + captcha, Spotify auto-redirects to payments checkout
    await this.page.waitForURL(/payments\.spotify\.com/, { timeout: 30_000 });
  }

  async selectCarrierBilling(): Promise<void> {
    await this.page.getByRole('option', { name: 'Carrier billing' }).click();
  }

  async enterPhoneNumber(phone: string): Promise<void> {
    await this.page.getByRole('textbox', { name: 'Mobile number' }).fill(phone);
    await this.page.getByRole('button', { name: 'Complete purchase' }).click();
  }

  async enterOtp(otp: string): Promise<void> {
    await this.page.getByRole('textbox', { name: 'PIN' }).fill(otp);
    await this.page.getByRole('button', { name: 'Continue' }).click();
  }

  async assertTrialActive(): Promise<void> {
    // SELECTOR: run codegen after PIN entry to get real success page selector
    await expect(
      this.page.locator('[data-testid="trial-active"]')
    ).toBeVisible({ timeout: 15_000 });
  }
}
