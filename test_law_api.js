require('dotenv').config();
const LawVerificationService = require('./services/LawVerificationService');

async function test() {
  console.log('Testing existing precedent (2019다2230)... should be true');
  const exists1 = await LawVerificationService.verifyPrecedent('2019다2230');
  console.log('Result 1:', exists1);

  console.log('Testing hallucinated precedent (2050다9999)... should be false');
  const hallucinations = await LawVerificationService.checkHallucinations('대법원 2050다9999 판결 참조');
  console.log('Hallucinations detected:', hallucinations);
}

test();
