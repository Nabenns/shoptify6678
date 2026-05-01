import fs from 'fs';
import path from 'path';

export interface TestResult {
  instance: number;
  email: string;
  phone: string;
  status: 'trial_active' | 'failed';
  error?: string;
  timestamp: string;
}

const DEFAULT_PATH = path.join(process.cwd(), 'results', 'report.json');

export function appendResult(
  result: TestResult,
  filePath: string = DEFAULT_PATH
): void {
  let existing: TestResult[] = [];
  if (fs.existsSync(filePath)) {
    existing = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
  existing.push(result);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(existing, null, 2));
}
