const BASE = 'https://api.capsolver.com';

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

export async function solveRecaptchaV2(
  apiKey: string,
  websiteURL: string,
  websiteKey: string
): Promise<string> {
  console.log('🔐 [CAPSOLVER] Creating task for reCAPTCHA...');
  console.log('🔑 [CAPSOLVER] API Key length:', apiKey?.length || 0);
  console.log('🔑 [CAPSOLVER] Sitekey:', websiteKey);
  console.log('🌐 [CAPSOLVER] URL:', websiteURL);

  // Validate inputs
  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_capsolver_api_key_here') {
    throw new Error('CapSolver API key is missing or invalid. Please set CAPSOLVER_API_KEY in .env file');
  }

  if (!websiteKey || !websiteURL) {
    throw new Error('Missing websiteKey or websiteURL for CapSolver');
  }

  let createRes: Response;
  try {
    console.log('📤 [CAPSOLVER] Sending createTask request...');
    createRes = await fetchWithTimeout(`${BASE}/createTask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientKey: apiKey,
        task: { type: 'ReCaptchaV2TaskProxyLess', websiteURL, websiteKey },
      }),
    }, 30000);
    console.log('📥 [CAPSOLVER] Received createTask response, status:', createRes.status);
  } catch (error: any) {
    console.error('❌ [CAPSOLVER] Failed to create task:', error.message);
    throw new Error(`CapSolver createTask request failed: ${error.message}`);
  }

  if (!createRes.ok) {
    const errorText = await createRes.text().catch(() => 'Unable to read error response');
    console.error('❌ [CAPSOLVER] HTTP error from createTask:', createRes.status, errorText);
    throw new Error(`CapSolver createTask HTTP error: ${createRes.status} - ${errorText}`);
  }

  let createData: any;
  try {
    createData = await createRes.json();
    console.log('📋 [CAPSOLVER] Create task response:', JSON.stringify(createData, null, 2));
  } catch (error: any) {
    console.error('❌ [CAPSOLVER] Failed to parse createTask JSON:', error.message);
    throw new Error(`CapSolver createTask invalid JSON response: ${error.message}`);
  }

  const { errorId, errorCode, errorDescription, taskId } = createData;

  if (errorId !== 0 && errorId !== undefined) {
    console.error('❌ [CAPSOLVER] API returned error:', { errorId, errorCode, errorDescription });
    throw new Error(`CapSolver createTask failed: ${errorCode || 'UNKNOWN'} - ${errorDescription || 'No description'}`);
  }

  if (!taskId) {
    console.error('❌ [CAPSOLVER] No taskId in response:', createData);
    throw new Error('CapSolver createTask did not return taskId');
  }

  console.log('✅ [CAPSOLVER] Task created successfully, taskId:', taskId);
  console.log('⏳ [CAPSOLVER] Starting polling (every 3s, max 3 minutes)...');

  const startTime = Date.now();

  for (let i = 0; i < 60; i++) {
    // Wait before polling (3 seconds for first attempt, standard for CapSolver)
    await new Promise(r => setTimeout(r, 3_000));

    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    console.log(`🔄 [CAPSOLVER] Poll attempt ${i + 1}/60 (${elapsedSeconds}s elapsed)...`);

    let pollRes: Response;
    try {
      pollRes = await fetchWithTimeout(`${BASE}/getTaskResult`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientKey: apiKey, taskId }),
      }, 10000);

      console.log(`📡 [CAPSOLVER] Poll response status: ${pollRes.status}`);
    } catch (error: any) {
      console.warn(`⚠️ [CAPSOLVER] Network error on poll ${i + 1}:`, error.message);
      console.log('🔄 [CAPSOLVER] Retrying next poll cycle...');
      continue; // Network error, try again
    }

    if (!pollRes.ok) {
      const errorText = await pollRes.text().catch(() => 'Unable to read response');
      console.warn(`⚠️ [CAPSOLVER] HTTP ${pollRes.status} on poll ${i + 1}:`, errorText);
      console.log('🔄 [CAPSOLVER] Retrying next poll cycle...');
      continue;
    }

    let pollData: any;
    try {
      const responseText = await pollRes.text();
      console.log(`📄 [CAPSOLVER] Raw response: ${responseText}`);
      pollData = JSON.parse(responseText);
      console.log(`📋 [CAPSOLVER] Parsed poll response:`, JSON.stringify(pollData, null, 2));
    } catch (error: any) {
      console.error(`❌ [CAPSOLVER] Failed to parse poll JSON on attempt ${i + 1}:`, error.message);
      console.log('🔄 [CAPSOLVER] Retrying next poll cycle...');
      continue;
    }

    const { status, solution, errorCode: ec, errorId: eid, errorDescription: ed } = pollData;

    // Check for API errors
    if (eid !== undefined && eid !== 0) {
      console.error('❌ [CAPSOLVER] API error in poll response:', { eid, ec, ed });
      throw new Error(`CapSolver API error: errorId=${eid}, errorCode=${ec || 'UNKNOWN'}, description=${ed || 'None'}`);
    }

    console.log(`📊 [CAPSOLVER] Task status: "${status || 'UNKNOWN'}"`);

    // Handle ready status
    if (status === 'ready') {
      console.log('✅ [CAPSOLVER] Task completed!');

      if (!solution) {
        console.error('❌ [CAPSOLVER] Status is ready but no solution object:', pollData);
        throw new Error('CapSolver returned ready status but no solution object');
      }

      if (!solution.gRecaptchaResponse) {
        console.error('❌ [CAPSOLVER] Solution object exists but no gRecaptchaResponse:', solution);
        throw new Error('CapSolver solution missing gRecaptchaResponse field');
      }

      console.log('🔑 [CAPSOLVER] Token length:', solution.gRecaptchaResponse.length);
      console.log('🔑 [CAPSOLVER] Token preview:', solution.gRecaptchaResponse.substring(0, 50) + '...');
      return solution.gRecaptchaResponse;
    }

    // Handle failed status
    if (status === 'failed') {
      console.error('❌ [CAPSOLVER] Task failed:', { ec, ed });
      throw new Error(`CapSolver task failed: ${ec || 'UNKNOWN_ERROR'} - ${ed || 'No description'}`);
    }

    // Status is 'processing' or other, continue polling
    if (status === 'processing') {
      console.log('⏳ [CAPSOLVER] Task still processing, waiting for next poll...');
    } else {
      console.log(`⚠️ [CAPSOLVER] Unexpected status "${status}", continuing to poll...`);
    }
  }

  console.error('❌ [CAPSOLVER] Timeout reached after 60 attempts (3 minutes)');
  throw new Error('CapSolver timeout after 3 minutes (60 polling attempts). Task may still be processing on CapSolver side.');
}
