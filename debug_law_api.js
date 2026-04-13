require('dotenv').config();
const LawVerificationService = require('./services/LawVerificationService');

async function debug() {
  const caseNumber = '2019다2230';
  const url = `https://www.law.go.kr/DRF/lawSearch.do?OC=test&target=prec&type=XML&search=2&query=${encodeURIComponent(caseNumber)}`;
  console.log('URL:', url);
  const response = await fetch(url);
  const text = await response.text();
  console.log('Response:', text);
}

debug();
