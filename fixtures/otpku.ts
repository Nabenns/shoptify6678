const BASE = 'https://my.otpku.co.id/api/';

type FetchFn = (url: string) => Promise<{ json: () => Promise<any> }>;

export interface NumberResult {
  id: string;
  number: string;
}

export interface StatusResult {
  status: 'OK' | 'WAIT' | 'CANCEL';
  code?: string;
}

function buildUrl(params: Record<string, string>): string {
  const url = new URL(BASE);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return url.toString();
}

export async function getNumber(
  apiKey: string,
  service: string,
  country: string,
  fetchFn: FetchFn = fetch as any
): Promise<NumberResult> {
  const url = buildUrl({ action: 'getNumber', api_key: apiKey, service, country });
  const res = await fetchFn(url);
  const data = await res.json();
  if (data.status !== 'OK') throw new Error(`getNumber failed: ${JSON.stringify(data)}`);
  return { id: data.id, number: data.number };
}

export async function getStatus(
  apiKey: string,
  id: string,
  fetchFn: FetchFn = fetch as any
): Promise<StatusResult> {
  const url = buildUrl({ action: 'getStatus', api_key: apiKey, id });
  const res = await fetchFn(url);
  const data = await res.json();
  const valid = new Set(['OK', 'WAIT', 'CANCEL']);
  if (!valid.has(data.status)) {
    throw new Error(`getStatus: unexpected status "${data.status}": ${JSON.stringify(data)}`);
  }
  return { status: data.status as 'OK' | 'WAIT' | 'CANCEL', code: data.code };
}

export async function cancelActivation(
  apiKey: string,
  id: string,
  fetchFn: FetchFn = fetch as any
): Promise<void> {
  const url = buildUrl({ action: 'cancelActivation', api_key: apiKey, id });
  const res = await fetchFn(url);
  const data = await res.json();
  if (data.status !== 'OK') console.warn('cancelActivation non-OK response:', data);
}

export async function pollOtp(
  apiKey: string,
  id: string,
  intervalMs = 5_000,
  maxAttempts = 12,
  fetchFn: FetchFn = fetch as any
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, intervalMs));
    const result = await getStatus(apiKey, id, fetchFn);
    if (result.status === 'OK' && result.code) return result.code;
    if (result.status === 'CANCEL') throw new Error('Activation cancelled by server');
  }
  throw new Error(`OTP not received after ${maxAttempts} attempts`);
}
