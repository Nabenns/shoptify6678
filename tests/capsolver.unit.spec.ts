import { test, expect } from '@playwright/test';
import { solveRecaptchaV2 } from '../fixtures/capsolver';

test.describe('CapSolver Unit Tests', () => {
  const apiKey = process.env.CAPSOLVER_API_KEY || '';

  test('should reject if API key is missing', async () => {
    await expect(
      solveRecaptchaV2('', 'https://example.com', '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI')
    ).rejects.toThrow('API key is missing or invalid');
  });

  test('should reject if API key is placeholder', async () => {
    await expect(
      solveRecaptchaV2(
        'your_capsolver_api_key_here',
        'https://example.com',
        '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'
      )
    ).rejects.toThrow('API key is missing or invalid');
  });

  test('should reject if websiteKey is missing (with valid API key)', async () => {
    // Need to use a non-placeholder API key for this test
    const testKey = 'CAP-TEST1234567890123456789012'; // Format looks valid but won't work
    await expect(
      solveRecaptchaV2(testKey, 'https://example.com', '')
    ).rejects.toThrow('Missing websiteKey or websiteURL');
  });

  test('should reject if websiteURL is missing (with valid API key)', async () => {
    // Need to use a non-placeholder API key for this test
    const testKey = 'CAP-TEST1234567890123456789012'; // Format looks valid but won't work
    await expect(
      solveRecaptchaV2(testKey, '', '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI')
    ).rejects.toThrow('Missing websiteKey or websiteURL');
  });

  test.skip('should successfully solve a test reCAPTCHA (requires valid API key and balance)', async () => {
    // This test is skipped by default because it requires:
    // 1. Valid CapSolver API key
    // 2. Balance in CapSolver account
    // 3. May take 10-60 seconds to complete
    //
    // To run this test:
    // 1. Ensure .env has valid CAPSOLVER_API_KEY
    // 2. Run: npx playwright test capsolver.unit.spec.ts --grep "successfully solve"

    test.setTimeout(120000); // 2 minutes timeout

    // Using Google's test reCAPTCHA sitekey (always returns success)
    const testSiteKey = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';
    const testURL = 'https://www.google.com/recaptcha/api2/demo';

    console.log('⏳ Testing CapSolver with real API...');
    console.log('🔑 API Key:', apiKey ? `${apiKey.substring(0, 8)}...` : 'NOT SET');

    const token = await solveRecaptchaV2(apiKey, testURL, testSiteKey);

    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(100);
    console.log('✅ Token received, length:', token.length);
  });

  test('should handle API error responses gracefully', async () => {
    // Using invalid API key should trigger proper error handling
    const invalidKey = 'CAP-INVALID123456789';
    const testSiteKey = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';
    const testURL = 'https://www.google.com/recaptcha/api2/demo';

    test.setTimeout(30000); // 30 seconds should be enough to get error

    await expect(
      solveRecaptchaV2(invalidKey, testURL, testSiteKey)
    ).rejects.toThrow(); // Should throw some error (likely auth error)
  });

  test('should log API key length for debugging', async () => {
    console.log('🔍 Environment check:');
    console.log('   CAPSOLVER_API_KEY set:', !!apiKey);
    console.log('   CAPSOLVER_API_KEY length:', apiKey?.length || 0);
    console.log('   CAPSOLVER_API_KEY preview:', apiKey ? `${apiKey.substring(0, 8)}...` : 'NOT SET');

    expect(apiKey).toBeTruthy(); // Will fail if not set, reminding you to configure .env
  });
});
