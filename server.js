const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const RAGAgent = require('./RAGAgent');
const OpenAI = require('openai');
require('dotenv').config();

// GCP Secret Manager (프로덕션 환경)
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

/**
 * GCP Secret Manager에서 시크릿 로드
 * 로컬 환경에서는 .env 파일 사용, 프로덕션(App Engine)에서는 Secret Manager 사용
 */
async function loadSecrets() {
  // 이미 환경변수에 설정되어 있으면 스킵 (로컬 개발 환경)
  if (process.env.GEMINI_API_KEY) {
    console.log('🔑 GEMINI_API_KEY: .env 파일에서 로드됨');
    return;
  }

  try {
    const client = new SecretManagerServiceClient();
    const projectId = 'nomutalk-889bd'; // 고정된 프로젝트 ID 사용

    // GEMINI_API_KEY 시크릿 로드
    const [version] = await client.accessSecretVersion({
      name: `projects/${projectId}/secrets/GEMINI_API_KEY/versions/latest`,
    });
    process.env.GEMINI_API_KEY = version.payload.data.toString('utf8');
    console.log('🔑 GEMINI_API_KEY: Secret Manager에서 로드됨');
  } catch (error) {
    console.warn('⚠️  Secret Manager에서 시크릿 로드 실패:', error.message);
    console.warn('   로컬 환경에서는 .env 파일에 GEMINI_API_KEY를 설정하세요.');
  }
}

// RAG 문서 관리 시스템 모듈
const validators = require('./models/validators');
const ChunkingService = require('./services/ChunkingService');

// OpenAI 클라이언트 초기화
let openaiClient = null;
if (process.env.OPENAI_API_KEY) {
  openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
  console.log('✅ OpenAI API 연결 준비 완료');
} else {
  console.warn('⚠️  OPENAI_API_KEY가 설정되지 않았습니다. OpenAI 모델은 사용할 수 없습니다.');
}

// Firebase Admin SDK
const admin = require('firebase-admin');

// Firebase 초기화
let db = null;
let casesDb = null;

// 1단계: Firebase App 초기화
try {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json';

  let initialized = false;
  if (fs.existsSync(serviceAccountPath)) {
    try {
      console.log('📂 Firebase 서비스 계정 파일 사용:', serviceAccountPath);
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      initialized = true;
    } catch (certError) {
      console.warn('⚠️  서비스 계정 키 파일 오류 (손상 가능):', certError.message);
    }
  }

  if (!initialized) {
    console.log('☁️  GCP 인프라 기본 인증 사용 (App Engine)');
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
  }
} catch (error) {
  console.error('❌ Firebase 초기화 오류:', error.message);
  if (!admin.apps.length) {
    admin.initializeApp();
  }
}

// 2단계: Firestore 초기화 (기본 DB - Datastore 모드)
try {
  db = admin.firestore();
  console.log('✅ Firebase Admin SDK 초기화 성공');
} catch (firestoreError) {
  console.warn('⚠️  Firestore 초기화 실패 (Datastore Mode일 수 있음):', firestoreError.message);
  db = null;
}

// 3단계: 사건 관리 전용 Firestore (Native 모드) 초기화
try {
  const { getFirestore } = require('firebase-admin/firestore');
  casesDb = getFirestore(admin.app(), 'nomutalk-cases');
  console.log('✅ 사건 관리 Firestore (nomutalk-cases) 초기화 성공');
} catch (casesDbError) {
  console.warn('⚠️  사건 관리 Firestore 초기화 실패:', casesDbError.message);
  casesDb = null;
}

// 4단계: PostgreSQL (Prisma) 초기화 - 사건 관리용
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
console.log('✅ PostgreSQL (Prisma) 초기화 성공');

// 대화형 챗봇 모듈
const { getInstance: getConversationManager } = require('./models/ConversationManager');
const DialogueFlowEngine = require('./models/DialogueFlowEngine');
const ConversationStorage = require('./models/ConversationStorage');
const { LaborMetadataBuilder } = require('./models/laborSchemas');

// 대화 관리자 및 엔진 초기화
const conversationManager = getConversationManager();
let conversationStorage = null;
let dialogueEngine = null;

if (db) {
  conversationStorage = new ConversationStorage(db);
  console.log('✅ 대화 저장소 초기화 완료');
}

const app = express();
const PORT = process.env.PORT || 4010;

// 업로드 디렉토리 설정
// App Engine Standard에서는 /tmp 디렉토리에만 쓰기가 가능합니다.
const UPLOAD_DIR = process.env.NODE_ENV === 'production'
  ? path.join('/tmp', 'uploads')
  : path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer 설정 (파일 업로드)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB 제한
});

// CORS 설정
const corsOptions = {
  origin: function (origin, callback) {
    // 허용할 origin 목록
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
      : [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3005',
        'http://localhost:3010',
        'http://localhost:3030',
        'http://localhost:4010',
        'http://localhost:4030',
        'http://localhost:8080',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:3005',
        'http://127.0.0.1:3010',
        'http://127.0.0.1:3030',
        'http://127.0.0.1:4010',
        'http://127.0.0.1:4030',
        'http://127.0.0.1:8080',
        'https://google-file-search.vercel.app',
        'https://google-file-search.netlify.app',
        'https://laborlawtech.web.app',
        'https://laborlawtech.firebaseapp.com',
        'https://nomutalk-889bd.web.app',
        'https://nomutalk-889bd.firebaseapp.com',
        'https://nomutalk.kr',
        'https://www.nomutalk.kr'
      ];

    // origin이 없는 경우 (같은 origin 요청, Postman 등) 또는 허용 목록에 있는 경우
    if (!origin || allowedOrigins.includes(origin) ||
      origin.endsWith('.vercel.app') ||
      origin.endsWith('.netlify.app') ||
      origin.endsWith('.railway.app') ||
      origin.endsWith('.render.com') ||
      origin.endsWith('.run.app')) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('CORS not allowed'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400 // 24 hours
};

// 미들웨어
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

/**
 * Firebase ID Token 검증 미들웨어
 */
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: '인증 토큰이 없습니다.' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    res.status(401).json({ success: false, error: '유효하지 않은 토큰입니다.' });
  }
}

// RAG Agent 인스턴스 관리
let agentInstance = null;
let currentStoreName = null;

/**
 * 파일 안전 삭제 (비동기, 에러 처리 포함)
 * @param {string} filePath - 삭제할 파일 경로
 * @returns {Promise<void>}
 */
async function cleanupFile(filePath) {
  try {
    await fs.promises.unlink(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`Failed to clean up file: ${filePath}`, err);
      // 파일 삭제 실패는 로그만 남기고 계속 진행
    }
  }
}

/**
 * RAG Agent 초기화 또는 기존 인스턴스 반환
 */
function getAgent() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY가 설정되지 않았습니다. .env 파일을 확인하세요.');
  }

  if (!agentInstance) {
    agentInstance = new RAGAgent(process.env.GEMINI_API_KEY, {
      storeName: currentStoreName
    });
  }

  return agentInstance;
}

// ==================== API 엔드포인트 ====================

/**
 * GET /api/health
 * 서버 상태 확인
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    apiKeyConfigured: !!process.env.GEMINI_API_KEY,
    currentStore: currentStoreName
  });
});

/**
 * POST /api/store/initialize
 * 새 스토어 초기화 또는 기존 스토어 사용
 */
