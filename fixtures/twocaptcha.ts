const BASE = 'https://2captcha.com';

// Helper function to create fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = 30000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

export async function solveRecaptchaV2With2Captcha(
  apiKey: string,
  websiteURL: string,
  websiteKey: string
): Promise<string> {
  console.log('🔐 [2CAPTCHA] Creating reCAPTCHA v2 task...');
  console.log('🔑 [2CAPTCHA] API Key length:', apiKey?.length || 0);
  console.log('🔑 [2CAPTCHA] Sitekey:', websiteKey);
  console.log('🌐 [2CAPTCHA] URL:', websiteURL);

  // Validate inputs
  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_2captcha_api_key_here') {
    throw new Error('2Captcha API key is missing or invalid. Please set TWOCAPTCHA_API_KEY in .env file');
  }

  if (!websiteKey || !websiteURL) {
    throw new Error('Missing websiteKey or websiteURL for 2Captcha');
  }

  // Step 1: Submit captcha task
  console.log('📤 [2CAPTCHA] Submitting task...');

  const submitParams = new URLSearchParams({
    key: apiKey,
    method: 'userrecaptcha',
    googlekey: websiteKey,
    pageurl: websiteURL,
    json: '1',
    // Enterprise parameters (if needed)
    // enterprise: '1',
    // invisible: '0',
  });

  let submitResponse: Response;
  try {
    submitResponse = await fetchWithTimeout(
      `${BASE}/in.php?${submitParams.toString()}`,
      { method: 'GET' },
      30000
    );
    console.log('📥 [2CAPTCHA] Received submit response, status:', submitResponse.status);
  } catch (error: any) {
    console.error('❌ [2CAPTCHA] Failed to submit task:', error.message);
    throw new Error(`2Captcha submit request failed: ${error.message}`);
  }

  if (!submitResponse.ok) {
    const errorText = await submitResponse.text().catch(() => 'Unable to read error response');
    console.error('❌ [2CAPTCHA] HTTP error from submit:', submitResponse.status, errorText);
    throw new Error(`2Captcha submit HTTP error: ${submitResponse.status} - ${errorText}`);
  }

  let submitData: any;
  try {
    submitData = await submitResponse.json();
    console.log('📋 [2CAPTCHA] Submit response:', JSON.stringify(submitData, null, 2));
  } catch (error: any) {
    console.error('❌ [2CAPTCHA] Failed to parse submit JSON:', error.message);
    throw new Error(`2Captcha submit invalid JSON response: ${error.message}`);
  }

  // Check for errors
  if (submitData.status !== 1) {
    const errorCode = submitData.request || 'UNKNOWN_ERROR';
    console.error('❌ [2CAPTCHA] Submit failed:', errorCode);
    throw new Error(`2Captcha submit failed: ${errorCode}`);
  }

  const taskId = submitData.request;
  if (!taskId) {
    console.error('❌ [2CAPTCHA] No taskId in response:', submitData);
    throw new Error('2Captcha did not return taskId');
  }

  console.log('✅ [2CAPTCHA] Task created successfully, taskId:', taskId);
  console.log('⏳ [2CAPTCHA] Starting polling (every 5s, recommended by 2Captcha)...');

  // Step 2: Poll for result
  const startTime = Date.now();
  const maxAttempts = 40; // 40 * 5s = 200s = ~3.3 minutes

  // Wait 10 seconds before first poll (2Captcha recommendation)
  console.log('⏳ [2CAPTCHA] Waiting 10s before first poll (2Captcha recommendation)...');
  await new Promise(r => setTimeout(r, 10_000));

  for (let i = 0; i < maxAttempts; i++) {
    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    console.log(`🔄 [2CAPTCHA] Poll attempt ${i + 1}/${maxAttempts} (${elapsedSeconds}s elapsed)...`);

    const pollParams = new URLSearchParams({
      key: apiKey,
      action: 'get',
      id: taskId,
      json: '1',
    });

    let pollResponse: Response;
    try {
      pollResponse = await fetchWithTimeout(
        `${BASE}/res.php?${pollParams.toString()}`,
        { method: 'GET' },
        10000
      );
      console.log(`📡 [2CAPTCHA] Poll response status: ${pollResponse.status}`);
    } catch (error: any) {
      console.warn(`⚠️ [2CAPTCHA] Network error on poll ${i + 1}:`, error.message);
      console.log('🔄 [2CAPTCHA] Retrying next poll cycle...');
      await new Promise(r => setTimeout(r, 5_000));
      continue;
    }

    if (!pollResponse.ok) {
      const errorText = await pollResponse.text().catch(() => 'Unable to read response');
      console.warn(`⚠️ [2CAPTCHA] HTTP ${pollResponse.status} on poll ${i + 1}:`, errorText);
      console.log('🔄 [2CAPTCHA] Retrying next poll cycle...');
      await new Promise(r => setTimeout(r, 5_000));
      continue;
    }

    let pollData: any;
    try {
      const responseText = await pollResponse.text();
      console.log(`📄 [2CAPTCHA] Raw response: ${responseText}`);
      pollData = JSON.parse(responseText);
      console.log(`📋 [2CAPTCHA] Parsed poll response:`, JSON.stringify(pollData, null, 2));
    } catch (error: any) {
      console.error(`❌ [2CAPTCHA] Failed to parse poll JSON on attempt ${i + 1}:`, error.message);
      console.log('🔄 [2CAPTCHA] Retrying next poll cycle...');
      await new Promise(r => setTimeout(r, 5_000));
      continue;
    }

    // Check status
    if (pollData.status === 1) {
      // Success!
      const token = pollData.request;
      if (!token || typeof token !== 'string') {
        console.error('❌ [2CAPTCHA] Status is 1 but no valid token:', pollData);
        throw new Error('2Captcha returned success but no valid token');
      }

      console.log('✅ [2CAPTCHA] Task completed!');
      console.log('🔑 [2CAPTCHA] Token length:', token.length);
      console.log('🔑 [2CAPTCHA] Token preview:', token.substring(0, 50) + '...');
      return token;
    }

    // Check for errors
    if (pollData.request === 'CAPCHA_NOT_READY') {
      console.log('⏳ [2CAPTCHA] Task still processing...');
      await new Promise(r => setTimeout(r, 5_000));
      continue;
    }

    // Other error codes
    if (pollData.status === 0) {
      const errorCode = pollData.request || 'UNKNOWN_ERROR';
      console.error('❌ [2CAPTCHA] API error:', errorCode);

      // Handle specific errors
      if (errorCode === 'ERROR_CAPTCHA_UNSOLVABLE') {
        throw new Error('2Captcha: Captcha is unsolvable (too difficult or broken)');
      } else if (errorCode === 'ERROR_ZERO_BALANCE') {
        throw new Error('2Captcha: Zero balance - please add funds to your account');
      } else if (errorCode === 'ERROR_KEY_DOES_NOT_EXIST') {
        throw new Error('2Captcha: Invalid API key');
      } else {
        throw new Error(`2Captcha API error: ${errorCode}`);
      }
    }

    // Unknown status, continue polling
    console.log(`⚠️ [2CAPTCHA] Unexpected status: ${pollData.status}, continuing...`);
    await new Promise(r => setTimeout(r, 5_000));
  }

  console.error('❌ [2CAPTCHA] Timeout reached after 200 seconds (40 attempts)');
  throw new Error('2Captcha timeout after 200 seconds (40 polling attempts)');
}
