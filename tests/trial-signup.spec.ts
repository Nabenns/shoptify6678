import { test } from '@playwright/test';
import { faker } from '@faker-js/faker';
import { getNumber, pollOtp, cancelActivation } from '../fixtures/otpku';
import { SignupPage } from '../pages/signup.page';
import { appendResult } from '../utils/reporter';

const API_KEY = process.env.OTP_API_KEY!;
const SERVICE = process.env.OTP_SERVICE_CODE!;
const COUNTRY = process.env.OTP_COUNTRY!;
const MAX_RETRIES = 3;

for (const instanceNum of [1, 2, 3]) {
  test(`trial signup - instance ${instanceNum}`, async ({ page }) => {
    const email = `${faker.string.alphanumeric(8).toLowerCase()}@forapps.site`;
    const name = faker.person.fullName();
    const password = `Spotify@${faker.string.alphanumeric(8)}1`;
    const signupPage = new SignupPage(page);

    let activationId: string | null = null;
    let phone: string | null = null;
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const numResult = await getNumber(API_KEY, SERVICE, COUNTRY);
        activationId = numResult.id;
        phone = numResult.number;

        await signupPage.navigateToSignup();
        await signupPage.fillRegistrationForm(email, name, password);
        await signupPage.handleLoginIfRequired(email, password);
        await signupPage.navigateToSubscription();
        await signupPage.selectCarrierBilling();
        await signupPage.enterPhoneNumber(phone);

        const otp = await pollOtp(API_KEY, activationId);
        await signupPage.enterOtp(otp);
        await signupPage.assertTrialActive();

        appendResult({
          instance: instanceNum,
          email,
          phone,
          status: 'trial_active',
          timestamp: new Date().toISOString(),
        });
        return;
      } catch (err) {
        lastError = err;
        if (activationId) {
          await cancelActivation(API_KEY, activationId).catch(() => {});
          activationId = null;
        }
      }
    }

    appendResult({
      instance: instanceNum,
      email,
      phone: phone ?? 'N/A',
      status: 'failed',
      error: String(lastError),
      timestamp: new Date().toISOString(),
    });

    throw lastError;
  });
}
