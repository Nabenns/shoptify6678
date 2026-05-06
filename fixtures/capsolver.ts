const BASE = 'https://api.capsolver.com';

export async function solveRecaptchaV2(
  apiKey: string,
  websiteURL: string,
  websiteKey: string
): Promise<string> {
  console.log('🔐 [CAPSOLVER] Creating task for reCAPTCHA...');
  console.log('🔑 [CAPSOLVER] Sitekey:', websiteKey);
  console.log('🌐 [CAPSOLVER] URL:', websiteURL);

  const createRes = await fetch(`${BASE}/createTask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientKey: apiKey,
      task: { type: 'ReCaptchaV2TaskProxyLess', websiteURL, websiteKey },
    }),
  });

  const createData = (await createRes.json()) as any;
  console.log('📋 [CAPSOLVER] Create task response:', createData);

  const { errorId, errorCode, taskId } = createData;
  if (errorId !== 0) throw new Error(`CapSolver createTask failed: ${errorCode}`);

  console.log('✅ [CAPSOLVER] Task created, taskId:', taskId);
  console.log('⏳ [CAPSOLVER] Waiting for solution (polling every 3s, max 3 minutes)...');

  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 3_000));
    console.log(`🔄 [CAPSOLVER] Poll attempt ${i + 1}/60...`);

    try {
      const pollRes = await fetch(`${BASE}/getTaskResult`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientKey: apiKey, taskId }),
      });

      if (!pollRes.ok) {
        console.log(`⚠️ [CAPSOLVER] HTTP error: ${pollRes.status} ${pollRes.statusText}`);
        continue;
      }

      const pollData = (await pollRes.json()) as any;
      console.log(`📋 [CAPSOLVER] Poll response:`, JSON.stringify(pollData));

      const { status, solution, errorCode: ec, errorId: eid } = pollData;

      if (eid && eid !== 0) {
        throw new Error(`CapSolver API error: errorId=${eid}, errorCode=${ec}`);
      }

      console.log(`📊 [CAPSOLVER] Status: ${status || 'unknown'}`);

      if (status === 'ready') {
        if (!solution || !solution.gRecaptchaResponse) {
          throw new Error('CapSolver returned ready but no solution found');
        }
        console.log('✅ [CAPSOLVER] Solution received!');
        console.log('🔑 [CAPSOLVER] Token preview:', solution.gRecaptchaResponse.substring(0, 50) + '...');
        return solution.gRecaptchaResponse;
      }

      if (status === 'failed') {
        throw new Error(`CapSolver task failed: ${ec || 'unknown error'}`);
      }

      // Status is 'processing' or 'idle', continue polling
    } catch (error: any) {
      console.log(`❌ [CAPSOLVER] Error during poll ${i + 1}:`, error.message);
      // If it's a network error, continue trying. If it's a task error, throw it.
      if (error.message.includes('task failed') || error.message.includes('API error')) {
        throw error;
      }
      // Otherwise continue polling
    }
  }
  throw new Error('CapSolver timeout after 3 minutes (60 attempts)');
}
