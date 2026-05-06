import { execFileSync } from 'child_process';

const BASE = 'https://my.otpku.co.id/api/';

type FetchFn = (url: string, init?: RequestInit) => Promise<{ json: () => Promise<any> }>;

function curlFetch(url: string, init?: RequestInit): Promise<{ json: () => Promise<any> }> {
  const args = ['-s'];
  if (init?.method) args.push('-X', init.method);
  for (const [k, v] of Object.entries((init?.headers ?? {}) as Record<string, string>)) {
    args.push('-H', `${k}: ${v}`);
  }
  if (init?.body) args.push('--data-raw', String(init.body));
  args.push(url);
  const text = execFileSync('curl', args).toString();
  return Promise.resolve({ json: () => Promise.resolve(JSON.parse(text)) });
}

export interface NumberResult {
  id: string;
  number: string;
}

export interface StatusResult {
  status: 'OK' | 'WAIT' | 'CANCEL';
  code?: string;
}

function makeBody(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

const POST: RequestInit = {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
};

export async function getNumber(
  apiKey: string,
  service: string,
  country: string,
  fetchFn: FetchFn = curlFetch
): Promise<NumberResult> {
  const body = makeBody({ action: 'getNumber', api_key: apiKey, service, country });
  const res = await fetchFn(BASE, { ...POST, body });
  const data = await res.json();
  if (!data.success) throw new Error(`getNumber failed: ${JSON.stringify(data)}`);
  return { id: String(data.activation_id), number: data.phone_number };
}

export async function getStatus(
  apiKey: string,
  id: string,
  fetchFn: FetchFn = curlFetch
): Promise<StatusResult> {
  const body = makeBody({ action: 'getStatus', api_key: apiKey, id });
  const res = await fetchFn(BASE, { ...POST, body });
  const data = await res.json();
  if (!data.success) throw new Error(`getStatus failed: ${JSON.stringify(data)}`);

  const statusMap: Record<string, 'OK' | 'WAIT' | 'CANCEL'> = {
    ok: 'OK',
    waiting: 'WAIT',
    cancel: 'CANCEL',
    cancelled: 'CANCEL',
  };
  const mapped = statusMap[String(data.status).toLowerCase()];
  if (!mapped) throw new Error(`getStatus: unexpected status "${data.status}": ${JSON.stringify(data)}`);

  return { status: mapped, code: data.code ?? data.sms_code };
}

export async function getActiveNumbers(
  apiKey: string,
  fetchFn: FetchFn = curlFetch
): Promise<NumberResult[]> {
  const body = makeBody({ action: 'getActivations', api_key: apiKey });
  const res = await fetchFn(BASE, { ...POST, body });
  const data = await res.json();
  if (!data.success) return [];

  // Parse active numbers from response - only return pending ones
  if (!data.activations || !Array.isArray(data.activations)) return [];

  return data.activations
    .filter((act: any) => act.status === 'pending') // Only pending activations
    .map((act: any) => ({
      id: String(act.activation_id),
      number: String(act.phone_number)
    }));
}

export async function cancelActivation(
  apiKey: string,
  id: string,
  fetchFn: FetchFn = curlFetch
): Promise<void> {
  const body = makeBody({ action: 'cancelActivation', api_key: apiKey, id });
  const res = await fetchFn(BASE, { ...POST, body });
  const data = await res.json();
  if (!data.success) console.warn('cancelActivation non-OK response:', data);
}

export async function pollOtp(
  apiKey: string,
  id: string,
  intervalMs = 5_000,
  maxAttempts = 12,
  fetchFn: FetchFn = curlFetch
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, intervalMs));
    const result = await getStatus(apiKey, id, fetchFn);
    if (result.status === 'OK' && result.code) return result.code;
    if (result.status === 'CANCEL') throw new Error('Activation cancelled by server');
  }
  throw new Error(`OTP not received after ${maxAttempts} attempts`);
}
