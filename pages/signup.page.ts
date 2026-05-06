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
    console.log('🔄 [SIGNUP] Starting fillRegistrationForm...');
    // Wait for page to settle
    await this.page.waitForLoadState('domcontentloaded');
    console.log('✅ [SIGNUP] Page loaded');

    // Step 1: Email
    console.log('📧 [STEP 1] Filling email:', email);
    await this.page.getByRole('textbox', { name: 'Email address' }).fill(email);
    console.log('✅ [STEP 1] Email filled');
    await this.page.waitForTimeout(1000); // Wait after filling before clicking
    console.log('🖱️ [STEP 1] Clicking submit button (1st click)');
    await this.page.getByTestId('submit').click();

    // Wait and check if password field appeared (means first click worked)
    console.log('⏳ [STEP 1] Waiting 2s to check if page progressed...');
    await this.page.waitForTimeout(2000);

    const passwordFieldVisible = await this.page.locator('input[type="password"]').isVisible().catch(() => false);
    if (!passwordFieldVisible) {
      console.log('🖱️ [STEP 1] Password field not visible, clicking submit again (2nd click)');
      await this.page.getByTestId('submit').click();
      console.log('✅ [STEP 1] Second click done');
    } else {
      console.log('✅ [STEP 1] Password field already visible, skipping 2nd click');
    }

    // Step 2: Password
    console.log('🔐 [STEP 2] Looking for password field...');
    const passwordField = this.page.locator('input[type="password"]').or(this.page.getByRole('textbox', { name: 'Use tab to navigate to the' }));
    await passwordField.waitFor({ timeout: 10000 });
    console.log('✅ [STEP 2] Password field found');
    console.log('🔐 [STEP 2] Filling password');
    await passwordField.fill(password);
    console.log('✅ [STEP 2] Password filled');
    await this.page.waitForTimeout(1000); // Wait after filling before clicking
    console.log('🖱️ [STEP 2] Clicking submit (1st click)');
    await this.page.getByTestId('submit').click();

    // Wait and check if name field appeared (step 3)
    console.log('⏳ [STEP 2] Waiting 2s to check if page progressed...');
    await this.page.waitForTimeout(2000);

    const nameFieldVisible = await this.page.getByRole('textbox', { name: 'Name' }).isVisible().catch(() => false);
    if (!nameFieldVisible) {
      console.log('🖱️ [STEP 2] Name field not visible, clicking submit again (2nd click)');
      await this.page.getByTestId('submit').click();
      console.log('✅ [STEP 2] Second click done');
    } else {
      console.log('✅ [STEP 2] Name field already visible, skipping 2nd click');
    }

    // Step 3: Profile — name, birthday, gender
    console.log('👤 [STEP 3] Filling name:', name);
    await this.page.getByRole('textbox', { name: 'Name' }).waitFor({ timeout: 10000 });
    await this.page.getByRole('textbox', { name: 'Name' }).fill(name);
    console.log('📅 [STEP 3] Filling birth date: 2/1/1999');
    await this.page.getByTestId('birthDateDay').fill('2');
    await this.page.getByTestId('birthDateMonth').selectOption('1');
    await this.page.getByTestId('birthDateYear').fill('1999');
    console.log('⚧️ [STEP 3] Selecting gender: Man');
    await this.page.locator('div').filter({ hasText: /^Man$/ }).click();
    await this.page.waitForTimeout(1000); // Wait after filling all fields before clicking
    console.log('🖱️ [STEP 3] Clicking submit (1st click)');
    await this.page.getByTestId('submit').click();

    // Wait and check if consent checkboxes appeared (step 4)
    console.log('⏳ [STEP 3] Waiting 2s to check if page progressed...');
    await this.page.waitForTimeout(2000);

    // Check multiple possible indicators that we moved to next page
    const consentVisible = await this.page.locator('.Indicator-sc-1airx73-0').isVisible().catch(() => false);
    const submitStillVisible = await this.page.getByTestId('submit').isVisible().catch(() => false);

    if (!consentVisible && submitStillVisible) {
      console.log('🖱️ [STEP 3] Consent checkboxes not visible, clicking submit again (2nd click)');
      await this.page.getByTestId('submit').click();
      console.log('✅ [STEP 3] Second click done');
      await this.page.waitForTimeout(2000); // Wait again after 2nd click
    } else {
      console.log('✅ [STEP 3] Consent page already visible, skipping 2nd click');
    }

    // Step 4: Consent / terms step - might auto-skip to reCAPTCHA
    console.log('☑️ [STEP 4] Checking for consent page...');

    // Sometimes Spotify skips consent page and goes straight to reCAPTCHA
    // Check if we're already at reCAPTCHA
    const alreadyAtCaptcha = this.page.url().includes('challenge.spotify.com');
    if (alreadyAtCaptcha) {
      console.log('✅ [STEP 4] Already at reCAPTCHA page, skipping consent step');
    } else {
      // Try to handle consent checkboxes if present
      try {
        console.log('⏳ [STEP 4] Waiting for consent checkboxes...');
        const hasCheckboxes = await this.page.locator('.Indicator-sc-1airx73-0').first().isVisible({ timeout: 3000 }).catch(() => false);

        if (hasCheckboxes) {
          console.log('✅ [STEP 4] Checkboxes found, clicking them...');
          // Click checkboxes - might trigger navigation to reCAPTCHA
          await this.page.locator('.Indicator-sc-1airx73-0').first().click().catch(() => {
            console.log('⚠️ [STEP 4] First checkbox click failed (page might have navigated)');
          });

          // Only try second checkbox if page didn't navigate
          if (!this.page.url().includes('challenge.spotify.com')) {
            await this.page.locator('div:nth-child(2) > .Checkbox-sc-svpvf6-0 > .Label-sc-cpoq-0 > .Indicator-sc-1airx73-0').click({ timeout: 2000 }).catch(() => {
              console.log('⚠️ [STEP 4] Second checkbox not found or page navigated');
            });
          }

          // Try to submit if still on consent page
          if (!this.page.url().includes('challenge.spotify.com')) {
            console.log('🖱️ [STEP 4] Clicking submit...');
            await this.page.getByTestId('submit').click();
            await this.page.waitForTimeout(1000);
          }
        } else {
          console.log('⚠️ [STEP 4] No checkboxes found, might have auto-progressed');
        }
      } catch (e: any) {
        console.log('⚠️ [STEP 4] Consent step error (might be normal):', e.message);
      }
    }

    console.log('✅ [STEP 4] Consent step completed, current URL:', this.page.url());

    // Step 5: reCAPTCHA on challenge.spotify.com
    console.log('🔐 [STEP 5] Checking for reCAPTCHA...');
    await this._solveCaptchaIfRequired();
    console.log('✅ [SIGNUP] fillRegistrationForm completed!');
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
