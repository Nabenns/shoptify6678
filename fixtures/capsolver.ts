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

    const pollRes = await fetch(`${BASE}/getTaskResult`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientKey: apiKey, taskId }),
    });
    const pollData = (await pollRes.json()) as any;
    const { status, solution, errorCode: ec } = pollData;

    console.log(`📊 [CAPSOLVER] Status: ${status}`);

    if (status === 'ready') {
      console.log('✅ [CAPSOLVER] Solution received!');
      return solution.gRecaptchaResponse;
    }
    if (status === 'failed') throw new Error(`CapSolver task failed: ${ec}`);
  }
  throw new Error('CapSolver timeout after 3 minutes');
}
