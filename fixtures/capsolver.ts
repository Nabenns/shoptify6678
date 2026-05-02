const BASE = 'https://api.capsolver.com';

export async function solveRecaptchaV2(
  apiKey: string,
  websiteURL: string,
  websiteKey: string
): Promise<string> {
  const createRes = await fetch(`${BASE}/createTask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientKey: apiKey,
      task: { type: 'ReCaptchaV2TaskProxyLess', websiteURL, websiteKey },
    }),
  });

  const { errorId, errorCode, taskId } = (await createRes.json()) as any;
  if (errorId !== 0) throw new Error(`CapSolver createTask failed: ${errorCode}`);

  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 3_000));
    const pollRes = await fetch(`${BASE}/getTaskResult`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientKey: apiKey, taskId }),
    });
    const { status, solution, errorCode: ec } = (await pollRes.json()) as any;
    if (status === 'ready') return solution.gRecaptchaResponse;
    if (status === 'failed') throw new Error(`CapSolver task failed: ${ec}`);
  }
  throw new Error('CapSolver timeout after 3 minutes');
}
