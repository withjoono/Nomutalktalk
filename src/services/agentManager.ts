/**
 * RAG Agent 인스턴스 관리 서비스
 */

import { config } from '../config';

const RAGAgent = require('../../RAGAgent');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let agentInstance: any = null;
let currentStoreName: string | null = null;

/**
 * RAG Agent 초기화 또는 기존 인스턴스 반환
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAgent(): any {
  if (!config.geminiApiKey) {
    throw new Error('GEMINI_API_KEY가 설정되지 않았습니다. .env 파일을 확인하세요.');
  }

  if (!agentInstance) {
    agentInstance = new RAGAgent(config.geminiApiKey, {
      storeName: currentStoreName,
    });
  }

  return agentInstance;
}

/**
 * 새 RAG Agent 생성
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createAgent(storeName?: string): any {
  agentInstance = new RAGAgent(config.geminiApiKey, {
    storeName: storeName || currentStoreName,
  });

  if (storeName) {
    currentStoreName = storeName;
  }

  return agentInstance;
}

/**
 * 현재 스토어 이름 반환
 */
export function getCurrentStoreName(): string | null {
  return currentStoreName;
}

/**
 * 현재 스토어 이름 설정
 */
export function setCurrentStoreName(storeName: string | null): void {
  currentStoreName = storeName;
}

/**
 * 에이전트 인스턴스 초기화
 */
export function resetAgent(): void {
  agentInstance = null;
  currentStoreName = null;
}
