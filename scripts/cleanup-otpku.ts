// Script to cleanup/cancel all active OTPKU numbers
import 'dotenv/config';
import { getActiveNumbers, cancelActivation } from '../fixtures/otpku';

const API_KEY = process.env.OTP_API_KEY!;

async function cleanupActiveNumbers() {
  console.log('🔍 Checking for active numbers...');

  const activeNumbers = await getActiveNumbers(API_KEY);

  if (activeNumbers.length === 0) {
    console.log('✅ No active numbers found. All clean!');
    return;
  }

  console.log(`📋 Found ${activeNumbers.length} active number(s):`);
  activeNumbers.forEach((num, idx) => {
    console.log(`  ${idx + 1}. ${num.number} (ID: ${num.id}, Status: ${num.status})`);
  });

  console.log('');
  console.log('🗑️ Cancelling all active numbers...');

  let successCount = 0;
  let failCount = 0;

  for (const num of activeNumbers) {
    try {
      await cancelActivation(API_KEY, num.id);
      console.log(`✅ Cancelled: ${num.number} (ID: ${num.id})`);
      successCount++;
    } catch (error: any) {
      console.log(`❌ Failed to cancel ${num.number}: ${error.message}`);
      failCount++;
    }
  }

  console.log('');
  console.log('📊 Summary:');
  console.log(`  ✅ Successfully cancelled: ${successCount}`);
  console.log(`  ❌ Failed: ${failCount}`);
  console.log('');
  console.log('✨ Cleanup complete!');
}

cleanupActiveNumbers().catch(console.error);
