import OpenAI from 'openai';

let openaiClient: OpenAI | null = null;

export function initializeOpenAI(): OpenAI | null {
  if (process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    console.log('✅ OpenAI API 연결 준비 완료');
  } else {
    console.warn('⚠️  OPENAI_API_KEY가 설정되지 않았습니다. OpenAI 모델은 사용할 수 없습니다.');
  }

  return openaiClient;
}

export function getOpenAI(): OpenAI | null {
  return openaiClient;
}
