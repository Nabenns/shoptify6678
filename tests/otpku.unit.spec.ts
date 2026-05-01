import { test, expect } from '@playwright/test';
import { getNumber, getStatus, cancelActivation, pollOtp } from '../fixtures/otpku';

const KEY = 'test-key';

test('getNumber returns id and number on OK response', async () => {
  const mockFetch = async (_url: string) =>
    ({ json: async () => ({ status: 'OK', id: 'OTPTOP-001', number: '628111222333' }) }) as any;

  const result = await getNumber(KEY, 'svc', '6', mockFetch);
  expect(result).toEqual({ id: 'OTPTOP-001', number: '628111222333' });
});

test('getNumber throws on non-OK response', async () => {
  const mockFetch = async (_url: string) =>
    ({ json: async () => ({ status: 'ERROR', message: 'no numbers available' }) }) as any;

  await expect(getNumber(KEY, 'svc', '6', mockFetch)).rejects.toThrow('getNumber failed');
});

test('getStatus returns status and code', async () => {
  const mockFetch = async (_url: string) =>
    ({ json: async () => ({ status: 'OK', code: '123456' }) }) as any;

  const result = await getStatus(KEY, 'OTPTOP-001', mockFetch);
  expect(result).toEqual({ status: 'OK', code: '123456' });
});

test('cancelActivation resolves without throwing', async () => {
  const mockFetch = async (_url: string) =>
    ({ json: async () => ({ status: 'OK' }) }) as any;

  await expect(cancelActivation(KEY, 'OTPTOP-001', mockFetch)).resolves.toBeUndefined();
});

test('pollOtp returns code when first poll is OK', async () => {
  const mockFetch = async (_url: string) =>
    ({ json: async () => ({ status: 'OK', code: '654321' }) }) as any;

  const code = await pollOtp(KEY, 'OTPTOP-001', 0, 3, mockFetch);
  expect(code).toBe('654321');
});

test('pollOtp retries on WAIT then returns code', async () => {
  let call = 0;
  const mockFetch = async (_url: string) => {
    call++;
    return { json: async () => call < 3 ? { status: 'WAIT' } : { status: 'OK', code: '111222' } } as any;
  };

  const code = await pollOtp(KEY, 'OTPTOP-001', 0, 5, mockFetch);
  expect(code).toBe('111222');
  expect(call).toBe(3);
});

test('pollOtp throws after max attempts', async () => {
  const mockFetch = async (_url: string) =>
    ({ json: async () => ({ status: 'WAIT' }) }) as any;

  await expect(pollOtp(KEY, 'OTPTOP-001', 0, 3, mockFetch)).rejects.toThrow('OTP not received after 3 attempts');
});

test('pollOtp throws immediately on CANCEL', async () => {
  const mockFetch = async (_url: string) =>
    ({ json: async () => ({ status: 'CANCEL' }) }) as any;

  await expect(pollOtp(KEY, 'OTPTOP-001', 0, 3, mockFetch)).rejects.toThrow('cancelled by server');
});

test('getStatus throws on unexpected status', async () => {
  const mockFetch = async (_url: string) =>
    ({ json: async () => ({ status: 'EXPIRED', message: 'expired' }) }) as any;

  await expect(getStatus(KEY, 'OTPTOP-001', mockFetch)).rejects.toThrow('unexpected status "EXPIRED"');
});
