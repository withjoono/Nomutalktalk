import * as dotenv from 'dotenv';

dotenv.config();

export interface AppConfig {
  port: number;
  nodeEnv: string;
  geminiApiKey: string;
  googleApiKey: string;
  openaiApiKey?: string;
  firebaseServiceAccountPath?: string;
  uploadDir: string;
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  googleApiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY,
  firebaseServiceAccountPath:
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json',
  uploadDir: process.env.UPLOAD_DIR || './uploads',
};

export { initializeFirebase, getFirestore, admin } from './firebase';
export { initializeOpenAI, getOpenAI } from './openai';

export default config;
