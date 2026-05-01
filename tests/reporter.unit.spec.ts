import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { appendResult, TestResult } from '../utils/reporter';

test('appendResult creates file with first result', () => {
  const tmpFile = path.join(os.tmpdir(), `report-${Date.now()}.json`);
  const result: TestResult = {
    instance: 1,
    email: 'test@forapps.site',
    phone: '628111222333',
    status: 'trial_active',
    timestamp: '2026-01-01T00:00:00Z',
  };

  appendResult(result, tmpFile);

  const content: TestResult[] = JSON.parse(fs.readFileSync(tmpFile, 'utf-8'));
  expect(content).toHaveLength(1);
  expect(content[0]).toEqual(result);
  fs.unlinkSync(tmpFile);
});

test('appendResult appends to existing file', () => {
  const tmpFile = path.join(os.tmpdir(), `report-${Date.now()}.json`);
  const r1: TestResult = { instance: 1, email: 'a@forapps.site', phone: '628111', status: 'trial_active', timestamp: '2026-01-01T00:00:00Z' };
  const r2: TestResult = { instance: 2, email: 'b@forapps.site', phone: '628222', status: 'failed', error: 'timeout', timestamp: '2026-01-01T00:00:01Z' };

  appendResult(r1, tmpFile);
  appendResult(r2, tmpFile);

  const content: TestResult[] = JSON.parse(fs.readFileSync(tmpFile, 'utf-8'));
  expect(content).toHaveLength(2);
  expect(content[1].status).toBe('failed');
  expect(content[1].error).toBe('timeout');
  fs.unlinkSync(tmpFile);
});
