/**
 * Store 관리 API 라우트
 */

import { Router, Request, Response } from 'express';
import {
  getAgent,
  createAgent,
  getCurrentStoreName,
  setCurrentStoreName,
  resetAgent,
} from '../services/agentManager';
import { config } from '../config';

const router = Router();

/**
 * GET /api/health
 * 서버 상태 확인
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    apiKeyConfigured: !!config.geminiApiKey,
    currentStore: getCurrentStoreName(),
  });
});

/**
 * POST /api/store/initialize
 * 새 스토어 초기화 또는 기존 스토어 사용
 */
router.post('/initialize', async (req: Request, res: Response) => {
  try {
    const { displayName, storeName } = req.body;

    if (storeName) {
      // 기존 스토어 사용
      createAgent(storeName);

      res.json({
        success: true,
        storeName: storeName,
        message: '기존 스토어를 사용합니다.',
      });
    } else if (displayName) {
      // 새 스토어 생성
      const agent = getAgent();
      const newStoreName = await agent.initialize(displayName);
      setCurrentStoreName(newStoreName);

      res.json({
        success: true,
        storeName: newStoreName,
        message: '새 스토어가 생성되었습니다.',
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'displayName 또는 storeName이 필요합니다.',
      });
    }
  } catch (error) {
    console.error('스토어 초기화 오류:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/store/status
 * 현재 스토어 상태 조회
 */
router.get('/status', async (_req: Request, res: Response): Promise<void> => {
  try {
    const currentStore = getCurrentStoreName();
    if (!currentStore) {
      res.status(400).json({
        success: false,
        error: '초기화된 스토어가 없습니다.',
      });
      return;
    }

    const agent = getAgent();
    const status = await agent.getStatus();

    res.json({
      success: true,
      status: status,
    });
  } catch (error) {
    console.error('스토어 상태 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/stores
 * 모든 스토어 목록 조회
 */
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const agent = getAgent();
    const stores = await agent.listStores();

    res.json({
      success: true,
      stores: stores,
    });
  } catch (error) {
    console.error('스토어 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * DELETE /api/store/:storeName
 * 특정 스토어 삭제
 */
router.delete('/:storeName', async (req: Request, res: Response) => {
  try {
    const { storeName } = req.params;
    const agent = getAgent();

    await agent.deleteStore(storeName, true);

    // 현재 스토어가 삭제된 경우 초기화
    if (storeName === getCurrentStoreName()) {
      resetAgent();
    }

    res.json({
      success: true,
      message: '스토어가 삭제되었습니다.',
    });
  } catch (error) {
    console.error('스토어 삭제 오류:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * PATCH /api/store/:storeName/rename
 * 스토어 이름 수정
 */
router.patch('/:storeName/rename', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeName } = req.params;
    const { newDisplayName } = req.body;

    if (!newDisplayName || !newDisplayName.trim()) {
      res.status(400).json({
        success: false,
        error: '새 스토어 이름을 입력하세요.',
      });
      return;
    }

    const agent = getAgent();
    const updatedStore = await agent.renameStore(storeName, newDisplayName.trim());

    res.json({
      success: true,
      message: '스토어 이름이 변경되었습니다.',
      store: updatedStore,
    });
  } catch (error) {
    console.error('스토어 이름 수정 오류:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

export default router;