app.post('/api/store/initialize', verifyToken, async (req, res) => {
  try {
    const { displayName, storeName } = req.body;

    const agent = getAgent();

    if (storeName) {
      // 기존 스토어 사용
      agentInstance = new RAGAgent(process.env.GEMINI_API_KEY, { storeName });
      currentStoreName = storeName;

      res.json({
        success: true,
        storeName: storeName,
        message: '기존 스토어를 사용합니다.'
      });
    } else if (displayName) {
      // 새 스토어 생성
      const newStoreName = await agent.initialize(displayName);
      currentStoreName = newStoreName;

      res.json({
        success: true,
        storeName: newStoreName,
        message: '새 스토어가 생성되었습니다.'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'displayName 또는 storeName이 필요합니다.'
      });
    }
  } catch (error) {
    console.error('스토어 초기화 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/store/status
 * 현재 스토어 상태 조회
 */
app.get('/api/store/status', async (req, res) => {
  try {
    if (!currentStoreName) {
      return res.status(400).json({
        success: false,
        error: '초기화된 스토어가 없습니다.'
      });
    }

    const agent = getAgent();
    const status = await agent.getStatus();

    res.json({
      success: true,
      status: status
    });
  } catch (error) {
    console.error('스토어 상태 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/stores
 * 모든 스토어 목록 조회
 */
app.get('/api/stores', async (req, res) => {
  try {
    const agent = getAgent();
    const stores = await agent.listStores();

    res.json({
      success: true,
      stores: stores
    });
  } catch (error) {
    console.error('스토어 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/store/:storeName
 * 특정 스토어 삭제
 */
app.delete('/api/store/:storeName', async (req, res) => {
  try {
    const { storeName } = req.params;
    const agent = getAgent();

    await agent.deleteStore(storeName, true);

    // 현재 스토어가 삭제된 경우 초기화
    if (storeName === currentStoreName) {
      currentStoreName = null;
      agentInstance = null;
    }

    res.json({
      success: true,
      message: '스토어가 삭제되었습니다.'
    });
  } catch (error) {
    console.error('스토어 삭제 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PATCH /api/store/:storeName/rename
 * 스토어 이름 수정
 */
app.patch('/api/store/:storeName/rename', async (req, res) => {
  try {
    const { storeName } = req.params;
    const { newDisplayName } = req.body;

    if (!newDisplayName || !newDisplayName.trim()) {
      return res.status(400).json({
        success: false,
        error: '새 스토어 이름을 입력하세요.'
      });
    }

    const agent = getAgent();
    const updatedStore = await agent.renameStore(storeName, newDisplayName.trim());

    res.json({
      success: true,
      message: '스토어 이름이 변경되었습니다.',
      store: updatedStore
    });
  } catch (error) {
    console.error('스토어 이름 수정 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/upload
 * 파일 업로드 (직접 업로드 방식)
 */
app.post('/api/upload', verifyToken, upload.single('file'), async (req, res) => {
  try {
    if (!currentStoreName) {
      return res.status(400).json({
        success: false,
        error: '먼저 스토어를 초기화하세요.'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '파일이 업로드되지 않았습니다.'
      });
    }

    // MIME 타입 검증
    const mimeType = req.body.mimeType || req.file.mimetype;
    if (!isAllowedMimeType(mimeType)) {
      await cleanupFile(req.file.path);
      return res.status(400).json({
        success: false,
        error: `지원하지 않는 파일 형식입니다: ${mimeType}`
      });
    }

    // displayName 검증
    const displayName = req.body.displayName || req.file.originalname;
    if (req.body.displayName && !isValidDisplayName(req.body.displayName)) {
      await cleanupFile(req.file.path);
      return res.status(400).json({
        success: false,
        error: 'displayName이 유효하지 않습니다 (1-100자, 특수문자 제한).'
      });
    }

    const agent = getAgent();
    const filePath = req.file.path;

    // 청킹 설정 파싱
    let chunkingConfig = null;
    if (req.body.chunkingConfig) {
      try {
        chunkingConfig = JSON.parse(req.body.chunkingConfig);
      } catch (e) {
        console.warn('청킹 설정 파싱 실패:', e.message);
      }
    }

    // 파일 업로드
    const result = await agent.uploadFile(filePath, {
      displayName,
      mimeType,
      chunkingConfig
    });

    // 업로드된 파일 삭제 (비동기)
    await cleanupFile(filePath);

    res.json({
      success: true,
      result: {
        fileName: result.fileName,
        storeName: result.storeName
      }
    });
  } catch (error) {
    console.error('파일 업로드 오류:', error);

    // 오류 발생 시 임시 파일 삭제 (비동기)
    if (req.file && fs.existsSync(req.file.path)) {
      await cleanupFile(req.file.path);
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/upload-import
 * 파일 업로드 및 가져오기 (Files API Import 방식)
 */
app.post('/api/upload-import', upload.single('file'), async (req, res) => {
  try {
    if (!currentStoreName) {
      return res.status(400).json({
        success: false,
        error: '먼저 스토어를 초기화하세요.'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '파일이 업로드되지 않았습니다.'
      });
    }

    // MIME 타입 검증
    const mimeType = req.body.mimeType || req.file.mimetype;
    if (!isAllowedMimeType(mimeType)) {
      await cleanupFile(req.file.path);
      return res.status(400).json({
        success: false,
        error: `지원하지 않는 파일 형식입니다: ${mimeType}`
      });
    }

    // displayName 검증
    const displayName = req.body.displayName || req.file.originalname;
    if (req.body.displayName && !isValidDisplayName(req.body.displayName)) {
      await cleanupFile(req.file.path);
      return res.status(400).json({
        success: false,
        error: 'displayName이 유효하지 않습니다 (1-100자, 특수문자 제한).'
      });
    }

    const agent = getAgent();
    const filePath = req.file.path;

    // 청킹 설정 파싱
    let chunkingConfig = null;
    if (req.body.chunkingConfig) {
      try {
        chunkingConfig = JSON.parse(req.body.chunkingConfig);
      } catch (e) {
        console.warn('청킹 설정 파싱 실패:', e.message);
      }
    }

    // 커스텀 메타데이터 파싱
    let customMetadata = null;
    if (req.body.customMetadata) {
      try {
        customMetadata = JSON.parse(req.body.customMetadata);
      } catch (e) {
        console.warn('메타데이터 파싱 실패:', e.message);
      }
    }

    // 파일 업로드 및 가져오기
    const result = await agent.uploadAndImportFile(filePath, {
      displayName,
      mimeType,
      chunkingConfig,
      customMetadata
    });

    // 업로드된 파일 삭제 (비동기)
    await cleanupFile(filePath);

    res.json({
      success: true,
      result: {
        fileName: result.fileName,
        filesAPIName: result.filesAPIName,
        storeName: result.storeName
      }
    });
  } catch (error) {
    console.error('파일 가져오기 오류:', error);

    // 오류 발생 시 임시 파일 삭제 (비동기)
    if (req.file && fs.existsSync(req.file.path)) {
      await cleanupFile(req.file.path);
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/upload/preview-embedding
 * 업로드 전 embedding 미리보기 (텍스트 추출, 청크 분할, 특수 문자 인식)
 */
app.post('/api/upload/preview-embedding', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '파일이 업로드되지 않았습니다.'
      });
    }

    const filePath = req.file.path;
    const mimeType = req.file.mimetype;
    const fileName = req.file.originalname;

    // 청킹 설정
    let maxTokensPerChunk = 250;
    let maxOverlapTokens = 25;
    if (req.body.maxTokensPerChunk) {
      maxTokensPerChunk = parseInt(req.body.maxTokensPerChunk) || 250;
    }
    if (req.body.maxOverlapTokens) {
      maxOverlapTokens = parseInt(req.body.maxOverlapTokens) || 25;
    }    // 텍스트 추출
    let extractedText = '';
    let isOCR = false;

    if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
      extractedText = fs.readFileSync(filePath, 'utf-8');
    } else if (mimeType === 'application/pdf') {
      // PDF는 여기서 간단한 텍스트 추출 시뮬레이션 (실제로는 PDF 파싱 필요)
      extractedText = `[PDF 파일: ${fileName}]\n※ PDF 텍스트 추출은 업로드 시 서버에서 처리됩니다.\n파일 크기: ${(req.file.size / 1024).toFixed(1)}KB`;
    } else if (mimeType.startsWith('image/')) {
      // 이미지 파일 - Gemini Vision으로 OCR 수행
      try {
        console.log('🔍 이미지 OCR 시작:', fileName);
        const imageBuffer = fs.readFileSync(filePath);
        const base64Image = imageBuffer.toString('base64');

        // Gemini Vision API로 OCR
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

        const ocrPrompt = `이 이미지에서 모든 텍스트를 정확하게 추출해주세요.

다음 규칙을 따르세요:
1. 이미지에 보이는 모든 텍스트를 빠짐없이 추출
2. 수학 수식은 LaTeX 형식으로 표기 (예: $x^2 + y^2 = r^2$)
3. 표가 있으면 마크다운 표 형식으로 변환
4. 그래프나 도형이 있으면 [그래프: 설명] 또는 [도형: 설명] 형식으로 표시
5. 글자가 없거나 읽을 수 없는 부분은 [읽을 수 없음]으로 표시
6. 원본 레이아웃을 최대한 유지

추출된 텍스트만 출력하세요:`;

        const result = await model.generateContent([
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image
            }
          },
          { text: ocrPrompt }
        ]);

        const response = await result.response;
        extractedText = response.text();
        isOCR = true;
        console.log('✅ OCR 완료:', extractedText.length, '자 추출됨');
      } catch (ocrError) {
        console.error('❌ OCR 오류:', ocrError.message);
        extractedText = `[이미지 OCR 오류]\n파일명: ${fileName}\n오류: ${ocrError.message}\n\n※ Gemini API 키를 확인하거나, 이미지가 손상되지 않았는지 확인하세요.`;
      }
    } else {
      extractedText = `[${mimeType} 파일]\n파일명: ${fileName}\n파일 크기: ${(req.file.size / 1024).toFixed(1)}KB`;
    }

    // 청크 분할 미리보기 (간단한 시뮬레이션)
    const chunks = simulateChunking(extractedText, maxTokensPerChunk, maxOverlapTokens);

    // 특수 문자/수식 탐지
    const specialChars = detectSpecialCharacters(extractedText);

    // 파일 삭제
    await cleanupFile(filePath);

    res.json({
      success: true,
      preview: {
        fileName,
        mimeType,
        fileSize: req.file.size,
        extractedText: extractedText.substring(0, 2000) + (extractedText.length > 2000 ? '...' : ''),
        totalTextLength: extractedText.length,
        chunks: chunks.slice(0, 5), // 최대 5개 청크만 미리보기
        totalChunks: chunks.length,
        specialCharacters: specialChars,
        isOCR: isOCR,
        settings: {
          maxTokensPerChunk,
          maxOverlapTokens
        }
      }
    });
  } catch (error) {
    console.error('Embedding 미리보기 오류:', error);

    if (req.file && fs.existsSync(req.file.path)) {
      await cleanupFile(req.file.path);
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 청크 분할 시뮬레이션
 */
function simulateChunking(text, maxTokens, overlap) {
  const chunks = [];
  // 대략 4 글자 = 1 토큰으로 가정
  const charsPerChunk = maxTokens * 4;
  const overlapChars = overlap * 4;

  let start = 0;
  let chunkIndex = 1;

  while (start < text.length) {
    const end = Math.min(start + charsPerChunk, text.length);
    const chunkText = text.substring(start, end);

    chunks.push({
      index: chunkIndex,
      content: chunkText.substring(0, 200) + (chunkText.length > 200 ? '...' : ''),
      fullLength: chunkText.length,
      estimatedTokens: Math.ceil(chunkText.length / 4)
    });

    start = end - overlapChars;
    if (start >= text.length || end === text.length) break;
    chunkIndex++;
  }

  return chunks;
}

/**
 * 특수 문자 및 수식 탐지
 */
function detectSpecialCharacters(text) {
  const results = {
    hasLatex: false,
    hasGreekLetters: false,
    hasMathSymbols: false,
    hasChemical: false,
    samples: []
  };

  // LaTeX 수식 탐지
  const latexPatterns = [/\$[^$]+\$/g, /\\\[[\s\S]*?\\\]/g, /\\begin\{[^}]+\}/g];
  for (const pattern of latexPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      results.hasLatex = true;
      results.samples.push(...matches.slice(0, 3).map(m => ({ type: 'LaTeX', content: m.substring(0, 50) })));
    }
  }

  // 그리스 문자 탐지
  if (/[α-ωΑ-Ω]/.test(text)) {
    results.hasGreekLetters = true;
    const greekMatches = text.match(/[α-ωΑ-Ω]+/g) || [];
    results.samples.push(...greekMatches.slice(0, 3).map(m => ({ type: 'Greek', content: m })));
  }

  // 수학 기호 탐지
  if (/[∑∫∂√∞±×÷≈≠≤≥∈∉⊂⊃∪∩]/.test(text)) {
    results.hasMathSymbols = true;
    const mathMatches = text.match(/[∑∫∂√∞±×÷≈≠≤≥∈∉⊂⊃∪∩]+/g) || [];
    results.samples.push(...mathMatches.slice(0, 3).map(m => ({ type: 'Math', content: m })));
  }

  // 화학식 탐지
  if (/[A-Z][a-z]?\d*/.test(text) && /[₀-₉]|(?:H2O|CO2|NaCl|O2|N2)/.test(text)) {
    results.hasChemical = true;
    const chemMatches = text.match(/\b[A-Z][a-z]?(?:₀-₉|\d)*\b/g) || [];
    results.samples.push(...chemMatches.slice(0, 3).map(m => ({ type: 'Chemical', content: m })));
  }

  return results;
}

/**
 * 좌표 라벨 새니타이제이션 (XSS 방지)
 * @param {string} label - 검증할 라벨
 * @returns {string} 안전한 라벨 (A-Z 단일 문자만)
 */
function sanitizeCoordinateLabel(label) {
  // A-Z 단일 대문자만 허용
  if (typeof label !== 'string' || !/^[A-Z]$/.test(label)) {
    return 'P'; // 기본값
  }
  return label;
}

/**
 * 좌표 값 검증 (유효한 숫자인지 확인)
 * @param {number} value - 검증할 숫자
 * @returns {boolean} 유효 여부
 */
function isValidCoordinate(value) {
  return typeof value === 'number' && Number.isFinite(value) && !Number.isNaN(value);
}

/**
 * 파일 MIME 타입 검증 (화이트리스트 기반)
 * @param {string} mimetype - 검증할 MIME 타입
 * @returns {boolean} 허용된 타입 여부
 */
function isAllowedMimeType(mimetype) {
  const allowedTypes = [
    'text/plain',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/markdown'
  ];
  return allowedTypes.includes(mimetype);
}

/**
 * displayName 검증
 * @param {string} name - 검증할 이름
 * @returns {boolean} 유효 여부
 */
function isValidDisplayName(name) {
  if (typeof name !== 'string') return false;
  // 1-100 문자, 특수문자 제한
  return name.length > 0 && name.length <= 100 && !/[<>\"'&]/.test(name);
}

/**
 * storeName 검증
 * @param {string} name - 검증할 스토어 이름
 * @returns {boolean} 유효 여부
 */
function isValidStoreName(name) {
  if (typeof name !== 'string') return false;
  // fileSearchStores/[영숫자_-] 형식
  return /^fileSearchStores\/[\w-]+$/.test(name);
}

/**
 * 좌표 데이터를 자동으로 감지하여 Plotly 그래프 코드로 변환
 * @param {string} text - AI 응답 텍스트
 * @returns {string} 그래프 코드가 추가된 텍스트
 */
function autoGenerateGraphs(text) {
  let enhanced = text;

  // 패턴 1: 점 A(1,1), B(5,1), C(3,4) 형식의 좌표
  const pointPattern = /점\s*([A-Z])\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g;
  const matches = [...text.matchAll(pointPattern)];

  // 최대 포인트 수 제한 (DoS 방지)
  const MAX_POINTS = 20;
  if (matches.length > MAX_POINTS) {
    console.warn(`⚠️ 너무 많은 좌표 감지됨 (${matches.length}개), ${MAX_POINTS}개로 제한`);
    matches.splice(MAX_POINTS);
  }

  if (matches.length >= 2) {
    console.log(`🎨 자동 그래프 생성: ${matches.length}개의 좌표 감지됨`);

    // 좌표 파싱 및 검증
    const points = matches
      .map(m => ({
        label: sanitizeCoordinateLabel(m[1]),
        x: parseFloat(m[2]),
        y: parseFloat(m[3])
      }))
      .filter(p => isValidCoordinate(p.x) && isValidCoordinate(p.y)); // 유효하지 않은 좌표 제거

    if (points.length < 2) {
      console.warn('⚠️ 유효한 좌표가 2개 미만, 그래프 생성 건너뜀');
      return enhanced;
    }

    // Plotly 그래프 생성
    const xCoords = points.map(p => p.x);
    const yCoords = points.map(p => p.y);

    // 도형을 닫기 위해 첫 점을 마지막에 추가
    if (points.length >= 3) {
      xCoords.push(points[0].x);
      yCoords.push(points[0].y);
    }

    const annotations = points.map(p => ({
      x: p.x,
      y: p.y,
      text: `${p.label}(${p.x},${p.y})`,
      showarrow: false,
      yshift: 10
    }));

    const plotlyCode = {
      data: [{
        x: xCoords,
        y: yCoords,
        type: 'scatter',
        mode: 'lines+markers',
        fill: points.length >= 3 ? 'toself' : undefined,
        name: points.length >= 3 ? `도형 ${points.map(p => p.label).join('')}` : '좌표',
        marker: { size: 10, color: 'red' },
        line: { color: 'blue', width: 2 }
      }],
      layout: {
        title: `좌표평면: 점 ${points.map(p => p.label).join(', ')}`,
        xaxis: {
          title: 'x',
          zeroline: true,
          gridcolor: '#e0e0e0'
        },
        yaxis: {
          title: 'y',
          zeroline: true,
          gridcolor: '#e0e0e0'
        },
        annotations: annotations,
        showlegend: true
      }
    };

    const graphBlock = `\n\n\`\`\`plotly\n${JSON.stringify(plotlyCode, null, 2)}\n\`\`\`\n\n`;

    // 텍스트에 그래프 블록 추가 (좌표 설명 바로 다음에)
    const insertPosition = matches[matches.length - 1].index + matches[matches.length - 1][0].length;
    enhanced = text.slice(0, insertPosition) + graphBlock + text.slice(insertPosition);

    console.log('✅ Plotly 그래프 코드 자동 생성 완료');
  }

  // 패턴 2: 함수 형태 (y = x^2 등)는 향후 추가 가능

  return enhanced;
}

/**
 * POST /api/ask
 * 질문하기 (useRag: false일 경우 직접 LLM 호출)
 */
app.post('/api/ask', async (req, res) => {
  try {
    const { query, useRag = true, model: requestedModel } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: '질문이 필요합니다.'
      });
    }

    let answer;

    // useRag가 false이면 직접 Gemini API 호출 (스토어 불필요)
    if (!useRag) {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const modelName = requestedModel || 'gemini-2.5-pro';
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(query);
      answer = result.response.text();
    } else {
      // RAG 모드: 스토어 필요
      if (!currentStoreName) {
        return res.status(400).json({
          success: false,
          error: '먼저 스토어를 초기화하세요.'
        });
      }
      const agent = getAgent();
      answer = await agent.ask(query);
    }

    console.log('\n📝 원본 AI 응답 (전체):');
    console.log('='.repeat(80));
    console.log(answer);
    console.log('='.repeat(80));

    // 자동 그래프 생성
    answer = autoGenerateGraphs(answer);

    console.log('\n✨ 최종 응답 (전체):');
    console.log('='.repeat(80));
    console.log(answer);
    console.log('='.repeat(80) + '\n');

    res.json({
      success: true,
      answer: answer
    });
  } catch (error) {
    console.error('질문 처리 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/documents
 * 현재 스토어의 문서 목록 조회
 */
app.get('/api/documents', async (req, res) => {
  try {
    if (!currentStoreName) {
      return res.status(400).json({
        success: false,
        error: '먼저 스토어를 초기화하세요.'
      });
    }

    const agent = getAgent();
    const documents = await agent.listDocuments();

    res.json({
      success: true,
      documents: documents
    });
  } catch (error) {
    console.error('문서 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/document/:documentName
 * 특정 문서 삭제
 */
app.delete('/api/document/:documentName', async (req, res) => {
  try {
    const { documentName } = req.params;
    const agent = getAgent();

    await agent.deleteDocument(decodeURIComponent(documentName));

    res.json({
      success: true,
      message: '문서가 삭제되었습니다.'
    });
  } catch (error) {
    console.error('문서 삭제 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/files
 * Files API 파일 목록 조회
 */
app.get('/api/files', async (req, res) => {
  try {
    const agent = getAgent();
    const files = await agent.listUploadedFiles();

    res.json({
      success: true,
      files: files
    });
  } catch (error) {
    console.error('파일 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/file/:fileName
 * Files API 파일 삭제
 */
app.delete('/api/file/:fileName', async (req, res) => {
  try {
    const { fileName } = req.params;
    const agent = getAgent();

    await agent.deleteUploadedFile(decodeURIComponent(fileName));

    res.json({
      success: true,
      message: '파일이 삭제되었습니다.'
    });
  } catch (error) {
    console.error('파일 삭제 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});





// ==================== 노무 AI 전용 API ====================

/**
 * 노무 AI 전용 RAG Agent 인스턴스 관리
 */
let laborAgentInstance = null;

async function getLaborAgent() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.');
  }

  const laborStoreName = process.env.LABOR_STORE_NAME || 'labor-law-knowledge-base';

  if (!laborAgentInstance) {
    laborAgentInstance = new RAGAgent(process.env.GEMINI_API_KEY);
    await laborAgentInstance.initialize(laborStoreName);
  }

  return laborAgentInstance;
}

/**
 * 노무 AI - 관련 법령/판례 분석 그래프 생성
 * POST /api/labor/analyze-case
 * Body: { description: string }
 * 
 * 1차: RAG (askLabor + findSimilarCases) → citations으로 그래프 노드 생성
 * 2차 (RAG fallback): Gemini 직접 호출 → 관련 법령/판례/행정해석 추출
 */
app.post('/api/labor/analyze-case', verifyToken, async (req, res) => {
  try {
    const { description } = req.body;

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: '사건 내용이 필요합니다.'
      });
    }

    console.log(`[법령 분석] 시작: ${description.substring(0, 50)}...`);

    const nodes = [];
    const links = [];
    const seenTitles = new Set();
    let summary = '';

    // 센터 노드 (사건)
    const centerLabel = description.length > 30
      ? description.substring(0, 30) + '...'
      : description;

    nodes.push({
      id: 'center',
      label: centerLabel,
      type: 'case',
      detail: description,
      val: 25
    });

    // ── 1차: RAG 검색 시도 ──
    let ragHasResults = false;
    try {
      const agent = await getLaborAgent();
      const [askResult, casesResult] = await Promise.allSettled([
        agent.askLabor(description, { includeCases: true, includeInterpretations: true }),
        agent.findSimilarCases(description)
      ]);

      const askData = askResult.status === 'fulfilled' ? askResult.value : null;
      const casesData = casesResult.status === 'fulfilled' ? casesResult.value : null;

      summary = askData ? (askData.text || String(askData)) : '';

      const allCitations = [
        ...(askData?.citations || []),
        ...(casesData?.citations || [])
      ];

      allCitations.forEach((cit, idx) => {
        if (seenTitles.has(cit.title)) return;
        seenTitles.add(cit.title);

        const nodeType = classifyCitationType(cit.title);
        const nodeId = `rag-${idx}`;

        nodes.push({
          id: nodeId,
          label: cit.title,
          type: nodeType,
          detail: cit.uri || '',
          val: 12
        });

        links.push({
          source: 'center',
          target: nodeId,
          label: getRelationLabel(nodeType)
        });
      });

      ragHasResults = allCitations.length > 0;
      console.log(`[법령 분석] RAG 결과: ${allCitations.length}건`);
    } catch (ragError) {
      console.warn('[법령 분석] RAG 검색 실패, Gemini 폴백 진행:', ragError.message);
    }

    // ── 2차: RAG 결과가 없으면 Gemini로 직접 법령/판례 추출 ──
    if (!ragHasResults) {
      console.log('[법령 분석] RAG 결과 없음 → Gemini 직접 분석');

      try {
        const { GoogleGenAI } = require('@google/genai');
        const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        const lawPrompt = `당신은 한국 노동법 전문가입니다. 아래 노동 사건과 관련된 **법령**, **판례**, **행정해석**을 구체적으로 분석해주세요.

규칙:
- 반드시 실제 존재하는 한국 법령명, 조항, 판례번호를 제시하세요
- 각 항목의 type은 "law"(법령), "precedent"(판례), "interpretation"(행정해석/고용노동부 해석) 중 하나입니다
- relevance는 사건과의 관련도입니다 (high/medium/low)
- detail에는 해당 법령/판례가 이 사건에 어떻게 적용되는지 구체적으로 설명하세요
- 최소 5개, 최대 12개 항목을 제시하세요
- 법령은 조항까지 구체적으로 명시 (예: "근로기준법 제23조 제1항")
- 판례는 판례번호 포함 (예: "대법원 2020다12345")

응답 형식 (JSON):
{
  "items": [
    {
      "title": "근로기준법 제23조 제1항 (해고 등의 제한)",
      "type": "law",
      "relevance": "high",
      "detail": "사용자는 정당한 이유 없이 근로자를 해고하지 못한다. 본 사건에서..."
    },
    {
      "title": "대법원 2018다12345 판결",
      "type": "precedent",
      "relevance": "high",
      "detail": "부당해고 요건에 대한 대법원 판시 사항..."
    }
  ],
  "summary": "이 사건에 적용되는 법령과 판례를 종합 분석한 요약 (3~5문장)"
}

사건 내용:
${description.substring(0, 3000)}`;

        const response = await genai.models.generateContent({
          model: 'gemini-2.5-pro',
          contents: [{ role: 'user', parts: [{ text: lawPrompt }] }],
          config: {
            responseMimeType: 'application/json',
          }
        });

        const responseText = response.text || '';
        const lawData = JSON.parse(responseText);
        const items = (lawData.items || []).slice(0, 12);

        if (lawData.summary) {
          summary = lawData.summary;
        }

        items.forEach((item, idx) => {
          if (seenTitles.has(item.title)) return;
          seenTitles.add(item.title);

          const nodeType = item.type || classifyCitationType(item.title);
          const nodeId = `gemini-${idx}`;

          nodes.push({
            id: nodeId,
            label: item.title,
            type: nodeType,
            detail: item.detail || '',
            val: item.relevance === 'high' ? 16 : item.relevance === 'medium' ? 12 : 9,
            severity: item.relevance || 'medium'
          });

          links.push({
            source: 'center',
            target: nodeId,
            label: getRelationLabel(nodeType)
          });
        });

        console.log(`[법령 분석] Gemini 결과: ${items.length}건`);
      } catch (geminiError) {
        console.error('[법령 분석] Gemini 분석 실패:', geminiError.message);
        if (!summary) {
          summary = '관련 법령 분석 중 오류가 발생했습니다. 다시 시도해주세요.';
        }
      }
    }

    console.log(`[법령 분석] 그래프 완료: ${nodes.length} nodes, ${links.length} links`);

    res.json({
      success: true,
      data: {
        summary,
        nodes,
        links,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[법령 분석] 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 노무 AI - 핵심 쟁점 분석 + 쟁점별 관련 법령/판례 그래프
 * POST /api/labor/analyze-issues
 * Body: { description: string }
 * 
 * 1단계: Gemini로 핵심 법적 쟁점 추출 (최대 5개)
 * 2단계: 각 쟁점별 RAG 검색 (관련 법령/판례/행정해석)
 * 3단계: Issue-centric 그래프 구조 반환
 */
app.post('/api/labor/analyze-issues', verifyToken, async (req, res) => {
  try {
    const { description } = req.body;

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: '사건 내용이 필요합니다.'
      });
    }

    console.log(`[쟁점 분석] 시작: ${description.substring(0, 50)}...`);

    const agent = await getLaborAgent();

    // 1단계: Gemini로 핵심 쟁점 추출
    const { GoogleGenAI } = require('@google/genai');
    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const issueExtractionPrompt = `당신은 한국 노동법 전문가입니다. 아래 사건 내용을 분석하여 핵심 법적 쟁점을 추출하고, 각 쟁점별 근로자의 승소 가능성을 예측해주세요.

규칙:
- 최소 2개, 최대 5개의 핵심 쟁점을 추출하세요
- 각 쟁점은 노동법상 실질적인 법적 쟁점이어야 합니다
- severity는 사건에서의 중요도입니다 (high: 핵심 쟁점, medium: 주요 쟁점, low: 부수적 쟁점)
- winRate는 근로자의 승소 가능성을 0~100 사이의 정수로 제시하세요
- winRateReason은 해당 승률을 판단한 구체적 근거를 1~2문장으로 설명하세요
- favorableFactors는 근로자에게 유리한 요소 목록 (최소 1개)
- unfavorableFactors는 근로자에게 불리한 요소 목록 (없으면 빈 배열)
- overallWinRate는 모든 쟁점을 종합한 전체 승소 가능성 (0~100 정수)
- overallAssessment는 전체적인 승패 전망을 2~3문장으로 서술하세요
- 반드시 아래 JSON 형식으로만 응답하세요

응답 형식:
{
  "issues": [
    {
      "title": "부당해고 여부",
      "summary": "정당한 사유 없이 근로자를 해고한 것이 부당해고에 해당하는지 여부",
      "severity": "high",
      "searchQuery": "부당해고 정당한 사유 근로기준법 제23조",
      "winRate": 72,
      "winRateReason": "근로기준법 제23조 위반이 명확하나, 사용자측 징계사유 입증 가능성이 있어 72%로 판단",
      "favorableFactors": ["해고 사전통보 의무 미이행", "서면통지 없음"],
      "unfavorableFactors": ["근무태도 지적 사실 존재"]
    }
  ],
  "overallSummary": "이 사건의 전체적인 법적 쟁점 요약",
  "overallWinRate": 65,
  "overallAssessment": "전반적으로 근로자에게 유리하나 일부 쟁점에서 반론 가능성이 존재합니다."
}

사건 내용:
${description.substring(0, 3000)}`;

    const issueResponse = await genai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: [{ role: 'user', parts: [{ text: issueExtractionPrompt }] }],
      config: {
        responseMimeType: 'application/json',
      }
    });

    let issueData;
    try {
      const responseText = issueResponse.text || '';
      issueData = JSON.parse(responseText);
    } catch (parseErr) {
      console.error('[쟁점 분석] JSON 파싱 실패, 폴백 처리:', parseErr);
      // 폴백: 기본 쟁점 하나 생성
      issueData = {
        issues: [{
          title: '사건 분석',
          summary: description.substring(0, 100),
          severity: 'high',
          searchQuery: description.substring(0, 200),
          winRate: 50,
          winRateReason: '사건 내용 분석 중입니다.',
          favorableFactors: [],
          unfavorableFactors: []
        }],
        overallSummary: '사건을 분석 중입니다.',
        overallWinRate: 50,
        overallAssessment: '사건을 분석 중입니다.'
      };
    }

    const issues = (issueData.issues || []).slice(0, 5); // 최대 5개 제한
    const overallSummary = issueData.overallSummary || '';
    const overallWinRate = typeof issueData.overallWinRate === 'number' ? issueData.overallWinRate : null;
    const overallAssessment = issueData.overallAssessment || '';

    console.log(`[쟁점 분석] ${issues.length}개 쟁점 추출 완료`);

    // 2단계: 각 쟁점별로 관련 법령/판례 RAG 검색 (병렬)
    const issueSearchPromises = issues.map((issue, idx) => {
      const query = issue.searchQuery || `${issue.title} 관련 법령 판례 행정해석`;
      return agent.askLabor(query, {
        includeCases: true,
        includeInterpretations: true
      }).then(result => ({ issueIdx: idx, result }))
        .catch(err => {
          console.error(`[쟁점 분석] 쟁점 ${idx} RAG 검색 실패:`, err);
          return { issueIdx: idx, result: null };
        });
    });

    const searchResults = await Promise.all(issueSearchPromises);

    // 2.5단계: RAG 결과가 부족한 쟁점에 대해 Gemini 폴백
    const issuesWithNoCitations = issues.map((issue, idx) => {
      const sr = searchResults.find(r => r.issueIdx === idx);
      const citCount = sr?.result?.citations?.length || 0;
      return { idx, issue, citCount };
    }).filter(x => x.citCount === 0);

    if (issuesWithNoCitations.length > 0) {
      console.log(`[쟁점 분석] RAG 결과 없는 쟁점 ${issuesWithNoCitations.length}개 → Gemini 폴백`);
      try {
        const fallbackPrompt = `당신은 한국 노동법 전문가입니다. 아래 사건의 핵심 쟁점별로 관련 법령, 판례, 행정해석을 구체적으로 제시해주세요.

사건 내용:
${description.substring(0, 2000)}

쟁점 목록:
${issuesWithNoCitations.map((x, i) => `${i + 1}. ${x.issue.title}: ${x.issue.summary}`).join('\n')}

규칙:
- 각 쟁점별로 관련 법령/판례를 최소 2개, 최대 4개 제시
- 반드시 실제 존재하는 한국 법령명과 조항, 또는 판례번호를 제시
- type은 "law"(법령), "precedent"(판례), "interpretation"(행정해석) 중 하나
- 반드시 아래 JSON 형식으로만 응답

{
  "issueResults": [
    {
      "issueIndex": 0,
      "citations": [
        { "title": "근로기준법 제23조 제1항", "type": "law", "detail": "정당한 이유 없는 해고 금지" }
      ]
    }
  ]
}`;

        const fallbackResponse = await genai.models.generateContent({
          model: 'gemini-2.5-pro',
          contents: [{ role: 'user', parts: [{ text: fallbackPrompt }] }],
          config: { responseMimeType: 'application/json' },
        });

        const fallbackText = fallbackResponse.text || '';
        const fallbackData = JSON.parse(fallbackText);
        const issueResults = fallbackData.issueResults || [];

        issueResults.forEach(ir => {
          const mapping = issuesWithNoCitations[ir.issueIndex];
          if (!mapping) return;
          const originalIdx = mapping.idx;
          const existing = searchResults.find(r => r.issueIdx === originalIdx);
          if (existing) {
            const newCitations = (ir.citations || []).map(c => ({
              title: c.title,
              uri: c.detail || '',
              _type: c.type || 'law',
            }));
            if (!existing.result) {
              existing.result = { citations: newCitations };
            } else {
              existing.result.citations = [...(existing.result.citations || []), ...newCitations];
            }
          }
        });
        console.log(`[쟁점 분석] Gemini 폴백 완료: ${issueResults.length}개 쟁점에 법령 추가`);
      } catch (geminiErr) {
        console.warn('[쟁점 분석] Gemini 폴백 실패:', geminiErr.message);
      }
    }


    // 3단계: Issue-centric 그래프 구조 생성
    const nodes = [];
    const links = [];
    const seenTitles = new Set();
    const issueInfoList = [];

    // 센터 노드 (사건)
    const centerLabel = description.length > 30
      ? description.substring(0, 30) + '...'
      : description;

    nodes.push({
      id: 'center',
      label: centerLabel,
      type: 'case',
      detail: description,
      val: 25
    });

    // 쟁점 노드 + 하위 법령/판례 노드
    issues.forEach((issue, idx) => {
      const issueId = `issue-${idx}`;

      // 쟁점 정보
      issueInfoList.push({
        id: issueId,
        title: issue.title,
        summary: issue.summary,
        severity: issue.severity || 'medium',
        winRate: typeof issue.winRate === 'number' ? issue.winRate : null,
        winRateReason: issue.winRateReason || '',
        favorableFactors: issue.favorableFactors || [],
        unfavorableFactors: issue.unfavorableFactors || [],
      });

      // 쟁점 노드
      nodes.push({
        id: issueId,
        label: issue.title,
        type: 'issue',
        detail: issue.summary,
        val: 18,
        severity: issue.severity || 'medium'
      });

      // 사건 → 쟁점 링크
      links.push({
        source: 'center',
        target: issueId,
        label: '핵심 쟁점'
      });

      // 해당 쟁점의 RAG 검색 결과에서 하위 노드 생성
      const searchResult = searchResults.find(r => r.issueIdx === idx);
      const citations = searchResult?.result?.citations || [];

      citations.forEach((cit, citIdx) => {
        if (seenTitles.has(cit.title)) {
          // 이미 존재하는 노드라면 링크만 추가 (같은 법령이 여러 쟁점에 관련될 수 있음)
          const existingNode = nodes.find(n => n.label === cit.title);
          if (existingNode) {
            links.push({
              source: issueId,
              target: existingNode.id,
              label: getRelationLabel(existingNode.type)
            });
          }
          return;
        }
        seenTitles.add(cit.title);

        const nodeType = cit._type || classifyCitationType(cit.title);
        const nodeId = `${issueId}-ref-${citIdx}`;

        nodes.push({
          id: nodeId,
          label: cit.title,
          type: nodeType,
          detail: cit.uri || '',
          val: 10,
          parentIssue: issueId
        });

        links.push({
          source: issueId,
          target: nodeId,
          label: getRelationLabel(nodeType)
        });
      });
    });

    console.log(`[쟁점 분석] 그래프 생성 완료: ${nodes.length} nodes, ${links.length} links`);

    res.json({
      success: true,
      data: {
        issues: issueInfoList,
        summary: overallSummary,
        overallWinRate,
        overallAssessment,
        nodes,
        links,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[쟁점 분석] 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Citation 제목으로 문서 유형 분류
 */
function classifyCitationType(title) {
  if (!title) return 'unknown';
  if (title.includes('법') || title.includes('령') || title.includes('규칙') || title.includes('조')) {
    return 'law';
  }
  if (title.includes('판결') || title.includes('선고') || title.includes('대법') || /\d{4}[가-힣]+\d+/.test(title)) {
    return 'precedent';
  }
  if (title.includes('해석') || title.includes('지침') || title.includes('회시') || title.includes('고용노동부')) {
    return 'interpretation';
  }
  if (title.includes('노동위') || title.includes('결정')) {
    return 'decision';
  }
  return 'unknown';
}

/**
 * 노드 유형에 따른 관계 레이블
 */
function getRelationLabel(nodeType) {
  switch (nodeType) {
    case 'law': return '근거 법령';
    case 'precedent': return '유사 판례';
    case 'interpretation': return '행정 해석';
    case 'decision': return '노동위 결정';
    default: return '관련 문서';
  }
}

/**
 * 노무 AI - 파일 업로드 → 텍스트 추출 → 사건 분석
 * POST /api/labor/analyze-file
 * Body: multipart/form-data (file)
 * 
 * 근로계약서, 급여명세서 등 파일 업로드 → Gemini로 텍스트 추출 → analyze-case 자동 실행
 */
app.post('/api/labor/analyze-file', verifyToken, upload.single('file'), async (req, res) => {
  let filePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '파일이 업로드되지 않았습니다.'
      });
    }

    filePath = req.file.path;
    const originalName = req.file.originalname;
    console.log(`[사건 분석] 파일 업로드 분석 시작: ${originalName}`);

    const agent = await getLaborAgent();

    // 1. Gemini File API로 텍스트를 추출하거나, 직접 읽기
    let extractedText = '';
    const ext = path.extname(originalName).toLowerCase();

    if (['.txt', '.md', '.json'].includes(ext)) {
      // 텍스트 파일은 직접 읽기
      extractedText = fs.readFileSync(filePath, 'utf-8');
    } else {
      // PDF, 이미지, 문서 등은 Gemini로 내용 분석
      const { GoogleGenAI } = require('@google/genai');
      const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      const fileBuffer = fs.readFileSync(filePath);
      const base64Data = fileBuffer.toString('base64');

      const mimeMap = {
        '.pdf': 'application/pdf',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.hwp': 'application/x-hwp',
      };
      const mimeType = mimeMap[ext] || 'application/octet-stream';

      const response = await genai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: [{
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data
              }
            },
            {
              text: '이 문서의 내용을 모두 텍스트로 추출해주세요. 노동법 관련 사건 분석에 사용됩니다. 핵심 사실관계, 계약 조건, 급여 정보, 근로 조건 등을 정리해주세요.'
            }
          ]
        }]
      });

      extractedText = response.text || '';
    }

    if (!extractedText || extractedText.trim().length < 10) {
      await cleanupFile(filePath);
      return res.status(400).json({
        success: false,
        error: '파일에서 충분한 텍스트를 추출하지 못했습니다.'
      });
    }

    console.log(`[사건 분석] 텍스트 추출 완료: ${extractedText.length}자`);

    // 2. 추출된 텍스트로 사건 분석 수행 (analyze-case와 동일 로직)
    const [askResult, casesResult] = await Promise.allSettled([
      agent.askLabor(extractedText.substring(0, 3000), {
        includeCases: true,
        includeInterpretations: true
      }),
      agent.findSimilarCases(extractedText.substring(0, 2000))
    ]);

    const askData = askResult.status === 'fulfilled' ? askResult.value : null;
    const casesData = casesResult.status === 'fulfilled' ? casesResult.value : null;

    const summary = askData ? (askData.text || askData) : '분석 결과를 가져올 수 없습니다.';
    const similarCasesSummary = casesData ? (casesData.text || casesData) : '';

    const nodes = [];
    const links = [];
    const seenTitles = new Set();

    const centerLabel = originalName.length > 25
      ? originalName.substring(0, 25) + '...'
      : originalName;

    nodes.push({
      id: 'center',
      label: centerLabel,
      type: 'case',
      detail: extractedText.substring(0, 500),
      val: 25
    });

    const askCitations = askData?.citations || [];
    askCitations.forEach((cit, idx) => {
      if (seenTitles.has(cit.title)) return;
      seenTitles.add(cit.title);
      const nodeType = classifyCitationType(cit.title);
      const nodeId = `ask-${idx}`;
      nodes.push({ id: nodeId, label: cit.title, type: nodeType, detail: cit.uri || '', val: 12 });
      links.push({ source: 'center', target: nodeId, label: getRelationLabel(nodeType) });
    });

    const casesCitations = casesData?.citations || [];
    casesCitations.forEach((cit, idx) => {
      if (seenTitles.has(cit.title)) return;
      seenTitles.add(cit.title);
      const nodeType = classifyCitationType(cit.title);
      const nodeId = `case-${idx}`;
      nodes.push({ id: nodeId, label: cit.title, type: nodeType, detail: cit.uri || '', val: 12 });
      links.push({ source: 'center', target: nodeId, label: getRelationLabel(nodeType) });
    });

    // 파일 정리
    await cleanupFile(filePath);

    console.log(`[사건 분석] 파일 분석 완료: ${nodes.length} nodes`);

    res.json({
      success: true,
      data: {
        fileName: originalName,
        extractedText: extractedText.substring(0, 1000),
        summary,
        similarCasesSummary,
        nodes,
        links,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[사건 분석] 파일 분석 오류:', error);
    if (filePath) await cleanupFile(filePath);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 노무 AI - 그래프 노드 확장 (2-depth)
 * POST /api/labor/expand-node
 * Body: { nodeLabel: string, nodeType: string }
 * 
 * 특정 노드 클릭 시 관련 하위 문서(시행령, 하위 조항, 관련 판례 등)를 검색하여
 * 추가 nodes/links를 반환
 */
app.post('/api/labor/expand-node', verifyToken, async (req, res) => {
  try {
    const { nodeLabel, nodeType, nodeId } = req.body;

    if (!nodeLabel) {
      return res.status(400).json({
        success: false,
        error: '노드 레이블이 필요합니다.'
      });
    }

    console.log(`[그래프 확장] ${nodeType}: ${nodeLabel}`);

    const agent = await getLaborAgent();

    // 노드 유형에 따라 다른 질의 생성
    let query = '';
    if (nodeType === 'law') {
      query = `"${nodeLabel}"에 대해 다음을 알려주세요: 1) 관련 시행령/시행규칙 조항 2) 관련 판례 3) 관련 행정해석. 각 항목의 정확한 법조문 번호와 판례 번호를 포함해주세요.`;
    } else if (nodeType === 'precedent') {
      query = `"${nodeLabel}" 판례에 대해 다음을 알려주세요: 1) 적용된 법령 조항 2) 유사한 다른 판례 3) 이 판례의 핵심 판시사항. 각 항목의 정확한 법조문 번호를 포함해주세요.`;
    } else if (nodeType === 'interpretation') {
      query = `"${nodeLabel}" 행정해석에 대해 다음을 알려주세요: 1) 근거 법령 2) 관련 판례 3) 실무 적용 방법.`;
    } else {
      query = `"${nodeLabel}"와 관련된 법령, 판례, 행정해석을 알려주세요.`;
    }

    const result = await agent.askLabor(query, {
      includeCases: true,
      includeInterpretations: true
    });

    const newNodes = [];
    const newLinks = [];
    const seenTitles = new Set();
    seenTitles.add(nodeLabel); // 원본 노드 제외

    const citations = result?.citations || [];
    citations.forEach((cit, idx) => {
      if (seenTitles.has(cit.title)) return;
      seenTitles.add(cit.title);

      const citType = classifyCitationType(cit.title);
      const newNodeId = `expand-${nodeId}-${idx}`;

      newNodes.push({
        id: newNodeId,
        label: cit.title,
        type: citType,
        detail: cit.uri || '',
        val: 8
      });

      newLinks.push({
        source: nodeId || nodeLabel,
        target: newNodeId,
        label: getRelationLabel(citType)
      });
    });

    console.log(`[그래프 확장] 완료: +${newNodes.length} nodes`);

    res.json({
      success: true,
      data: {
        expandedNodeId: nodeId,
        detail: result?.text || result || '',
        newNodes,
        newLinks,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[그래프 확장] 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 노무 AI - 법률 서면 자동생성
 * POST /api/labor/generate-document
 * Body: { caseDescription: string, documentType: string, additionalInfo?: object }
 * 
 * documentType: 'complaint' (고소장/진정서), 'response' (답변서), 'objection' (이의신청서),
 *               'appeal' (항고장), 'evidence' (증거목록/설명서)
 */
app.post('/api/labor/generate-document', verifyToken, async (req, res) => {
  try {
    const { caseDescription, documentType, additionalInfo } = req.body;

    if (!caseDescription || !documentType) {
      return res.status(400).json({
        success: false,
        error: '사건 설명과 서면 유형이 필요합니다.'
      });
    }

    const docTypeMap = {
      complaint: {
        name: '진정서/고소장',
        prompt: `다음 사건 내용을 바탕으로 노동부/노동위원회에 제출할 진정서 또는 고소장 초안을 작성해주세요.
형식: 제목, 진정인(빈칸), 피진정인(빈칸), 진정취지, 진정이유(사실관계+법적근거), 입증자료 목록, 결론
법적 근거가 되는 조항을 정확히 명시하고, 사실관계를 구체적으로 정리해주세요.`
      },
      response: {
        name: '답변서',
        prompt: `다음 사건 내용에 대한 답변서 초안을 작성해주세요.
형식: 제목, 당사자 표시(빈칸), 답변 취지, 답변 이유(사실관계에 대한 반박 및 법적 근거), 결론
법적 근거를 명시하고, 각 쟁점에 대해 체계적으로 답변해주세요.`
      },
      objection: {
        name: '이의신청서',
        prompt: `다음 사건 내용을 바탕으로 이의신청서 초안을 작성해주세요.
형식: 제목, 신청인(빈칸), 이의신청 취지, 이의신청 이유, 결론
관련 법령과 판례를 인용하여 이의신청 사유를 구체적으로 기술해주세요.`
      },
      appeal: {
        name: '항고장/재심신청서',
        prompt: `다음 사건 내용을 바탕으로 재심신청서 또는 항고장 초안을 작성해주세요.
형식: 제목, 재심신청인(빈칸), 원처분 내용, 재심신청 취지, 재심신청 이유, 결론
원판정의 부당성과 법적 근거를 명확히 기술해주세요.`
      },
      evidence: {
        name: '증거설명서/증거목록',
        prompt: `다음 사건 내용을 바탕으로 증거설명서와 증거목록을 작성해주세요.
형식: 증거번호, 증거명칭, 작성일자, 작성자, 입증취지를 표 형태로 정리
사건 해결에 필요한 핵심 증거를 체계적으로 분류해주세요.`
      }
    };

    const docConfig = docTypeMap[documentType];
    if (!docConfig) {
      return res.status(400).json({
        success: false,
        error: '유효하지 않은 서면 유형입니다. (complaint, response, objection, appeal, evidence)'
      });
    }

    console.log(`[서면 생성] ${docConfig.name} 생성 시작`);

    const agent = await getLaborAgent();

    const fullPrompt = `${docConfig.prompt}

[사건 내용]
${caseDescription}

${additionalInfo ? `[추가 정보]\n${JSON.stringify(additionalInfo, null, 2)}` : ''}

중요: 실제 법률 서면 형식을 최대한 충실히 따르되, 빈칸으로 남겨야 할 개인정보(이름, 주소, 전화번호 등)는 ___으로 표시해주세요.
작성일자는 오늘 날짜로 기재해주세요.`;

    const result = await agent.askLabor(fullPrompt, {
      includeCases: true,
      includeInterpretations: true
    });

    const documentContent = result?.text || result || '';
    const citations = result?.citations || [];

    console.log(`[서면 생성] ${docConfig.name} 생성 완료 (${documentContent.length}자)`);

    res.json({
      success: true,
      data: {
        documentType,
        documentTypeName: docConfig.name,
        content: documentContent,
        citations: citations.map(c => c.title || c),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[서면 생성] 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 노무 AI - 질의응답
 * POST /api/labor/ask
 * Body: { query, category?, includeCases?, includeInterpretations?, model? }
 */
app.post('/api/labor/ask', verifyToken, async (req, res) => {
  try {
    const { query, category, includeCases, includeInterpretations, model } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: '질문 내용이 필요합니다.'
      });
    }

    console.log(`[노무 AI] 질의: ${query.substring(0, 50)}...`);

    const agent = await getLaborAgent();
    const result = await agent.askLabor(query, {
      category,
      includeCases,
      includeInterpretations,
      model
    });

    res.json({
      success: true,
      data: {
        query,
        answer: result.text || result, // 객체인 경우 text, 문자인 경우 그대로
        citations: result.citations || [],
        groundingMetadata: result.groundingMetadata,
        category: category || agent.detectLaborCategory(query),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[노무 AI] 질의응답 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 노무 AI - 법령·판례 구조화 검색 (법령 ↔ 판례 매칭)
 * POST /api/labor/law-search
 * Body: { query: string, type?: 'all'|'law'|'case'|'interpretation', category?: string }
 */
app.post('/api/labor/law-search', async (req, res) => {
  try {
    const { query, type = 'all', category } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ success: false, error: '검색어가 필요합니다.' });
    }

    console.log(`[법령 검색] 구조화 검색: "${query.substring(0, 50)}..." (type=${type})`);

    const agent = await getLaborAgent();
    const typeLabels = { law: '법령', case: '판례', interpretation: '행정해석' };
    let searchScope = '';
    if (type !== 'all') {
      searchScope = `\n특히 ${typeLabels[type]}을(를) 중심으로 검색하되, 관련된 다른 유형의 자료도 포함해주세요.`;
    }

    const structuredPrompt = `다음 검색어에 대해 관련 노동법령, 판례, 행정해석을 검색하고 구조화된 JSON 형식으로 반환해주세요.${searchScope}

검색어: "${query}"
${category ? `카테고리: ${category}` : ''}

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요:
{
  "laws": [
    { "id": "law-1", "title": "법령명 제N조 (조항 제목)", "article": "제N조", "summary": "해당 조항의 핵심 내용 요약 (2~3문장)", "lawType": "act|decree|rule", "lawName": "법령명" }
  ],
  "cases": [
    { "id": "case-1", "title": "판례 제목 (대법원 20XX다XXXXX 등)", "court": "대법원|고등법원|지방법원|중앙노동위원회", "date": "YYYY.MM.DD", "summary": "핵심 판시사항 요약 (2~3문장)", "verdict": "원고승|원고패|일부인용|화해" }
  ],
  "interpretations": [
    { "id": "interp-1", "title": "행정해석 제목", "date": "YYYY.MM.DD", "summary": "핵심 내용 요약 (2~3문장)", "agency": "고용노동부|노동위원회" }
  ],
  "matches": [
    { "lawId": "law-1", "caseId": "case-1", "relation": "해당 판례가 이 법령을 인용/적용" }
  ]
}

주의사항:
1. 각 항목에 정확한 법조문 번호, 판례 번호를 포함해주세요.
2. matches 배열에는 법령과 판례 간의 관계를 모두 기록해주세요.
3. 검색 결과가 없는 카테고리는 빈 배열로 반환해주세요.
4. 최소 2개 이상의 법령과 2개 이상의 판례를 찾아주세요.
5. JSON만 반환하고, 설명 텍스트는 포함하지 마세요.`;

    const result = await agent.askLabor(structuredPrompt, {
      category,
      includeCases: type === 'all' || type === 'case',
      includeInterpretations: type === 'all' || type === 'interpretation'
    });

    const rawText = result?.text || result || '';
    const citations = result?.citations || [];

    // JSON 파싱 시도
    let parsed = null;
    try {
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/) || rawText.match(/(\{[\s\S]*\})/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[1].trim());
    } catch (parseErr) {
      console.warn('[법령 검색] JSON 파싱 실패, 폴백 처리:', parseErr.message);
    }

    // 파싱 실패 시 citations 기반 폴백
    if (!parsed) {
      parsed = { laws: [], cases: [], interpretations: [], matches: [] };
      citations.forEach((cit, idx) => {
        const title = cit.title || '';
        const citType = classifyCitationType(title);
        if (citType === 'law') {
          parsed.laws.push({ id: `law-${idx + 1}`, title, article: '', summary: rawText.substring(0, 200), lawType: 'act', lawName: title });
        } else if (citType === 'precedent') {
          parsed.cases.push({ id: `case-${idx + 1}`, title, court: '', date: '', summary: rawText.substring(0, 200), verdict: '' });
        } else if (citType === 'interpretation') {
          parsed.interpretations.push({ id: `interp-${idx + 1}`, title, date: '', summary: rawText.substring(0, 200), agency: '' });
        }
      });
      if (parsed.laws.length === 0 && parsed.cases.length === 0) {
        parsed.laws.push({ id: 'law-ai-1', title: `"${query}" 관련 법령`, article: '', summary: rawText.substring(0, 500), lawType: 'act', lawName: '' });
      }
    }

    // matchMap 구성
    const matchMap = {};
    if (parsed.matches && Array.isArray(parsed.matches)) {
      parsed.matches.forEach(m => {
        if (m.lawId && m.caseId) {
          if (!matchMap[m.lawId]) matchMap[m.lawId] = [];
          if (!matchMap[m.caseId]) matchMap[m.caseId] = [];
          if (!matchMap[m.lawId].includes(m.caseId)) matchMap[m.lawId].push(m.caseId);
          if (!matchMap[m.caseId].includes(m.lawId)) matchMap[m.caseId].push(m.lawId);
        }
      });
    }
    (parsed.laws || []).forEach(law => { law.relatedCaseIds = matchMap[law.id] || []; });
    (parsed.cases || []).forEach(c => { c.relatedLawIds = matchMap[c.id] || []; });
    (parsed.interpretations || []).forEach(i => { i.relatedLawIds = matchMap[i.id] || []; });

    console.log(`[법령 검색] 완료: 법령 ${parsed.laws?.length || 0}건, 판례 ${parsed.cases?.length || 0}건, 행정해석 ${parsed.interpretations?.length || 0}건`);

    res.json({
      success: true,
      data: {
        laws: parsed.laws || [], cases: parsed.cases || [],
        interpretations: parsed.interpretations || [], matchMap,
        query, timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[법령 검색] 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 노무 AI - 유사 판례 검색
 * POST /api/labor/similar-cases
 * Body: { description, model? }
 */
app.post('/api/labor/similar-cases', async (req, res) => {
  try {
    const { description, model } = req.body;

    if (!description || typeof description !== 'string') {
      return res.status(400).json({
        success: false,
        error: '사건 설명이 필요합니다.'
      });
    }

    console.log(`[노무 AI] 유사 판례 검색 중...`);

    const agent = await getLaborAgent();
    const result = await agent.findSimilarCases(description, { model });

    res.json({
      success: true,
      data: {
        description,
        result: result.text || result,
        citations: result.citations || [],
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[노무 AI] 유사 판례 검색 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 노무 AI - 법령 조항 검색
 * POST /api/labor/law-article
 * Body: { lawName, article, model? }
 */
app.post('/api/labor/law-article', async (req, res) => {
  try {
    const { lawName, article, model } = req.body;

    if (!lawName || !article) {
      return res.status(400).json({
        success: false,
        error: '법령명과 조문이 필요합니다.'
      });
    }

    console.log(`[노무 AI] 법령 조항 검색: ${lawName} ${article}`);

    const agent = await getLaborAgent();
    const result = await agent.searchLawArticle(lawName, article, { model });

    res.json({
      success: true,
      data: {
        lawName,
        article,
        result: result.text || result,
        citations: result.citations || [],
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[노무 AI] 법령 조항 검색 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 노무 AI - 템플릿 상담
 * POST /api/labor/consult
 * Body: { templateType, params }
 */
app.post('/api/labor/consult', async (req, res) => {
  try {
    const { templateType, params } = req.body;

    if (!templateType || !params) {
      return res.status(400).json({
        success: false,
        error: '템플릿 유형과 파라미터가 필요합니다.'
      });
    }

    console.log(`[노무 AI] 템플릿 상담: ${templateType}`);

    const agent = await getLaborAgent();
    const result = await agent.consultWithTemplate(templateType, params);

    res.json({
      success: true,
      data: {
        templateType,
        params,
        result: result.text || result,
        citations: result.citations || [],
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[노무 AI] 템플릿 상담 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 노무 AI - 카테고리 목록 조회
 * GET /api/labor/categories
 */
app.get('/api/labor/categories', (req, res) => {
  try {
    const { LaborCategories } = require('./models/laborSchemas');

    const categories = Object.entries(LaborCategories).map(([name, config]) => ({
      name,
      keywords: config.keywords,
      subcategories: config.subcategories
    }));

    res.json({
      success: true,
      data: categories
    });

  } catch (error) {
    console.error('[노무 AI] 카테고리 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 노무 AI - 법령 업로드
 * POST /api/labor/upload-law
 * Body: { title, metadata } + file upload
 */
app.post('/api/labor/upload-law', upload.single('file'), async (req, res) => {
  let filePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '파일이 업로드되지 않았습니다.'
      });
    }

    filePath = req.file.path;
    const { title, metadata } = req.body;

    // metadata는 JSON 문자열로 전달됨
    const parsedMetadata = typeof metadata === 'string'
      ? JSON.parse(metadata)
      : metadata;

    console.log(`[노무 AI] 법령 업로드: ${title}`);

    const agent = await getLaborAgent();

    // 스토어가 없으면 초기화
    if (!agent.storeName) {
      await agent.initialize(process.env.LABOR_STORE_NAME || 'labor-law-knowledge-base');
    }

    const result = await agent.uploadLaborLaw({
      filePath,
      title,
      metadata: parsedMetadata
    });

    // 업로드 성공 후 임시 파일 삭제
    await cleanupFile(filePath);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[노무 AI] 법령 업로드 오류:', error);

    // 오류 시에도 임시 파일 삭제
    if (filePath) {
      await cleanupFile(filePath);
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 노무 AI - 판례 업로드
 * POST /api/labor/upload-case
 * Body: { title, metadata } + file upload
 */
app.post('/api/labor/upload-case', upload.single('file'), async (req, res) => {
  let filePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '파일이 업로드되지 않았습니다.'
      });
    }

    filePath = req.file.path;
    const { title, metadata } = req.body;

    // metadata는 JSON 문자열로 전달됨
    const parsedMetadata = typeof metadata === 'string'
      ? JSON.parse(metadata)
      : metadata;

    console.log(`[노무 AI] 판례 업로드: ${title}`);

    const agent = await getLaborAgent();

    // 스토어가 없으면 초기화
    if (!agent.storeName) {
      await agent.initialize(process.env.LABOR_STORE_NAME || 'labor-law-knowledge-base');
    }

    const result = await agent.uploadLaborCase({
      filePath,
      title,
      metadata: parsedMetadata
    });

    // 업로드 성공 후 임시 파일 삭제
    await cleanupFile(filePath);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[노무 AI] 판례 업로드 오류:', error);

    // 오류 시에도 임시 파일 삭제
    if (filePath) {
      await cleanupFile(filePath);
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 노무 AI - 스토어 상태 조회
 * GET /api/labor/store-status
 */
app.get('/api/labor/store-status', async (req, res) => {
  try {
    const agent = await getLaborAgent();

    if (!agent.storeName) {
      return res.json({
        success: true,
        data: {
          initialized: false,
          message: '스토어가 초기화되지 않았습니다.'
        }
      });
    }

    const status = await agent.getStatus();

    res.json({
      success: true,
      data: {
        initialized: true,
        storeName: agent.storeName,
        status
      }
    });

  } catch (error) {
    console.error('[노무 AI] 스토어 상태 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 노무 AI - 스토어 초기화
 * POST /api/labor/initialize
 * Body: { storeName? }
 */
app.post('/api/labor/initialize', async (req, res) => {
  try {
    const { storeName } = req.body;
    const targetStoreName = storeName || process.env.LABOR_STORE_NAME || 'labor-law-knowledge-base';

    console.log(`[노무 AI] 스토어 초기화: ${targetStoreName}`);

    const agent = await getLaborAgent();
    await agent.initialize(targetStoreName);

    res.json({
      success: true,
      data: {
        storeName: agent.storeName,
        message: '스토어가 초기화되었습니다.'
      }
    });

  } catch (error) {
    console.error('[노무 AI] 스토어 초기화 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 노무 AI - Health Check
 * GET /api/labor/health
 */
app.get('/api/labor/health', (req, res) => {
  res.json({
    success: true,
    data: {
      service: 'Labor AI',
      status: 'running',
      apiKeyConfigured: !!process.env.GEMINI_API_KEY,
      laborStoreName: process.env.LABOR_STORE_NAME || 'labor-law-knowledge-base',
      timestamp: new Date().toISOString()
    }
  });
});

// ==================== 통합 사건 상담 API ====================

/**
 * 통합 사건 세션 생성
 * POST /api/labor/case-session/create
 * Body: multipart/form-data { description?, files[] }
 * 
 * 텍스트 + 복수 파일을 동시에 받아 분석 후 챗봇 세션을 자동 생성.
 * 분석 결과를 세션 컨텍스트에 주입하여 맥락 있는 상담이 가능하도록 함.
 */
app.post('/api/labor/case-session/create', verifyToken, upload.array('files', 10), async (req, res) => {
  const uploadedPaths = [];

  try {
    const description = req.body.description || '';
    const files = req.files || [];

    if (!description.trim() && files.length === 0) {
      return res.status(400).json({
        success: false,
        error: '사건 설명 또는 파일을 하나 이상 제공해주세요.'
      });
    }

    console.log(`[통합 상담] 세션 생성 시작 - 텍스트: ${description.length}자, 파일: ${files.length}개`);

    const agent = await getLaborAgent();
    if (!agent.storeName) {
      await agent.initialize(process.env.LABOR_STORE_NAME || 'labor-law-knowledge-base');
    }

    // 1. 파일에서 텍스트 추출
    let allExtractedTexts = [];

    for (const file of files) {
      uploadedPaths.push(file.path);
      const ext = path.extname(file.originalname).toLowerCase();

      let fileText = '';
      if (['.txt', '.md', '.json'].includes(ext)) {
        fileText = fs.readFileSync(file.path, 'utf-8');
      } else {
        try {
          const { GoogleGenAI } = require('@google/genai');
          const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

          const fileBuffer = fs.readFileSync(file.path);
          const base64Data = fileBuffer.toString('base64');

          const mimeMap = {
            '.pdf': 'application/pdf', '.png': 'image/png',
            '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
            '.gif': 'image/gif', '.webp': 'image/webp',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.hwp': 'application/x-hwp',
          };
          const mimeType = mimeMap[ext] || 'application/octet-stream';

          const response = await genai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: [{
              role: 'user',
              parts: [
                { inlineData: { mimeType, data: base64Data } },
                { text: '이 문서의 내용을 모두 텍스트로 추출해주세요. 핵심 사실관계, 계약 조건, 급여 정보, 근로 조건 등을 정리해주세요.' }
              ]
            }]
          });

          fileText = response.text || '';
        } catch (extractErr) {
          console.error(`[통합 상담] 파일 텍스트 추출 실패 (${file.originalname}):`, extractErr.message);
          fileText = `[파일: ${file.originalname} — 텍스트 추출 실패]`;
        }
      }

      allExtractedTexts.push({
        fileName: file.originalname,
        text: fileText.substring(0, 2000)
      });
    }

    // 2. 모든 텍스트 합치기
    const combinedText = [
      description,
      ...allExtractedTexts.map(f => `[첨부: ${f.fileName}]\n${f.text}`)
    ].filter(Boolean).join('\n\n');

    const analysisInput = combinedText.substring(0, 4000);

    console.log(`[통합 상담] 통합 텍스트: ${combinedText.length}자 → 분석 입력: ${analysisInput.length}자`);

    // 3. AI 분석 (병렬)
    const [askResult, casesResult] = await Promise.allSettled([
      agent.askLabor(analysisInput, { includeCases: true, includeInterpretations: true }),
      agent.findSimilarCases(analysisInput.substring(0, 2000))
    ]);

    const askData = askResult.status === 'fulfilled' ? askResult.value : null;
    const casesData = casesResult.status === 'fulfilled' ? casesResult.value : null;

    const summary = askData ? (askData.text || askData) : '분석 결과를 가져올 수 없습니다.';
    const similarCasesSummary = casesData ? (casesData.text || casesData) : '';

    // 4. 그래프 nodes/links 생성
    const nodes = [];
    const links = [];
    const seenTitles = new Set();

    nodes.push({
      id: 'center',
      label: description.length > 25 ? description.substring(0, 25) + '...' : (description || '사건 분석'),
      type: 'case',
      detail: combinedText.substring(0, 500),
      val: 25
    });

    const addCitations = (citations, prefix) => {
      (citations || []).forEach((cit, idx) => {
        if (seenTitles.has(cit.title)) return;
        seenTitles.add(cit.title);
        const nodeType = classifyCitationType(cit.title);
        const nodeId = `${prefix}-${idx}`;
        nodes.push({ id: nodeId, label: cit.title, type: nodeType, detail: cit.uri || '', val: 12 });
        links.push({ source: 'center', target: nodeId, label: getRelationLabel(nodeType) });
      });
    };

    addCitations(askData?.citations, 'ask');
    addCitations(casesData?.citations, 'case');

    // 5. 챗봇 세션 생성 + 컨텍스트 주입
    const chatSession = conversationManager.createSession(req.user?.userId);

    // 사건 분석 결과를 세션 컨텍스트에 주입
    const lawNodes = nodes.filter(n => n.type === 'law').map(n => n.label);
    const caseNodes = nodes.filter(n => n.type === 'precedent').map(n => n.label);

    conversationManager.updateContext(chatSession.sessionId, {
      issue: description || '첨부파일 기반 사건',
      details: {
        caseDescription: combinedText.substring(0, 2000),
        fileNames: allExtractedTexts.map(f => f.fileName),
        analysisTimestamp: new Date().toISOString()
      },
      laws: lawNodes,
      cases: caseNodes,
      caseContext: {
        summary: typeof summary === 'string' ? summary.substring(0, 1500) : '',
        similarCasesSummary: typeof similarCasesSummary === 'string' ? similarCasesSummary.substring(0, 1500) : '',
        nodeLabels: nodes.map(n => `[${n.type}] ${n.label}`).join(', ')
      }
    });

    // Firebase 저장
    if (conversationStorage) {
      await conversationStorage.saveSession(chatSession);
    }

    // 6. 파일 정리
    for (const p of uploadedPaths) {
      await cleanupFile(p);
    }

    console.log(`[통합 상담] 세션 생성 완료 - chat: ${chatSession.sessionId}, nodes: ${nodes.length}`);

    res.json({
      success: true,
      data: {
        caseSessionId: chatSession.sessionId,
        chatSessionId: chatSession.sessionId,
        summary,
        similarCasesSummary,
        nodes,
        links,
        extractedTexts: allExtractedTexts.map(f => ({ fileName: f.fileName, preview: f.text.substring(0, 200) })),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[통합 상담] 세션 생성 오류:', error);
    for (const p of uploadedPaths) {
      await cleanupFile(p);
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 사건 이력 관리 API (PostgreSQL/Prisma) ====================

/**
 * 새 사건 생성
 * POST /api/labor/cases
 */
app.post('/api/labor/cases', verifyToken, async (req, res) => {
  try {
    const { description, caseType } = req.body;
    if (!description || !description.trim()) {
      return res.status(400).json({ success: false, error: '사건 내용을 입력해주세요.' });
    }

    const userId = req.user.uid;
    const laborCase = await prisma.laborCase.create({
      data: {
        userId,
        description: description.trim(),
        caseType: caseType || '',
        currentStep: 0,
        timeline: {
          create: {
            type: 'case_created',
            detail: `사건 등록: ${description.trim().substring(0, 50)}...`,
          }
        }
      },
      include: { timeline: true },
    });

    console.log('[사건관리] 새 사건 생성:', laborCase.id);
    res.json({ success: true, data: { caseId: laborCase.id } });
  } catch (error) {
    console.error('[사건관리] 생성 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 사건 목록 조회
 * GET /api/labor/cases
 */
app.get('/api/labor/cases', verifyToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const cases = await prisma.laborCase.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { issues: true, laws: true, chatSessions: true, timeline: true } },
        analysisVersions: { where: { stepName: 'issueAnalysis' }, take: 1, orderBy: { version: 'desc' } },
      },
    });

    const result = cases.map(c => ({
      id: c.id,
      description: c.description,
      caseType: c.caseType,
      currentStep: c.currentStep,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      hasIssueAnalysis: c._count.issues > 0 || c.analysisVersions.length > 0,
      hasLawAnalysis: c._count.laws > 0,
      hasChatSession: c._count.chatSessions > 0,
      buildMeta: {
        analysisCount: c.analysisCount,
        chatCount: c.chatCount,
        evidenceCount: c.evidenceCount,
        insightCount: c.insightCount,
        lastAnalyzedAt: c.lastAnalyzedAt ? c.lastAnalyzedAt.toISOString() : null,
      },
      timelineCount: c._count.timeline,
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[사건관리] 목록 조회 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 사건 단계 업데이트 (분석 결과 저장 + 버전 히스토리)
 * PATCH /api/labor/cases/:id
 */
app.patch('/api/labor/cases/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { stepName, stepData, currentStep } = req.body;
    const userId = req.user.uid;

    const existing = await prisma.laborCase.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: '사건을 찾을 수 없습니다.' });
    if (existing.userId !== userId) return res.status(403).json({ success: false, error: '권한이 없습니다.' });

    const updateData = {};
    if (currentStep !== undefined) updateData.currentStep = currentStep;

    if (stepName && stepData) {
      // 버전 히스토리 누적
      const lastVersion = await prisma.analysisVersion.findFirst({
        where: { caseId: id, stepName },
        orderBy: { version: 'desc' },
      });
      const versionNum = (lastVersion?.version || 0) + 1;

      await prisma.analysisVersion.create({
        data: {
          caseId: id,
          stepName,
          version: versionNum,
          trigger: 'manual',
          data: stepData,
        },
      });

      // buildMeta 업데이트
      if (stepName === 'issueAnalysis' || stepName === 'lawAnalysis') {
        updateData.analysisCount = { increment: 1 };
        updateData.lastAnalyzedAt = new Date();
      } else if (stepName === 'chatSessionId') {
        updateData.chatCount = { increment: 1 };
      }

      // 타임라인 이벤트
      const detail = stepName === 'issueAnalysis'
        ? `쟁점 분석 v${versionNum} 완료 (${(stepData.issues || []).length}건 발견)`
        : stepName === 'lawAnalysis'
          ? `법령 분석 v${versionNum} 완료 (${(stepData.nodes || []).length}개 노드)`
          : 'AI 상담 세션 시작';

      await prisma.caseTimeline.create({
        data: { caseId: id, type: stepName === 'issueAnalysis' ? 'issue_analyzed' : stepName === 'lawAnalysis' ? 'law_analyzed' : 'chat_started', detail, version: versionNum },
      });
    }

    await prisma.laborCase.update({ where: { id }, data: updateData });
    console.log(`[사건관리] 사건 ${id} 업데이트 - step: ${stepName}, currentStep: ${currentStep}`);

    res.json({ success: true });
  } catch (error) {
    console.error('[사건관리] 업데이트 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 사건 상세 조회
 * GET /api/labor/cases/:id
 */
app.get('/api/labor/cases/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;

    const laborCase = await prisma.laborCase.findUnique({
      where: { id },
      include: {
        issues: true,
        laws: true,
        chatSessions: { select: { id: true } },
        analysisVersions: { orderBy: { version: 'desc' } },
        insights: { orderBy: { createdAt: 'desc' } },
        updates: { orderBy: { createdAt: 'asc' } },
        evidence: { orderBy: { createdAt: 'asc' }, select: { id: true, fileName: true, fileType: true, sourceLabel: true, extractedText: true, structuredData: true, fileSize: true, createdAt: true } },
        timeline: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!laborCase) return res.status(404).json({ success: false, error: '사건을 찾을 수 없습니다.' });
    if (laborCase.userId !== userId) return res.status(403).json({ success: false, error: '권한이 없습니다.' });

    // 최신 분석 버전 추출
    const latestIssue = laborCase.analysisVersions.find(v => v.stepName === 'issueAnalysis');
    const latestLaw = laborCase.analysisVersions.find(v => v.stepName === 'lawAnalysis');
    const issueHistory = laborCase.analysisVersions.filter(v => v.stepName === 'issueAnalysis').map(v => ({ ...v.data, version: v.version, completedAt: v.createdAt.toISOString(), trigger: v.trigger, diff: v.diff }));
    const lawHistory = laborCase.analysisVersions.filter(v => v.stepName === 'lawAnalysis').map(v => ({ ...v.data, version: v.version, completedAt: v.createdAt.toISOString(), trigger: v.trigger, diff: v.diff }));

    res.json({
      success: true,
      data: {
        id: laborCase.id,
        description: laborCase.description,
        caseType: laborCase.caseType,
        currentStep: laborCase.currentStep,
        steps: {
          issueAnalysis: latestIssue ? { ...latestIssue.data, version: latestIssue.version, completedAt: latestIssue.createdAt.toISOString() } : undefined,
          issueAnalysisHistory: issueHistory.length > 0 ? issueHistory : undefined,
          lawAnalysis: latestLaw ? { ...latestLaw.data, version: latestLaw.version, completedAt: latestLaw.createdAt.toISOString() } : undefined,
          lawAnalysisHistory: lawHistory.length > 0 ? lawHistory : undefined,
          chatSessionId: laborCase.chatSessions[0]?.id || undefined,
        },
        buildMeta: {
          analysisCount: laborCase.analysisCount,
          chatCount: laborCase.chatCount,
          evidenceCount: laborCase.evidenceCount,
          insightCount: laborCase.insightCount,
          lastAnalyzedAt: laborCase.lastAnalyzedAt?.toISOString() || null,
        },
        timeline: laborCase.timeline.map(t => ({ type: t.type, timestamp: t.createdAt.toISOString(), detail: t.detail, version: t.version, trigger: t.trigger })),
        insights: laborCase.insights.map(i => ({ id: i.id, content: i.content, type: i.type, source: i.source, createdAt: i.createdAt.toISOString() })),
        createdAt: laborCase.createdAt.toISOString(),
        updatedAt: laborCase.updatedAt.toISOString(),
      }
    });
  } catch (error) {
    console.error('[사건관리] 상세 조회 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 빌드 시스템 API (PostgreSQL/Prisma) ====================

/**
 * 사건 설명 업데이트
 * POST /api/labor/cases/:id/update-description
 */
app.post('/api/labor/cases/:id/update-description', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { newDescription, reason } = req.body;
    const userId = req.user.uid;

    if (!newDescription || !newDescription.trim()) {
      return res.status(400).json({ success: false, error: '새 사건 내용을 입력해주세요.' });
    }

    const existing = await prisma.laborCase.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: '사건을 찾을 수 없습니다.' });
    if (existing.userId !== userId) return res.status(403).json({ success: false, error: '권한이 없습니다.' });

    const oldDesc = existing.description;

    await prisma.$transaction([
      prisma.laborCase.update({ where: { id }, data: { description: newDescription.trim() } }),
      prisma.caseTimeline.create({
        data: {
          caseId: id, type: 'description_updated', detail: reason || '상황 업데이트',
          metadata: { oldDescriptionPreview: oldDesc.substring(0, 100), newDescriptionPreview: newDescription.trim().substring(0, 100) },
        },
      }),
    ]);

    console.log(`[빌드] 사건 ${id} 설명 업데이트`);
    res.json({ success: true, data: { previousDescription: oldDesc, newDescription: newDescription.trim() } });
  } catch (error) {
    console.error('[빌드] 설명 업데이트 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 재분석 실행
 * POST /api/labor/cases/:id/reanalyze
 */
app.post('/api/labor/cases/:id/reanalyze', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { stepName, trigger } = req.body;
    const userId = req.user.uid;

    if (!stepName || !['issueAnalysis', 'lawAnalysis'].includes(stepName)) {
      return res.status(400).json({ success: false, error: '유효한 분석 단계를 지정해주세요.' });
    }

    const existing = await prisma.laborCase.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: '사건을 찾을 수 없습니다.' });
    if (existing.userId !== userId) return res.status(403).json({ success: false, error: '권한이 없습니다.' });

    const description = existing.description;
    const previousVersion = await prisma.analysisVersion.findFirst({
      where: { caseId: id, stepName },
      orderBy: { version: 'desc' },
    });
    const previousResult = previousVersion?.data || null;

    console.log(`[빌드] 재분석 시작 - 사건: ${id}, 단계: ${stepName}, 트리거: ${trigger}`);

    const agent = await getLaborAgent();
    if (!agent.storeName) {
      await agent.initialize(process.env.LABOR_STORE_NAME || 'labor-law-knowledge-base');
    }

    let newResult;
    if (stepName === 'issueAnalysis') {
      const { GoogleGenAI } = require('@google/genai');
      const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `당신은 한국 노동법 전문 AI입니다. 아래 사건에서 핵심 법률 쟁점을 추출해주세요.\n\n사건 내용: ${description}\n\n다음 JSON 형식으로 정확히 응답하세요:\n{\n  "issues": [\n    { "id": "issue-1", "title": "쟁점제목", "summary": "핵심설명", "severity": "high|medium|low" }\n  ],\n  "summary": "전체 상황 요약"\n}`;
      const response = await genai.models.generateContent({ model: 'gemini-2.5-pro', contents: [{ role: 'user', parts: [{ text: prompt }] }] });
      let parsed;
      try { const text = response.text || ''; const jsonMatch = text.match(/\{[\s\S]*\}/); parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { issues: [], summary: text }; }
      catch { parsed = { issues: [], summary: response.text || '' }; }
      const nodes = [{ id: 'center', label: description.substring(0, 25), type: 'case', detail: description.substring(0, 500), val: 25 }];
      const links = [];
      (parsed.issues || []).forEach((iss, idx) => {
        const nodeId = `issue-${idx}`;
        nodes.push({ id: nodeId, label: iss.title, type: 'issue', detail: iss.summary, val: iss.severity === 'high' ? 20 : iss.severity === 'medium' ? 15 : 10, severity: iss.severity });
        links.push({ source: 'center', target: nodeId, label: '쟁점' });
      });
      newResult = { issues: parsed.issues || [], summary: parsed.summary || '', nodes, links };
    } else {
      const [askResult, casesResult] = await Promise.allSettled([
        agent.askLabor(description, { includeCases: true, includeInterpretations: true }),
        agent.findSimilarCases(description.substring(0, 2000))
      ]);
      const askData = askResult.status === 'fulfilled' ? askResult.value : null;
      const casesData = casesResult.status === 'fulfilled' ? casesResult.value : null;
      const summary = askData ? (askData.text || askData) : '';
      const nodes = [{ id: 'center', label: description.substring(0, 25), type: 'case', detail: description.substring(0, 500), val: 25 }];
      const links = [];
      const seenTitles = new Set();
      const addCitations = (citations, prefix) => {
        (citations || []).forEach((cit, idx) => {
          if (seenTitles.has(cit.title)) return;
          seenTitles.add(cit.title);
          const nodeType = classifyCitationType(cit.title);
          const nodeId = `${prefix}-${idx}`;
          nodes.push({ id: nodeId, label: cit.title, type: nodeType, detail: cit.uri || '', val: 12 });
          links.push({ source: 'center', target: nodeId, label: getRelationLabel(nodeType) });
        });
      };
      addCitations(askData?.citations, 'ask');
      addCitations(casesData?.citations, 'case');
      newResult = { nodes, links, summary: typeof summary === 'string' ? summary : '' };
    }

    // Diff 생성
    let diff = null;
    if (previousResult && stepName === 'issueAnalysis') {
      const oldIssues = (previousResult.issues || []).map(i => i.title);
      const newIssues = (newResult.issues || []).map(i => i.title);
      diff = { addedIssues: newIssues.filter(t => !oldIssues.includes(t)), removedIssues: oldIssues.filter(t => !newIssues.includes(t)), unchangedCount: newIssues.filter(t => oldIssues.includes(t)).length };
    } else if (previousResult && stepName === 'lawAnalysis') {
      const oldNodes = (previousResult.nodes || []).filter(n => n.type !== 'case').map(n => n.label);
      const newNodes = (newResult.nodes || []).filter(n => n.type !== 'case').map(n => n.label);
      diff = { addedNodes: newNodes.filter(t => !oldNodes.includes(t)), removedNodes: oldNodes.filter(t => !newNodes.includes(t)), unchangedCount: newNodes.filter(t => oldNodes.includes(t)).length };
    }

    const versionNum = (previousVersion?.version || 0) + 1;
    const triggerLabel = trigger === 'evidence_added' ? '증거 추가' : trigger === 'description_updated' ? '상황 변경' : '수동';

    await prisma.$transaction([
      prisma.analysisVersion.create({ data: { caseId: id, stepName, version: versionNum, trigger: trigger || 'manual', data: newResult, diff } }),
      prisma.laborCase.update({ where: { id }, data: { analysisCount: { increment: 1 }, lastAnalyzedAt: new Date() } }),
      prisma.caseTimeline.create({ data: { caseId: id, type: 'reanalyzed', detail: `${stepName === 'issueAnalysis' ? '쟁점' : '법령'} 재분석 v${versionNum} (${triggerLabel})`, version: versionNum, trigger: trigger || 'manual' } }),
    ]);

    console.log(`[빌드] 재분석 완료 - 사건: ${id}, v${versionNum}`);
    res.json({ success: true, data: { result: newResult, diff, version: versionNum, trigger: trigger || 'manual' } });
  } catch (error) {
    console.error('[빌드] 재분석 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 인사이트 추가
 * POST /api/labor/cases/:id/insights
 */
app.post('/api/labor/cases/:id/insights', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { content, type, source } = req.body;
    const userId = req.user.uid;
    if (!content || !content.trim()) return res.status(400).json({ success: false, error: '인사이트 내용을 입력해주세요.' });

    const existing = await prisma.laborCase.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: '사건을 찾을 수 없습니다.' });
    if (existing.userId !== userId) return res.status(403).json({ success: false, error: '권한이 없습니다.' });

    const [insight] = await prisma.$transaction([
      prisma.caseInsight.create({ data: { caseId: id, content: content.trim(), type: type || 'user_memo', source: source || 'manual' } }),
      prisma.laborCase.update({ where: { id }, data: { insightCount: { increment: 1 } } }),
      prisma.caseTimeline.create({ data: { caseId: id, type: 'insight_added', detail: `${type === 'ai_extracted' ? 'AI 추출' : '사용자 메모'}: ${content.trim().substring(0, 50)}...` } }),
    ]);

    res.json({ success: true, data: { id: insight.id, content: insight.content, type: insight.type, source: insight.source, createdAt: insight.createdAt.toISOString() } });
  } catch (error) {
    console.error('[빌드] 인사이트 추가 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 인사이트 조회
 * GET /api/labor/cases/:id/insights
 */
app.get('/api/labor/cases/:id/insights', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;
    const existing = await prisma.laborCase.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: '사건을 찾을 수 없습니다.' });
    if (existing.userId !== userId) return res.status(403).json({ success: false, error: '권한이 없습니다.' });

    const insights = await prisma.caseInsight.findMany({ where: { caseId: id }, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: insights.map(i => ({ id: i.id, content: i.content, type: i.type, source: i.source, createdAt: i.createdAt.toISOString() })) });
  } catch (error) {
    console.error('[빌드] 인사이트 조회 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 사건 업데이트 추가 (보충/경과)
 * POST /api/labor/cases/:id/updates
 * Body: { type: 'supplement' | 'progress', content: string }
 */
app.post('/api/labor/cases/:id/updates', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { type, content } = req.body;

    if (!type || !['supplement', 'progress'].includes(type)) {
      return res.status(400).json({ success: false, error: "type must be 'supplement' or 'progress'" });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: '내용을 입력해주세요' });
    }

    const typeLabel = type === 'supplement' ? '보충 사항' : '진행 경과';

    // 트랜잭션: 업데이트 저장 + 타임라인 기록
    const [update] = await prisma.$transaction([
      prisma.caseUpdate.create({
        data: { caseId: id, type, content: content.trim() },
      }),
      prisma.caseTimeline.create({
        data: {
          caseId: id,
          type: type === 'supplement' ? 'supplement_added' : 'progress_added',
          detail: `${typeLabel} 추가: ${content.trim().substring(0, 60)}${content.trim().length > 60 ? '...' : ''}`,
        },
      }),
    ]);

    console.log(`[사건관리] 업데이트 추가: ${id}, type=${type}`);
    res.json({ success: true, data: update });
  } catch (error) {
    console.error('[사건관리] 업데이트 추가 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 사건 업데이트 목록 조회
 * GET /api/labor/cases/:id/updates
 */
app.get('/api/labor/cases/:id/updates', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = await prisma.caseUpdate.findMany({
      where: { caseId: id },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, data: updates });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});



// ==================== 대화형 챗봇 API 엔드포인트 ====================

/**
 * 새 대화 세션 생성
 * POST /api/chat/session/new
 * Body: { userId? }
 */
app.post('/api/chat/session/new', verifyToken, async (req, res) => {
  try {
    const { userId } = req.body;
    const session = conversationManager.createSession(userId);

    // Firebase에 저장 (선택적)
    if (conversationStorage) {
      await conversationStorage.saveSession(session);
    }

    res.json({
      success: true,
      data: {
        sessionId: session.sessionId,
        stage: session.stage,
        message: '새로운 상담 세션이 시작되었습니다. 어떤 노무 문제로 상담하시나요?'
      }
    });
  } catch (error) {
    console.error('[챗봇] 세션 생성 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 메시지 전송 및 응답 받기
 * POST /api/chat/message
 * Body: { sessionId, message }
 */
app.post('/api/chat/message', verifyToken, async (req, res) => {
  try {
    const { sessionId, message } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({
        success: false,
        error: 'sessionId와 message가 필요합니다.'
      });
    }

    // DialogueFlowEngine 초기화 (최초 사용 시)
    if (!dialogueEngine) {
      const laborAgent = getLaborAgent();
      // 스토어가 없으면 초기화
      if (!laborAgent.storeName) {
        await laborAgent.initialize(process.env.LABOR_STORE_NAME || 'labor-law-knowledge-base');
      }
      dialogueEngine = new DialogueFlowEngine(conversationManager, laborAgent);
      console.log('✅ DialogueFlowEngine 초기화 완료');
    }

    // 세션 확인
    const session = conversationManager.getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: '세션을 찾을 수 없습니다. 새 세션을 생성하세요.'
      });
    }

    console.log(`[챗봇] 메시지 처리 중 (세션: ${sessionId}, 단계: ${session.stage})`);

    // 메시지 처리
    const response = await dialogueEngine.processMessage(sessionId, message);

    // Firebase에 업데이트 (선택적)
    if (conversationStorage) {
      await conversationStorage.updateSession(sessionId, {
        stage: response.nextStage || session.stage,
        category: session.category,
        context: session.context
      });
    }

    res.json({
      success: true,
      data: {
        sessionId,
        message: response.content,
        stage: response.stage,
        nextStage: response.nextStage,
        category: session.category,
        metadata: response
      }
    });

  } catch (error) {
    console.error('[챗봇] 메시지 처리 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 세션 조회
 * GET /api/chat/session/:sessionId
 */
app.get('/api/chat/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = conversationManager.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: '세션을 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      data: {
        sessionId: session.sessionId,
        stage: session.stage,
        category: session.category,
        metadata: session.metadata,
        messageCount: session.context.conversationHistory.length
      }
    });
  } catch (error) {
    console.error('[챗봇] 세션 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 대화 내역 조회
 * GET /api/chat/session/:sessionId/messages
 */
app.get('/api/chat/session/:sessionId/messages', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = conversationManager.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: '세션을 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      data: {
        sessionId,
        messages: session.context.conversationHistory,
        stage: session.stage
      }
    });
  } catch (error) {
    console.error('[챗봇] 대화 내역 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 세션 요약
 * GET /api/chat/session/:sessionId/summary
 */
app.get('/api/chat/session/:sessionId/summary', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const summary = conversationManager.generateSessionSummary(sessionId);

    if (!summary) {
      return res.status(404).json({
        success: false,
        error: '세션을 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('[챗봇] 세션 요약 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 세션 삭제
 * DELETE /api/chat/session/:sessionId
 */
app.delete('/api/chat/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // 메모리에서 삭제
    const deleted = conversationManager.deleteSession(sessionId);

    // Firebase에서 삭제 (선택적)
    if (conversationStorage && deleted) {
      await conversationStorage.deleteSession(sessionId);
    }

    res.json({
      success: true,
      message: '세션이 삭제되었습니다.'
    });
  } catch (error) {
    console.error('[챗봇] 세션 삭제 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ======================== 맥락 기반 AI 상담 ========================

// 맥락 기반 세션 저장소 (in-memory)
const contextualSessions = new Map();

/**
 * 맥락 기반 상담 세션 생성 + AI 첫 인사
 * POST /api/labor/chat/contextual
 * Body: { caseDescription, issues, laws, summary }
 */
app.post('/api/labor/chat/contextual', verifyToken, async (req, res) => {
  try {
    const { caseDescription, issues, laws, summary, caseId, consultMode } = req.body;

    if (!caseDescription) {
      return res.status(400).json({
        success: false,
        error: '사건 내용이 필요합니다.'
      });
    }

    const sessionId = `ctx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const userId = req.user?.uid || 'anonymous';
    const mode = consultMode || 'general';

    console.log(`[맥락 상담] 세션 생성: ${sessionId} (모드: ${mode})`);

    // ── 시스템 프롬프트 구성 ──
    const issuesList = (issues || []).map((iss, i) => {
      const winInfo = typeof iss.winRate === 'number' ? ` (승률 ${iss.winRate}%)` : '';
      return `${i + 1}. [${iss.severity === 'high' ? '높음' : iss.severity === 'medium' ? '보통' : '낮음'}] ${iss.title}${winInfo}: ${iss.summary || ''}`;
    }).join('\n');

    const lawsList = (laws || []).map((law, i) => {
      const typeLabel = law.type === 'law' ? '법령' : law.type === 'precedent' ? '판례' : '행정해석';
      return `${i + 1}. [${typeLabel}] ${law.title || law.label}: ${law.detail || ''}`;
    }).join('\n');

    // 축적된 인사이트 조회 (케이스 ID가 있는 경우)
    let insightsSection = '';
    if (caseId) {
      try {
        const caseInsights = await prisma.caseInsight.findMany({ where: { caseId }, orderBy: { createdAt: 'desc' } });
        if (caseInsights.length > 0) {
          insightsSection = `\n\n═══════════ 이전 상담에서 축적된 인사이트 (${caseInsights.length}건) ═══════════\n` +
            caseInsights.map((ins, i) => `${i + 1}. [${ins.type === 'ai_extracted' ? 'AI 추출' : '사용자 메모'}] ${ins.content}`).join('\n');
        }
      } catch (err) {
        console.warn('[맥락 상담] 인사이트 조회 실패:', err.message);
      }
    }

    // ── 공통 맥락 ──
    const baseContext = `═══════════════ 사건 내용 ═══════════════
${caseDescription}

═══════════════ 핵심 쟁점 (${(issues || []).length}건) ═══════════════
${issuesList || '(분석된 쟁점 없음)'}

═══════════════ 관련 법령/판례 ═══════════════
${lawsList || '(분석된 법령 없음)'}

═══════════════ AI 분석 요약 ═══════════════
${summary || '(요약 없음)'}${insightsSection}`;

    // ── 모드별 전문 시스템 프롬프트 ──
    const modePrompts = {
      prediction: `당신은 한국 노동법 전문 AI 상담사 "노무톡"의 **사건 예측 전문가**입니다.\n\n아래 사건 맥락을 완전히 이해한 상태에서, 사건의 결과를 예측하고 분석합니다.\n\n${baseContext}\n\n═══════════════ 예측 전문가 규칙 ═══════════════\n1. 각 쟁점별 승소 가능성을 구체적 근거와 함께 분석합니다.\n2. "이기면?" 시나리오: 예상 복직, 금전 보상 등 구체적 결과를 제시합니다.\n3. "지면?" 시나리오: 최악의 경우와 대안을 제시합니다.\n4. 예상 소요 기간을 단계별로 안내합니다 (노동위원회, 행정소송, 민사소송 등).\n5. 유사 판례의 결과를 인용하며 예측 근거를 강화합니다.\n6. 승률에 영향을 미칠 수 있는 변수들을 설명합니다.\n7. 한국어로 친절하고 이해하기 쉽게, 마크다운 형식으로 답변합니다.\n8. 예측은 참고용이며 법적 구속력이 없음을 안내합니다.`,
      response: `당신은 한국 노동법 전문 AI 상담사 "노무톡"의 **대응 전략 전문가**입니다.\n\n아래 사건 맥락을 완전히 이해한 상태에서, 실질적인 행동 전략과 대응 방안을 제시합니다.\n\n${baseContext}\n\n═══════════════ 대응 전략 전문가 규칙 ═══════════════\n1. 우선순위별 액션 플랜을 제시합니다 (즉시/1주 내/1개월 내/3개월 내).\n2. 쟁점별 맞춤 대응 전략을 구체적으로 안내합니다.\n3. 노동위원회 진정, 고용노동부 신고, 소송 등 구체적인 절차를 단계별로 안내합니다.\n4. 사용자와 대화 시 주의사항 (녹음, 문서화, 서면 통보 등)을 안내합니다.\n5. 협상·조정·합의 전략도 제시합니다.\n6. 감정 관리와 직장 내 대처 방법도 포함합니다.\n7. 한국어로 친절하고 이해하기 쉽게, 마크다운 형식으로 답변합니다.`,
      evidence: `당신은 한국 노동법 전문 AI 상담사 "노무톡"의 **증거 분석 전문가**입니다.\n\n아래 사건 맥락을 완전히 이해한 상태에서, 증거 수집과 증거력 분석을 전문적으로 수행합니다.\n\n${baseContext}\n\n═══════════════ 증거 분석 전문가 규칙 ═══════════════\n1. 쟁점별 필요 증거 체크리스트를 구체적으로 제시합니다.\n2. 각 증거의 증거력 등급을 평가합니다 (핵심 증거/보조 증거/참고 자료).\n3. 증거 확보 방법과 적법한 수집 절차를 안내합니다.\n4. 디지털 증거(카톡, 이메일, 녹음)의 법적 유효성을 설명합니다.\n5. 증거 보전 방법과 시효를 안내합니다.\n6. "이 증거가 있으면 승률이 어떻게 변하는지" 분석합니다.\n7. 증거가 부족한 경우 대안적 입증 방법을 제시합니다.\n8. 한국어로 친절하고 이해하기 쉽게, 마크다운 형식으로 답변합니다.`,
      compensation: `당신은 한국 노동법 전문 AI 상담사 "노무톡"의 **보상금 산정 전문가**입니다.\n\n아래 사건 맥락을 완전히 이해한 상태에서, 예상 보상금과 청구 가능 금액을 산정합니다.\n\n${baseContext}\n\n═══════════════ 보상금 산정 전문가 규칙 ═══════════════\n1. 체불임금, 퇴직금, 연차수당 등 법정 청구 항목별 예상 금액을 산정합니다.\n2. 부당해고 시 복직 + 임금상당액(해고기간 중 임금)을 계산합니다.\n3. 지연이자(근로기준법 제37조, 14.6% 연이율)를 포함한 총 청구액을 안내합니다.\n4. 합의금 협상 시 적정 범위를 제시합니다 (최소/적정/최대).\n5. 산정에 필요한 정보(월급, 근속기간, 근무시간 등)를 구체적으로 질문합니다.\n6. 세금·공제 등 실수령액 관련 사항도 안내합니다.\n7. 관련 법령 조항을 인용하며 산정 근거를 명확히 합니다.\n8. 한국어로 친절하고 이해하기 쉽게, 마크다운 형식으로 답변합니다.`,
      document: `당신은 한국 노동법 전문 AI 상담사 "노무톡"의 **법률 서면 작성 전문가**입니다.\n\n아래 사건 맥락을 완전히 이해한 상태에서, 법률 서면 작성을 도와줍니다.\n\n${baseContext}\n\n═══════════════ 법률 서면 작성 전문가 규칙 ═══════════════\n1. 진정서, 탄원서, 답변서, 이의신청서, 재심신청서, 증거설명서 등을 작성합니다.\n2. 사건 내용과 분석된 쟁점/법령을 기반으로 실전 서면을 생성합니다.\n3. 법률 서면 형식과 필수 기재사항을 정확히 포함합니다.\n4. 개인정보(이름, 주소, 전화번호)는 빈칸(_____)으로 표시합니다.\n5. 사용자가 원하는 서면 유형을 먼저 파악한 후 작성합니다.\n6. 작성 후 수정이 필요한 부분을 안내합니다.\n7. 한국어로 작성하며, 법률 용어는 괄호 안에 쉬운 설명을 추가합니다.\n8. 마크다운 형식으로 서면을 정리합니다.`,
      general: `당신은 한국 노동법 전문 AI 상담사 "노무톡"입니다.\n\n아래는 사용자의 사건과 이미 분석된 핵심 쟁점, 관련 법령/판례입니다.\n이 맥락을 완전히 이해한 상태에서 상담을 진행하세요.\n\n${baseContext}\n\n═══════════════ 상담 규칙 ═══════════════\n1. 위 사건의 맥락을 기반으로 전문적이고 구체적인 상담을 제공합니다.\n2. 관련 법령 조항과 판례를 구체적으로 인용하며 답변합니다.\n3. 사용자의 권리와 의무를 명확히 설명합니다.\n4. 실질적인 대응 방안과 절차를 안내합니다.\n5. 법적 조언의 한계를 인지하고, 복잡한 사안은 전문가 상담을 권합니다.\n6. 한국어로 친절하고 이해하기 쉽게 답변합니다.\n7. 답변 시 마크다운 형식을 활용합니다 (**굵은 글씨**, *기울임*, 번호 목록 등).`
    };

    const systemPrompt = modePrompts[mode] || modePrompts.general;

    const modeWelcomes = {
      prediction: `위 사건 맥락과 분석된 승률을 바탕으로 사용자에게 인사하고, 사건의 전체적인 전망을 간략히 요약한 뒤, 예측과 관련하여 어떤 부분이 궁금한지 물어보세요. "이기면/지면 어떻게 되나", "소요 기간", "유사 판례 결과" 등을 다룰 수 있음을 안내하세요. 응답은 200~350자 이내로 해주세요.`,
      response: `위 사건 맥락을 바탕으로 사용자에게 인사하고, 가장 시급한 대응 사항을 1~2가지 간략히 안내한 뒤, 구체적인 대응 전략에 대해 어떤 부분이 궁금한지 물어보세요. "즉시 해야 할 일", "노동위 진정 절차", "협상 전략" 등을 다룰 수 있음을 안내하세요. 응답은 200~350자 이내로 해주세요.`,
      evidence: `위 사건 맥락을 바탕으로 사용자에게 인사하고, 현재 쟁점별로 가장 중요한 증거 1~2가지를 언급한 뒤, 증거 관련 어떤 부분이 궁금한지 물어보세요. "필요 증거 체크리스트", "증거 수집 방법", "디지털 증거 유효성" 등을 다룰 수 있음을 안내하세요. 응답은 200~350자 이내로 해주세요.`,
      compensation: `위 사건 맥락을 바탕으로 사용자에게 인사하고, 청구 가능한 보상 항목을 간략히 나열한 뒤, 정확한 산정을 위해 필요한 기본 정보(월급, 근속기간 등)를 질문하세요. "체불임금", "퇴직금", "위로금", "합의금 범위" 등을 다룰 수 있음을 안내하세요. 응답은 200~350자 이내로 해주세요.`,
      document: `위 사건 맥락을 바탕으로 사용자에게 인사하고, 이 사건에서 작성 가능한 법률 서면 종류를 나열한 뒤, 어떤 서면을 작성하고 싶은지 물어보세요. "진정서", "답변서", "이의신청서", "증거설명서" 등을 다룰 수 있음을 안내하세요. 응답은 200~350자 이내로 해주세요.`,
      general: `위 사건 맥락을 바탕으로 사용자에게 인사하고, 분석된 핵심 쟁점과 관련 법령을 간략히 요약한 뒤, 어떤 부분에 대해 더 자세히 상담받고 싶은지 물어보세요. 응답은 200~400자 이내로 해주세요.`
    };

    // ── Gemini로 첫 인사 생성 ──
    const { GoogleGenAI } = require('@google/genai');
    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const welcomePrompt = modeWelcomes[mode] || modeWelcomes.general;

    const response = await genai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: '네, 사건 내용과 분석 결과를 모두 파악했습니다. 상담을 시작하겠습니다.' }] },
        { role: 'user', parts: [{ text: welcomePrompt }] }
      ],
    });

    const welcomeMessage = response.text || '안녕하세요. 사건 분석 결과를 바탕으로 상담을 도와드리겠습니다. 어떤 부분이 궁금하신가요?';

    // ── 세션 저장 ──
    contextualSessions.set(sessionId, {
      sessionId,
      userId,
      caseId: caseId || null,
      consultMode: mode,
      systemPrompt,
      turnCount: 0,
      history: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: '네, 사건 내용과 분석 결과를 모두 파악했습니다. 상담을 시작하겠습니다.' }] },
        { role: 'user', parts: [{ text: welcomePrompt }] },
        { role: 'model', parts: [{ text: welcomeMessage }] }
      ],
      createdAt: new Date().toISOString()
    });

    console.log(`[맥락 상담] 세션 생성 완료: ${sessionId} (모드: ${mode})`);

    res.json({
      success: true,
      data: {
        sessionId,
        welcomeMessage,
      }
    });

  } catch (error) {
    console.error('[맥락 상담] 세션 생성 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 맥락 기반 상담 메시지 전송
 * POST /api/labor/chat/message
 * Body: { sessionId, message }
 */
app.post('/api/labor/chat/message', verifyToken, async (req, res) => {
  try {
    const { sessionId, message } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({
        success: false,
        error: 'sessionId와 message가 필요합니다.'
      });
    }

    const session = contextualSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: '세션을 찾을 수 없습니다.'
      });
    }

    console.log(`[맥락 상담] 메시지 처리: ${sessionId}`);

    // 사용자 메시지를 히스토리에 추가
    session.history.push({
      role: 'user',
      parts: [{ text: message }]
    });

    // Gemini 호출 (전체 히스토리 포함)
    const { GoogleGenAI } = require('@google/genai');
    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const response = await genai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: session.history,
    });

    const aiMessage = response.text || '죄송합니다. 응답을 생성하지 못했습니다. 다시 질문해주세요.';

    // AI 응답을 히스토리에 추가
    session.history.push({
      role: 'model',
      parts: [{ text: aiMessage }]
    });

    // 턴 카운트 증가
    session.turnCount = (session.turnCount || 0) + 1;

    // 인사이트 자동 추출 (4턴마다, 비동기)
    if (session.turnCount >= 4 && session.turnCount % 2 === 0 && session.caseId) {
      (async () => {
        try {
          const recentMessages = session.history
            .filter(h => h.role === 'user' || h.role === 'model')
            .slice(-6)
            .map(h => `[${h.role === 'user' ? '사용자' : 'AI'}]: ${h.parts[0].text.substring(0, 300)}`)
            .join('\n');

          const extractPrompt = `아래 노동법 상담 대화에서 향후 분석에 참고할 핵심 사항을 2~3개 추출해주세요.
각 인사이트는 한 문장으로 작성하세요.
JSON 배열로만 응답하세요: ["...", "...", "..."]

대화 내용:
${recentMessages}`;

          const extractResponse = await genai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: [{ role: 'user', parts: [{ text: extractPrompt }] }],
          });

          const extractText = extractResponse.text || '';
          const jsonMatch = extractText.match(/\[.*\]/s);
          if (jsonMatch) {
            const insights = JSON.parse(jsonMatch[0]);
            const newInsightRecords = insights.map(c => ({
              caseId: session.caseId,
              content: typeof c === 'string' ? c : String(c),
              type: 'ai_extracted',
              source: `chat_turn_${session.turnCount}`,
            }));

            await prisma.$transaction([
              prisma.caseInsight.createMany({ data: newInsightRecords }),
              prisma.laborCase.update({ where: { id: session.caseId }, data: { insightCount: { increment: newInsightRecords.length } } }),
              prisma.caseTimeline.create({ data: { caseId: session.caseId, type: 'insight_auto_extracted', detail: `AI 상담 ${session.turnCount}턴에서 인사이트 ${newInsightRecords.length}건 자동 추출` } }),
            ]);
            console.log(`[빌드] 인사이트 자동 추출 - 사건: ${session.caseId}, ${newInsightRecords.length}건`);
          }
        } catch (err) {
          console.warn('[빌드] 인사이트 자동 추출 실패:', err.message);
        }
      })();
    }

    res.json({
      success: true,
      data: {
        sessionId,
        message: aiMessage,
        stage: 'consultation',
        turnCount: session.turnCount,
      }
    });

  } catch (error) {
    console.error('[맥락 상담] 메시지 처리 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 활성 세션 목록
 * GET /api/chat/sessions
 */
app.get('/api/chat/sessions', async (req, res) => {
  try {
    const sessions = conversationManager.getAllSessions();

    res.json({
      success: true,
      data: {
        total: sessions.length,
        sessions: sessions.map(s => ({
          sessionId: s.sessionId,
          userId: s.userId,
          stage: s.stage,
          category: s.category,
          startTime: s.metadata.startTime,
          lastUpdate: s.metadata.lastUpdate,
          turnCount: s.metadata.turnCount
        }))
      }
    });
  } catch (error) {
    console.error('[챗봇] 세션 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== 결제 시스템 (PortOne/아임포트) ====================

/**
 * 아임포트 테스트 키 설정
 */
const IMP_KEY = process.env.IMP_KEY || 'imp_apikey';  // 테스트용
const IMP_SECRET = process.env.IMP_SECRET || 'ekKoeW8RyKuT0zgaZsUtXXTLQ4AhPFW3ZGQEBNfd87oBzDKscqWUnJH6Atx75EIJyLemDsWv0p6KBl0a';
const IMP_STORE_CODE = process.env.IMP_STORE_CODE || 'imp19424728'; // 테스트 가맹점

/**
 * 상품 정의 (인메모리)
 */
const PRODUCTS = [
  {
    id: 1,
    name: '노무톡 프리미엄',
    code: 'NOMUTALK_PREMIUM',
    price: 10000,
    description: '무제한 AI 노무 상담, 심층 판례 분석, 광고 제거',
    features: ['무제한 AI 상담', '심층 판례 분석', '변호사 연계 할인', '광고 제거'],
    period: 30, // 일
  }
];

/**
 * 결제 기록 저장소 (인메모리 — 서버 재시작 시 초기화됨)
 */
const paymentOrders = [];

/**
 * 아임포트 액세스 토큰 가져오기
 */
async function getIamportToken() {
  const res = await fetch('https://api.iamport.kr/users/getToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imp_key: IMP_KEY, imp_secret: IMP_SECRET })
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(data.message || '아임포트 인증 실패');
  return data.response.access_token;
}

/**
 * 아임포트 결제 정보 조회
 */
async function getIamportPayment(impUid) {
  const token = await getIamportToken();
  const res = await fetch(`https://api.iamport.kr/payments/${impUid}`, {
    headers: { Authorization: token }
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(data.message || '결제 정보 조회 실패');
  return data.response;
}

/**
 * 상점 코드 조회
 * GET /api/payments/store-code
 */
app.get('/api/payments/store-code', (req, res) => {
  res.json({ success: true, data: { storeCode: IMP_STORE_CODE } });
});

/**
 * 상품 목록 조회
 * GET /api/payments/products
 */
app.get('/api/payments/products', (req, res) => {
  res.json({ success: true, data: PRODUCTS });
});

/**
 * 결제 사전등록 (아임포트 API)
 * POST /api/payments/prepare
 * Body: { productId, userId, userEmail }
 */
app.post('/api/payments/prepare', async (req, res) => {
  try {
    const { productId, userId, userEmail } = req.body;
    const product = PRODUCTS.find(p => p.id === productId);
    if (!product) {
      return res.status(404).json({ success: false, error: '상품을 찾을 수 없습니다.' });
    }

    // 고유 주문번호 생성
    const merchantUid = `nomutalk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const amount = product.price;

    // 아임포트 사전등록
    const token = await getIamportToken();
    const prepareRes = await fetch('https://api.iamport.kr/payments/prepare', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token
      },
      body: JSON.stringify({ merchant_uid: merchantUid, amount })
    });
    const prepareData = await prepareRes.json();

    if (prepareData.code !== 0) {
      throw new Error(prepareData.message || '사전등록 실패');
    }

    // 인메모리에 주문 기록 생성
    const order = {
      id: paymentOrders.length + 1,
      merchantUid,
      productId: product.id,
      productName: product.name,
      productPrice: product.price,
      amount,
      userId: userId || null,
      userEmail: userEmail || null,
      status: 'PENDING',
      impUid: null,
      cardName: null,
      cardNumber: null,
      paidAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    paymentOrders.push(order);

    console.log(`[결제] 사전등록 완료: ${merchantUid} / ₩${amount}`);

    res.json({
      success: true,
      data: {
        merchantUid,
        amount,
        productName: product.name,
        storeCode: IMP_STORE_CODE,
      }
    });

  } catch (error) {
    console.error('[결제] 사전등록 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 결제 검증
 * POST /api/payments/verify
 * Body: { impUid, merchantUid }
 */
app.post('/api/payments/verify', async (req, res) => {
  try {
    const { impUid, merchantUid } = req.body;
    if (!impUid || !merchantUid) {
      return res.status(400).json({ success: false, error: 'impUid와 merchantUid가 필요합니다.' });
    }

    // 아임포트에서 실제 결제 정보 조회
    const paymentData = await getIamportPayment(impUid);

    // 인메모리에서 주문 찾기
    const order = paymentOrders.find(o => o.merchantUid === merchantUid);
    if (!order) {
      return res.status(404).json({ success: false, error: '주문을 찾을 수 없습니다.' });
    }

    // 금액 위변조 검증
    if (paymentData.amount !== order.amount) {
      // 금액 불일치 — 위변조 의심
      order.status = 'FORGERY';
      order.updatedAt = new Date().toISOString();
      console.error(`[결제] 금액 불일치! 예상: ${order.amount}, 실제: ${paymentData.amount}`);
      return res.status(400).json({
        success: false,
        error: '결제 금액이 일치하지 않습니다. 위변조 의심',
      });
    }

    if (paymentData.status === 'paid') {
      // 결제 성공
      order.status = 'COMPLETE';
      order.impUid = impUid;
      order.cardName = paymentData.card_name || null;
      order.cardNumber = paymentData.card_number || null;
      order.paidAt = paymentData.paid_at ? new Date(paymentData.paid_at * 1000).toISOString() : new Date().toISOString();
      order.updatedAt = new Date().toISOString();

      console.log(`[결제] 검증 성공: ${merchantUid} / ₩${order.amount}`);

      res.json({
        success: true,
        data: {
          orderId: order.id,
          merchantUid,
          status: 'COMPLETE',
          amount: order.amount,
          productName: order.productName,
          cardName: order.cardName,
          paidAt: order.paidAt,
        }
      });
    } else {
      order.status = paymentData.status === 'cancelled' ? 'CANCELLED' : 'FAILED';
      order.updatedAt = new Date().toISOString();

      res.status(400).json({
        success: false,
        error: `결제가 완료되지 않았습니다. 상태: ${paymentData.status}`,
      });
    }

  } catch (error) {
    console.error('[결제] 검증 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 결제 내역 조회
 * GET /api/payments/history?userId=xxx
 */
app.get('/api/payments/history', (req, res) => {
  const { userId } = req.query;
  let orders = paymentOrders.filter(o => o.status !== 'PENDING');
  if (userId) {
    orders = orders.filter(o => o.userId === userId);
  }
  orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json({
    success: true,
    data: orders.map(o => ({
      id: o.id,
      productName: o.productName,
      amount: o.amount,
      status: o.status,
      cardName: o.cardName,
      paidAt: o.paidAt,
      createdAt: o.createdAt,
    }))
  });
});

/**
 * 결제 상세 조회
 * GET /api/payments/history/:id
 */
app.get('/api/payments/history/:id', (req, res) => {
  const order = paymentOrders.find(o => o.id === parseInt(req.params.id));
  if (!order) {
    return res.status(404).json({ success: false, error: '결제 내역을 찾을 수 없습니다.' });
  }
  res.json({ success: true, data: order });
});

// ==================== 5단계 강화 API ====================

/**
 * POST /api/labor/alternatives
 * 대안 제안 비교표 생성 (Step 4)
 */
app.post('/api/labor/alternatives', verifyToken, async (req, res) => {
  try {
    const { caseId, description, issues, caseType } = req.body;
    if (!description) {
      return res.status(400).json({ success: false, error: '사건 내용이 필요합니다.' });
    }

    const { GoogleGenAI } = require('@google/genai');
    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const issuesSummary = (issues || []).map(i => `- ${i.title} (${i.severity})`).join('\n');

    const prompt = `당신은 대한민국 노동법 전문가입니다. 아래 사건에 대해 가능한 해결 방법들을 비교 분석해주세요.

[사건 유형] ${caseType || '일반'}
[사건 내용] ${description}
[핵심 쟁점]
${issuesSummary || '없음'}

각 해결 방법에 대해 다음을 포함하여 JSON 형식으로 답변하세요:

{
  "methods": [
    {
      "id": "method_1",
      "name": "해결 방법 이름",
      "icon": "적절한 이모지",
      "description": "한 줄 설명",
      "timeframe": "예상 소요 기간",
      "cost": "예상 비용",
      "successRate": 성공률(0-100 정수),
      "pros": ["장점1", "장점2"],
      "cons": ["단점1", "단점2"],
      "procedure": ["절차1", "절차2", "절차3"],
      "isRecommended": true/false
    }
  ],
  "recommendation": "종합 권장 사항 (어떤 방법을 왜 추천하는지)",
  "reasoning": "분석 근거 상세 설명"
}

일반적인 해결 방법: 내용증명 발송, 노동청 진정, 노동위원회 구제신청, 민사소송, 임금체불 고소, 합의/조정 등
사건 유형에 맞는 2~5개의 현실적인 방법을 제안하세요.
반드시 하나의 방법에 isRecommended: true를 지정하세요.
JSON만 출력하세요.`;

    const result = await genai.models.generateContent({ model: 'gemini-2.5-pro', contents: prompt });
    const text = result.text;

    let parsed;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch {
      parsed = {
        methods: [{
          id: 'method_1', name: '노동청 진정', icon: '📋',
          description: '고용노동부에 사건을 신고하여 조사를 요청합니다.',
          timeframe: '2~4주', cost: '무료', successRate: 65,
          pros: ['무료', '강제 조사 권한'], cons: ['처리 시간이 걸림'],
          procedure: ['관할 노동청 방문 또는 온라인 신고', '진정서 작성 및 제출', '근로감독관 조사', '결과 통보'],
          isRecommended: true,
        }],
        recommendation: '노동청 진정이 비용 대비 효과가 가장 좋습니다.',
        reasoning: text,
      };
    }

    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error('대안 분석 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/labor/generate-document
 * 법률 서면 자동 생성 (Step 5)
 */
app.post('/api/labor/generate-document', verifyToken, async (req, res) => {
  try {
    const { caseDescription, documentType, additionalInfo } = req.body;
    if (!caseDescription || !documentType) {
      return res.status(400).json({ success: false, error: '사건 내용과 서면 유형이 필요합니다.' });
    }

    const docTypeNames = {
      complaint: '진정서 (노동청)',
      response: '답변서',
      objection: '이의신청서',
      appeal: '재심신청서',
      evidence: '증거설명서',
    };

    const { GoogleGenAI } = require('@google/genai');
    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const docTypeName = docTypeNames[documentType] || documentType;
    const addInfo = additionalInfo ? Object.entries(additionalInfo).map(([k, v]) => `${k}: ${v}`).join('\n') : '';

    const prompt = `당신은 대한민국 노동법 전문 법률 서면 작성자입니다.
아래 사건에 대한 "${docTypeName}" 초안을 작성해주세요.

[사건 내용]
${caseDescription}

${addInfo ? `[추가 정보]\n${addInfo}\n` : ''}
다음 형식으로 작성하세요:
1. 제목
2. 수신처 (해당하는 경우)
3. 진정인/신청인 정보 (빈칸으로 표시)
4. 피진정인/피신청인 정보 (빈칸으로 표시)
5. 본문 (사건 경위, 법적 근거, 요청 사항)
6. 첨부 서류 목록

실제 제출 가능한 수준의 전문적인 서면을 작성하세요.
개인정보는 "___" 빈칸으로 남겨두세요.`;

    const result = await genai.models.generateContent({ model: 'gemini-2.5-pro', contents: prompt });
    const content = result.text;

    res.json({
      success: true,
      data: {
        documentType,
        documentTypeName: docTypeName,
        content,
        citations: [],
        timestamp: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('서면 생성 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/labor/checklist
 * 동적 체크리스트 생성 (Step 5)
 */
app.post('/api/labor/checklist', verifyToken, async (req, res) => {
  try {
    const { caseId, resolution, caseType } = req.body;

    const { GoogleGenAI } = require('@google/genai');
    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const prompt = `당신은 대한민국 노동법 전문가입니다.
"${resolution}" 방법으로 "${caseType || '노동'}" 사건을 해결하려는 근로자를 위한 준비물 체크리스트를 만들어주세요.

JSON 형식으로 답변하세요:
{
  "items": [
    {
      "id": "check_1",
      "label": "체크 항목",
      "category": "카테고리명 (예: 서류 준비, 증거 확보, 사전 조치)",
      "description": "상세 설명 또는 팁"
    }
  ]
}

카테고리별로 5~15개 항목을 만들어주세요.
일반적인 항목 예시: 근로계약서, 급여명세서, 출퇴근 기록, 업무 관련 문자/카톡, 증인 확보 등
해결 방법에 특화된 항목을 포함하세요.
JSON만 출력하세요.`;

    const result = await genai.models.generateContent({ model: 'gemini-2.5-pro', contents: prompt });
    const text = result.text;

    let parsed;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch {
      parsed = {
        items: [
          { id: 'check_1', label: '근로계약서 확보', category: '서류 준비', description: '원본 또는 사본' },
          { id: 'check_2', label: '급여명세서 확보', category: '서류 준비', description: '최근 3개월분' },
          { id: 'check_3', label: '출퇴근 기록 정리', category: '증거 확보', description: '캘린더, 교통카드 등' },
          { id: 'check_4', label: '관련 대화 내역 저장', category: '증거 확보', description: '문자, 카톡, 이메일' },
        ],
      };
    }

    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error('체크리스트 생성 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/labor/timeline
 * 예상 타임라인 생성 (Step 5)
 */
app.post('/api/labor/timeline', verifyToken, async (req, res) => {
  try {
    const { caseId, resolution, caseType } = req.body;

    const { GoogleGenAI } = require('@google/genai');
    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const prompt = `당신은 대한민국 노동법 전문가입니다.
"${resolution}" 방법으로 "${caseType || '노동'}" 사건을 해결할 때의 예상 타임라인을 만들어주세요.

JSON 형식으로 답변하세요:
{
  "steps": [
    {
      "day": "D-Day / 1일차 / 1주차 등",
      "label": "단계 이름",
      "description": "구체적인 안내",
      "type": "action 또는 expected 또는 deadline"
    }
  ],
  "statute_of_limitations": "소멸시효 정보 (예: 임금채권 3년, 퇴직금 3년 등)"
}

type 설명:
- action: 당사자가 해야 할 행동
- expected: 예상되는 진행 사항
- deadline: 법적 기한

5~10단계로 현실적인 타임라인을 작성하세요.
JSON만 출력하세요.`;

    const result = await genai.models.generateContent({ model: 'gemini-2.5-pro', contents: prompt });
    const text = result.text;

    let parsed;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch {
      parsed = {
        steps: [
          { day: 'D-Day', label: '증거 자료 정리', description: '근로계약서, 급여명세서 등 관련 자료를 모두 정리합니다.', type: 'action' },
          { day: '1~3일차', label: '진정서 작성', description: '관할 노동청에 제출할 진정서를 작성합니다.', type: 'action' },
          { day: '1주차', label: '노동청 접수', description: '관할 고용노동청에 진정서를 접수합니다.', type: 'action' },
          { day: '2~4주차', label: '근로감독관 조사', description: '배정된 근로감독관이 사실 관계를 조사합니다.', type: 'expected' },
          { day: '4~6주차', label: '결과 통보', description: '조사 결과 및 시정 명령 여부가 통보됩니다.', type: 'expected' },
        ],
        statute_of_limitations: '임금채권 소멸시효: 3년 (근로기준법 제49조)',
      };
    }

    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error('타임라인 생성 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 서버 시작 ====================

async function startServer() {
  // Secret Manager에서 시크릿 로드 (프로덕션 환경)
  await loadSecrets();

  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    노무 AI 시스템 시작                         ║
╠═══════════════════════════════════════════════════════════════╣
║  📡 URL: http://localhost:${PORT}                                  
║  🔑 Gemini API: ${process.env.GEMINI_API_KEY ? '✅ 설정됨' : '❌ 미설정'}                              
║  🗂️  현재 Store: ${currentStoreName || '미설정'}                          
║  🌐 환경: ${process.env.NODE_ENV || 'development'}                          
╚═══════════════════════════════════════════════════════════════╝

📋 기본 API 엔드포인트:
   GET    /api/health        - 서버 상태 확인
   POST   /api/store/initialize - 스토어 초기화
   POST   /api/upload         - 파일 업로드
   POST   /api/query          - 질의
   GET    /api/stores         - 스토어 목록

📋 노무 AI API 엔드포인트:
   POST   /api/labor/ask              - 노무 상담
   GET    /api/labor/categories          - 카테고리 목록
   POST   /api/labor/upload-law          - 법령 업로드
   POST   /api/labor/upload-case         - 판례 업로드
   GET    /api/labor/store-status        - 스토어 상태
   POST   /api/labor/initialize          - 스토어 초기화
   GET    /api/labor/health              - Health Check

📋 대화형 챗봇 API 엔드포인트:
   POST   /api/chat/session/new          - 새 세션 생성
   POST   /api/chat/message              - 메시지 전송
   GET    /api/chat/session/:id          - 세션 조회
   GET    /api/chat/session/:id/messages - 대화 내역
   GET    /api/chat/session/:id/summary  - 세션 요약
   DELETE /api/chat/session/:id          - 세션 삭제
   GET    /api/chat/sessions             - 활성 세션 목록

🌐 웹 인터페이스:
   http://localhost:${PORT}/labor_ai.html    - 노무 AI (기존 기능)
   http://localhost:${PORT}/chat.html        - 대화형 챗봇 (신규)
    `);

    if (!process.env.GEMINI_API_KEY) {
      console.warn('\n⚠️  GEMINI_API_KEY가 설정되지 않았습니다.');
      console.warn('   .env 파일에 API 키를 추가하거나 Secret Manager를 설정하세요.\n');
    }
  });
}

startServer().catch(err => {
  console.error('❌ 서버 시작 실패:', err);
  process.exit(1);
});

