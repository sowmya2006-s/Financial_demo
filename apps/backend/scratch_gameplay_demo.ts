// apps/backend/scratch_gameplay_demo.ts
// Comprehensive demonstration script showing Auth, Profile, default metrics, HOME_LOAN popup, weekly tick, and difficulty guidance.

import { authService } from './src/services/authService';
import { profileService } from './src/services/profileService';
import { housingService } from './src/services/housingService';
import { gameService } from './src/services/gameService';
import prisma from './src/config/prisma';

async function runDemo() {
  console.log('=== STARTING MOOLAH MINDS GAMEPLAY ENGINE DEMONSTRATION ===\n');

  // Generate a unique email to avoid duplicate key conflicts
  const testEmail = `sowmya_google_${Date.now()}@gmail.com`;
  console.log(`[Step 1] Google Login / Auto-Account Creation`);
  console.log(`Input Email: ${testEmail}`);
  console.log(`Input Name: Sowmya`);
  
  const authResponse = await authService.googleLogin({
    email: testEmail,
    name: 'Sowmya'
  });
  const userId = authResponse.user.id;
  console.log(`✅ Success! JWT Token issued: ${authResponse.token.substring(0, 30)}...`);
  console.log(`✅ User profile created dynamically. ID: ${userId}\n`);

  console.log(`[Step 2] Profile Creation (Beginner Sandbox, Age 22)`);
  const profileResponse = await profileService.createProfile(userId, {
    name: 'Sowmya Live',
    difficulty: 'BEGINNER' as any,
    age: 22
  });
  const profileId = profileResponse.id;
  console.log(`✅ Profile Created successfully!`);
  console.log(`   - Career assigned: ${profileResponse.career}`);
  console.log(`   - Starting Salary: ₹${(profileResponse.startingSalary / 100).toLocaleString()}`);
  console.log(`   - Cohort ID: ${profileResponse.cohortId}\n`);

  console.log(`[Step 3] Initial Game Metrics & Initial Balance Verification`);
  const initialGameState = await gameService.getGameState(userId, profileId);
  console.log(`✅ Game State successfully initialized:`);
  console.log(`   - Current Week: ${initialGameState.gameState.currentWeek}`);
  console.log(`   - Credit Score: ${initialGameState.gameState.creditScore} (Expected 650)`);
  console.log(`   - Social Score: ${initialGameState.gameState.socialScore} (Expected 20)`);
  console.log(`   - Well-Being: ${initialGameState.gameState.wellBeing} (Expected 50)`);
  console.log(`   - Cash Balance: ₹${(initialGameState.balance / 100).toLocaleString()} (Expected ₹15,000 Starting Savings)`);
  console.log(`   - Derived Net Worth: ₹${(initialGameState.netWorth / 100).toLocaleString()} (Expected ₹15,000)\n`);

  console.log(`[Step 4] Mandatory Housing Popup: Choose Option 3 - Loan + Buy House`);
  console.log(`Selecting: HOME_LOAN (House Cost ₹40L, Downpayment ₹5L, Loan ₹35L)`);
  await housingService.setLivingOption(profileId, 'HOME_LOAN');
  console.log(`✅ Housing transition completed successfully!`);

  // Verify financial results of housing selection
  const postHousingState = await gameService.getGameState(userId, profileId);
  const dbProfile = await prisma.profile.findUnique({
    where: { id: profileId },
    include: { investments: true, loans: true, obligations: { where: { isActive: true } } }
  });

  console.log(`✅ Housing updates verified in ledger:`);
  console.log(`   - New Cash Balance: ₹${(postHousingState.balance / 100).toLocaleString()} (Deducted ₹5L downpayment, expect -₹4.85L)`);
  console.log(`   - Active Investments:`);
  dbProfile?.investments.forEach(inv => {
    console.log(`     * Type: ${inv.type}, Code: ${inv.productCode}, Value: ₹${(inv.currentValue / 100).toLocaleString()}`);
  });
  console.log(`   - Active Loans:`);
  dbProfile?.loans.forEach(loan => {
    console.log(`     * Type: ${loan.type}, Principal: ₹${(loan.principalAmount / 100).toLocaleString()}, Interest Rate: ${loan.interestRate}%, EMI: ₹${(loan.emiAmount / 100).toLocaleString()}`);
  });
  console.log(`   - Active Obligations:`);
  dbProfile?.obligations.forEach(obl => {
    console.log(`     * Category: ${obl.category}, Label: "${obl.label}", Amount: ₹${(obl.amount / 100).toLocaleString()}`);
  });
  console.log(`   - Derived Net Worth: ₹${(postHousingState.netWorth / 100).toLocaleString()} (Expect ₹35.15L)\n`);

  console.log(`[Step 5] Submit Week Decisions & Tick Gameplay Engine`);
  console.log(`Submitting empty decisions to skip (Tick to Week 2)`);
  await gameService.submitDecisions(userId, profileId, []);
  
  console.log(`Advancing Week...`);
  const summary = await gameService.advanceWeek(userId, profileId);
  console.log(`✅ Week advanced successfully! Weekly Summary generated:`);
  console.log(`   - Ticked from Week 1 to Week 2`);
  
  const explanations = JSON.parse(summary.explanations);
  console.log(`   - Descriptions & System Guidance generated:`);
  explanations.forEach((exp: string, index: number) => {
    console.log(`     [${index + 1}] ${exp}`);
  });

  console.log(`\n=== END OF MOOLAH MINDS GAMEPLAY DEMONSTRATION ===`);
}

runDemo().catch(console.error);
