import { Page, expect } from '@playwright/test';
import { solveRecaptchaV2 } from '../fixtures/capsolver';
import { solveRecaptchaV2With2Captcha } from '../fixtures/twocaptcha';

export class SignupPage {
  constructor(
    private page: Page,
    private capsolverKey: string,
    private twoCaptchaKey?: string
  ) {}

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

    // Generate random birth date (1995-2000)
    const birthYear = Math.floor(Math.random() * 6) + 1995; // Random 1995-2000
    const birthMonth = Math.floor(Math.random() * 12) + 1; // Random 1-12
    const birthDay = Math.floor(Math.random() * 28) + 1; // Random 1-28 (safe for all months)

    console.log(`📅 [STEP 3] Filling birth date: ${birthDay}/${birthMonth}/${birthYear}`);
    await this.page.getByTestId('birthDateDay').fill(String(birthDay));
    await this.page.getByTestId('birthDateMonth').selectOption(String(birthMonth));
    await this.page.getByTestId('birthDateYear').fill(String(birthYear));
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
    console.log('☑️ [STEP 4] Checking current page...');
    console.log('🔍 [STEP 4] Current URL:', this.page.url());

    // Wait a bit to let any auto-navigation happen
    await this.page.waitForTimeout(2000);
    console.log('🔍 [STEP 4] URL after wait:', this.page.url());

    // Check if we're already at reCAPTCHA (might auto-navigate)
    if (this.page.url().includes('challenge.spotify.com')) {
      console.log('✅ [STEP 4] Already at reCAPTCHA page, skipping consent step entirely');
    } else {
      console.log('⏳ [STEP 4] Not at reCAPTCHA yet, will try to proceed...');

      // Try to handle consent checkboxes if present
      try {
        // Check if there's a submit button
        const submitButton = this.page.getByTestId('submit');
        const hasSubmitButton = await submitButton.isVisible({ timeout: 2000 }).catch(() => false);

        if (hasSubmitButton) {
          console.log('✅ [STEP 4] Submit button found on consent page');

          // Check if there are checkboxes
          const checkboxes = this.page.locator('input[type="checkbox"]');
          const checkboxCount = await checkboxes.count();
          console.log(`📋 [STEP 4] Found ${checkboxCount} checkboxes`);

          // If there are checkboxes, click them all
          if (checkboxCount > 0) {
            console.log('🖱️ [STEP 4] Clicking all checkboxes...');
            for (let i = 0; i < checkboxCount; i++) {
              try {
                const checkbox = checkboxes.nth(i);
                const isChecked = await checkbox.isChecked().catch(() => false);
                if (!isChecked) {
                  await checkbox.click({ force: true });
                  console.log(`✅ [STEP 4] Clicked checkbox ${i + 1}/${checkboxCount}`);
                  await this.page.waitForTimeout(200);
                }
              } catch (e: any) {
                console.log(`⚠️ [STEP 4] Failed to click checkbox ${i + 1}:`, e.message);
              }
            }
          } else {
            console.log('ℹ️ [STEP 4] No checkboxes found, will try submit anyway');
          }

          // Now click submit button with navigation wait
          console.log('🖱️ [STEP 4] Clicking submit button...');

          // Use Promise.race to handle both click and navigation
          await Promise.race([
            submitButton.click(),
            this.page.waitForURL('**/challenge**', { timeout: 8000 }).then(() => {
              console.log('✅ [STEP 4] Navigation to reCAPTCHA detected during click');
            })
          ]).catch(() => {
            console.log('⚠️ [STEP 4] Click or navigation timeout');
          });

          // Wait a bit more and check URL
          await this.page.waitForTimeout(2000);
          console.log('🔍 [STEP 4] URL after submit:', this.page.url());

          // If still not at reCAPTCHA, wait longer
          if (!this.page.url().includes('challenge.spotify.com')) {
            console.log('⏳ [STEP 4] Still not at reCAPTCHA, waiting 5 more seconds...');
            await this.page.waitForTimeout(5000);
            console.log('🔍 [STEP 4] Final URL:', this.page.url());
          } else {
            console.log('✅ [STEP 4] Successfully at reCAPTCHA page');
          }
        } else {
          console.log('⚠️ [STEP 4] No submit button found, might have auto-progressed');
          await this.page.waitForTimeout(3000);
        }
      } catch (e: any) {
        console.log('⚠️ [STEP 4] Consent step error:', e.message);
        console.log('🔍 [STEP 4] Current URL after error:', this.page.url());
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

    console.log('⏳ [CAPTCHA] Waiting for reCAPTCHA to fully render...');

    // Wait for reCAPTCHA iframe to load
    try {
      await this.page.waitForSelector('iframe[src*="recaptcha"]', { timeout: 10_000 });
      console.log('✅ [CAPTCHA] reCAPTCHA iframe found');
    } catch {
      console.log('⚠️ [CAPTCHA] reCAPTCHA iframe not found, continuing anyway...');
    }

    // Wait for reCAPTCHA checkbox to be visible
    try {
      await this.page.waitForSelector('.g-recaptcha, [data-sitekey]', { timeout: 10_000 });
      console.log('✅ [CAPTCHA] reCAPTCHA widget visible');
    } catch {
      console.log('⚠️ [CAPTCHA] reCAPTCHA widget not visible');
    }

    // Additional wait to ensure reCAPTCHA is fully loaded
    console.log('⏳ [CAPTCHA] Waiting 3s for reCAPTCHA to fully initialize...');
    await this.page.waitForTimeout(3000);

    console.log('🔍 [CAPTCHA] Extracting sitekey...');

    let sitekey: string = '';
    try {
      sitekey = await this.page.$eval(
        '.g-recaptcha, [data-sitekey]',
        (el: Element) => el.getAttribute('data-sitekey') ?? ''
      );
    } catch (e: any) {
      console.log('❌ [CAPTCHA] Error extracting sitekey with first selector:', e.message);

      // Try alternative selector
      try {
        sitekey = await this.page.evaluate(() => {
          const el = document.querySelector('[data-sitekey]');
          return el?.getAttribute('data-sitekey') || '';
        });
      } catch (e2: any) {
        console.log('❌ [CAPTCHA] Error with alternative selector:', e2.message);
      }
    }

    if (!sitekey) {
      console.log('❌ [CAPTCHA] Sitekey not found, trying to find it in page source...');
      const pageContent = await this.page.content();
      const match = pageContent.match(/data-sitekey="([^"]+)"/);
      if (match && match[1]) {
        sitekey = match[1];
        console.log('✅ [CAPTCHA] Found sitekey in page source');
      } else {
        throw new Error('reCAPTCHA sitekey not found on challenge page');
      }
    }

    console.log('✅ [CAPTCHA] Sitekey extracted:', sitekey);

    // Use 2Captcha directly (skip CapSolver)
    let autoSolveSuccess = false;
    let token: string | null = null;

    if (this.twoCaptchaKey && this.twoCaptchaKey !== 'your_2captcha_api_key_here') {
      console.log('🤖 [CAPTCHA] Using 2Captcha to solve reCAPTCHA...');
      console.log('🚀 [CAPTCHA] Calling 2Captcha API...');

      try {
        token = await solveRecaptchaV2With2Captcha(this.twoCaptchaKey, this.page.url(), sitekey);
        console.log('✅ [2CAPTCHA] Token received, length:', token.length);

        // Inject token into page
        console.log('💉 [2CAPTCHA] Injecting token into page...');
        await this.page.evaluate((t: string) => {
          document
            .querySelectorAll<HTMLTextAreaElement>('#g-recaptcha-response, [name="g-recaptcha-response"]')
            .forEach(el => {
              el.value = t;
              el.innerHTML = t;
              Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(el, t);
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            });
        }, token);

        console.log('✅ [2CAPTCHA] Token injected');
        await this.page.waitForTimeout(1000);

        // Try clicking Continue button
        console.log('🖱️ [2CAPTCHA] Attempting to click Continue button...');
        const continueButton = this.page.getByRole('button', { name: 'Continue' });
        await continueButton.click({ timeout: 3000 });

        // Wait a bit to see if it worked
        await this.page.waitForTimeout(3000);

        // Check if we navigated away (success) or still on challenge page (failed)
        if (this.page.url().includes('challenge.spotify.com')) {
          console.log('⚠️ [2CAPTCHA] Spotify rejected the token - trying manual intervention');
          autoSolveSuccess = false;
        } else {
          console.log('✅ [2CAPTCHA] 2Captcha solve succeeded!');
          autoSolveSuccess = true;
        }
      } catch (e: any) {
        console.log('⚠️ [2CAPTCHA] 2Captcha error:', e.message);
        autoSolveSuccess = false;
      }
    } else {
      console.log('⚠️ [CAPTCHA] No 2Captcha API key found, will use manual intervention');
      autoSolveSuccess = false;
    }

    // If automated solve failed, fall back to manual intervention
    if (!autoSolveSuccess) {
      console.log('');
      console.log('┌─────────────────────────────────────────────────────────────┐');
      console.log('│  ⏸️  MANUAL INTERVENTION REQUIRED                           │');
      console.log('├─────────────────────────────────────────────────────────────┤');
      console.log('│                                                             │');
      console.log('│  Spotify\'s reCAPTCHA cannot be solved automatically.       │');
      console.log('│                                                             │');
      console.log('│  📋 INSTRUCTIONS:                                           │');
      console.log('│  1. Look at the browser window                              │');
      console.log('│  2. Click the reCAPTCHA checkbox ("I\'m not a robot")       │');
      console.log('│  3. Complete any image challenges if prompted               │');
      console.log('│  4. Wait for green checkmark to appear                      │');
      console.log('│  5. Click the "Continue" button                             │');
      console.log('│                                                             │');
      console.log('│  ⏱️  The bot will automatically continue after you          │');
      console.log('│      navigate away from the reCAPTCHA page.                 │');
      console.log('│                                                             │');
      console.log('└─────────────────────────────────────────────────────────────┘');
      console.log('');

      // Wait for user to manually solve and navigate away from challenge page
      console.log('⏳ [CAPTCHA] Waiting for manual solve (checking every 2 seconds)...');

      let manualSolved = false;
      let attempts = 0;
      const maxAttempts = 150; // 5 minutes max (150 * 2 seconds)

      while (!manualSolved && attempts < maxAttempts) {
        await this.page.waitForTimeout(2000);
        attempts++;

        const currentUrl = this.page.url();

        // Check if user navigated away from challenge page
        if (!currentUrl.includes('challenge.spotify.com')) {
          manualSolved = true;
          console.log('✅ [CAPTCHA] Manual solve detected! Continuing automation...');
          break;
        }

        // Progress indicator every 10 attempts (20 seconds)
        if (attempts % 10 === 0) {
          const elapsed = attempts * 2;
          console.log(`⏳ [CAPTCHA] Still waiting... (${elapsed}s elapsed)`);
        }
      }

      if (!manualSolved) {
        throw new Error('Manual reCAPTCHA solve timeout after 5 minutes');
      }
    }

    // After captcha solve (either automated or manual), verify we're on payments page
    console.log('⏳ [CAPTCHA] Verifying navigation to payments page...');

    if (!this.page.url().includes('payments.spotify.com')) {
      console.log('⏳ [CAPTCHA] Not on payments page yet, waiting up to 30s...');
      try {
        await this.page.waitForURL(/payments\.spotify\.com/, { timeout: 30_000 });
        console.log('✅ [CAPTCHA] Successfully on payments page');
      } catch {
        console.log('⚠️ [CAPTCHA] Timeout waiting for payments page');
        console.log('🔍 [CAPTCHA] Current URL:', this.page.url());

        // Don't throw error, maybe we're on a different page that's also valid
        if (!this.page.url().includes('spotify.com')) {
          throw new Error('Navigation failed - not on Spotify domain');
        }
      }
    } else {
      console.log('✅ [CAPTCHA] Already on payments page');
    }
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
