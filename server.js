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
try {
  // 서비스 계정 키 파일 경로 (환경변수 또는 기본 경로)
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json';

  if (fs.existsSync(serviceAccountPath)) {
    console.log('📂 Firebase 서비스 계정 파일 사용:', serviceAccountPath);
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } else {
    console.log('☁️  GCP 인프라 기본 인증 사용 (App Engine)');
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
  }

  // Firestore 초기화 시도 (Datastore Mode인 경우 실패할 수 있음)
  try {
    db = admin.firestore();
    // Firestore 접근 테스트 (실제 사용 가능한지 확인)
    console.log('✅ Firebase Admin SDK 초기화 성공');
  } catch (firestoreError) {
    console.warn('⚠️  Firestore 초기화 실패 (Datastore Mode일 수 있음):', firestoreError.message);
    console.warn('⚠️  대화 저장소는 메모리 모드로 동작합니다.');
    db = null;
  }
} catch (error) {
  console.error('❌ Firebase 초기화 오류:', error.message);
  // 인증 없이 초기화 시도 (일부 기능 제한될 수 있음)
  if (!admin.apps.length) {
    admin.initializeApp();
  }
}

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
        'https://nomutalk-889bd.firebaseapp.com'
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
      const modelName = requestedModel || 'gemini-2.5-flash';
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

// ==================== 학습 기록 저장 API ====================

/**
 * POST /api/records
 * 문제, 풀이, 학습 기록 저장
 */
app.post('/api/records', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'Firebase가 설정되지 않았습니다. firebase-service-account.json 파일을 확인하세요.'
      });
    }

    const {
      subject,      // 교과
      course,       // 과목
      publisher,    // 출판사
      chapter,      // 단원
      type,         // 문제 유형 (multiple/subjective)
      problem,      // 문제 내용
      solution,     // 풀이 내용
      request       // 추가 요청사항
    } = req.body;

    // 필수 필드 검증
    if (!problem) {
      return res.status(400).json({
        success: false,
        error: '저장할 문제 내용이 필요합니다.'
      });
    }

    // Firestore에 저장
    const recordData = {
      subject: subject || '',
      course: course || '',
      publisher: publisher || '',
      chapter: chapter || '',
      type: type || 'multiple',
      problem: problem,
      solution: solution || '',
      request: request || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('records').add(recordData);

    console.log('✅ 학습 기록 저장:', docRef.id);

    res.json({
      success: true,
      id: docRef.id,
      message: '학습 기록이 저장되었습니다.'
    });
  } catch (error) {
    console.error('학습 기록 저장 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/records
 * 저장된 학습 기록 목록 조회
 */
app.get('/api/records', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'Firebase가 설정되지 않았습니다.'
      });
    }

    const { subject, course, limit: queryLimit } = req.query;
    let query = db.collection('records').orderBy('createdAt', 'desc');

    // 필터 적용
    if (subject) {
      query = query.where('subject', '==', subject);
    }
    if (course) {
      query = query.where('course', '==', course);
    }

    // 개수 제한 (기본 50개)
    const limitNum = parseInt(queryLimit) || 50;
    query = query.limit(limitNum);

    const snapshot = await query.get();
    const records = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      records.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null
      });
    });

    res.json({
      success: true,
      records: records,
      count: records.length
    });
  } catch (error) {
    console.error('학습 기록 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/records/:id
 * 특정 학습 기록 조회
 */
app.get('/api/records/:id', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'Firebase가 설정되지 않았습니다.'
      });
    }

    const { id } = req.params;
    const doc = await db.collection('records').doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: '학습 기록을 찾을 수 없습니다.'
      });
    }

    const data = doc.data();
    res.json({
      success: true,
      record: {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null
      }
    });
  } catch (error) {
    console.error('학습 기록 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/records/:id
 * 학습 기록 삭제
 */
app.delete('/api/records/:id', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'Firebase가 설정되지 않았습니다.'
      });
    }

    const { id } = req.params;
    await db.collection('records').doc(id).delete();

    console.log('🗑️ 학습 기록 삭제:', id);

    res.json({
      success: true,
      message: '학습 기록이 삭제되었습니다.'
    });
  } catch (error) {
    console.error('학습 기록 삭제 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== 참조 문제 기반 변형 출제 API (Phase 1) ====================

/**
 * POST /api/generate-variation
 * 참조 문제 이미지를 분석하여 변형 문제 생성
 */
app.post('/api/generate-variation', async (req, res) => {
  try {
    const { images, metadata, geminiModel, openaiModel, variationCount, instructions,
      llmType // 하위 호환성
    } = req.body;

    // 하위 호환성: 기존 llmType 파라미터 지원
    const selectedGeminiModel = geminiModel || 'gemini-2.5-flash';
    const selectedOpenaiModel = openaiModel || (llmType === 'gpt4' ? 'gpt-4o' : '');

    if (!images || images.length === 0) {
      return res.status(400).json({
        success: false,
        error: '참조 문제 이미지가 필요합니다.'
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        success: false,
        error: 'Gemini API 키가 설정되지 않았습니다.'
      });
    }

    console.log(`🔄 변형 문제 생성 시작 - Gemini: ${selectedGeminiModel}, OpenAI: ${selectedOpenaiModel || '없음'}, 이미지: ${images.length}개, 문제 수: ${variationCount}`);

    // Gemini Vision API로 이미지 분석 및 변형 문제 생성
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // 선택된 Gemini 모델 사용
    const model = genAI.getGenerativeModel({
      model: selectedGeminiModel,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      }
    });

    // 이미지 파트 생성
    const imageParts = images.map(img => ({
      inlineData: {
        data: img.data,
        mimeType: img.mimeType
      }
    }));

    // 메타데이터 정보 구성
    const metaInfo = metadata ? `
## 문제 정보
- 시험 종류: ${metadata.examType || '미지정'}
- 문제 유형: ${metadata.problemCategory || '미지정'}
- 과목: ${metadata.subject || ''} > ${metadata.course || ''}
- 학년: ${metadata.grade || '미지정'}
- 단원: ${metadata.chapter || '미지정'}
${metadata.schoolName ? `- 학교명: ${metadata.schoolName}` : ''}
${metadata.semester ? `- 학기/시험: ${metadata.semester}` : ''}
${metadata.examYear ? `- 출제년도: ${metadata.examYear}` : ''}
` : '';

    // 변형 문제 생성 프롬프트
    const variationPrompt = `당신은 전문 교육 콘텐츠 출제 AI입니다.
제공된 참조 문제 이미지를 분석하고, 유사하지만 다른 변형 문제를 생성해주세요.

${metaInfo}

## 요청사항
- 생성할 변형 문제 수: ${variationCount}개
${instructions ? `- 추가 지시사항: ${instructions}` : ''}

## 변형 문제 생성 규칙
1. 원래 문제의 **핵심 개념과 유형**을 유지하세요.
2. **숫자, 변수명, 조건** 등을 변경하여 새로운 문제를 만드세요.
3. **난이도는 비슷**하게 유지하세요 (특별 요청이 없는 한).
4. 수학 수식은 반드시 **LaTeX 형식** ($...$ 또는 $$...$$)으로 작성하세요.
5. 각 문제에 **정답**을 포함하세요.
6. 객관식인 경우 **4~5개의 선지**를 제공하세요.

## 표(Table) 생성 규칙
참조 문제에 표가 포함된 경우, 반드시 다음 JSON 형식으로 표 데이터를 생성하세요:

\`\`\`json:table
{
  "type": "science-table",
  "headers": [
    [{"content": "헤더1", "colspan": 2}, "헤더2", "헤더3"]
  ],
  "rows": [
    [{"content": "행제목", "rowspan": 2}, "$수식$", "값1", "값2"],
    ["$x\\\\text{ M H}_2\\\\text{O}$", "$a$", "$b$"]
  ],
  "ionRatios": [
    {"condition": "(가)", "fractions": [{"n": 1, "d": 5}, {"n": 3, "d": 5}, {"n": 1, "d": 5}]}
  ]
}
\`\`\`

### 표 작성 시 주의사항:
- 화학식: "$x\\\\text{ M H}_2\\\\text{B}(aq)$" 형식 (아래첨자는 _{} 사용)
- 수학 변수: "$a$", "$b$", "$x$" 등 LaTeX 형식
- 셀 병합: rowspan, colspan 속성 사용
- 파이차트가 필요한 경우 ionRatios 배열에 분수 정보 포함 (n: 분자, d: 분모)
- 빈 셀: "" 또는 "0"

## 출력 형식
각 변형 문제는 다음 형식으로 작성하세요:

### 변형 문제 1
[문제 내용]

**선지** (객관식인 경우)
① 첫 번째 선택지
② 두 번째 선택지
③ 세 번째 선택지
④ 네 번째 선택지
⑤ 다섯 번째 선택지

**정답**: [정답]

---

이제 이미지를 분석하고 변형 문제를 생성해주세요.`;

    // Gemini Vision API 호출
    const result = await model.generateContent([variationPrompt, ...imageParts]);
    const response = await result.response;
    const geminiVariation = response.text();

    console.log('✅ Gemini 변형 문제 생성 완료');

    // OpenAI 추가 검증 (선택된 경우)
    let openaiReview = null;
    if (selectedOpenaiModel && openaiClient) {
      try {
        console.log(`🔄 OpenAI ${selectedOpenaiModel} 검증 시작...`);

        // OpenAI 모델별 설정
        const openaiConfig = {
          model: selectedOpenaiModel,
          messages: [
            {
              role: 'system',
              content: '당신은 수학/과학 교육 전문가입니다. 제공된 변형 문제를 검토하고 개선점을 제안하세요. 수학 수식은 LaTeX 형식으로 작성하세요.'
            },
            {
              role: 'user',
              content: `다음 변형 문제를 검토해주세요:\n\n${geminiVariation}\n\n검토 관점:\n1. 문제의 정확성\n2. 난이도 적절성\n3. 수식 표기 검토\n4. 개선 제안 (있는 경우)`
            }
          ],
          max_tokens: 2048,
          temperature: 0.5
        };

        // o3, o3-mini 모델은 reasoning 모델이므로 다른 설정 사용
        if (selectedOpenaiModel.startsWith('o3')) {
          openaiConfig.max_completion_tokens = 4096;
          delete openaiConfig.max_tokens;
          delete openaiConfig.temperature; // o3는 temperature 지원 안함
        }

        const openaiResponse = await openaiClient.chat.completions.create(openaiConfig);
        openaiReview = openaiResponse.choices[0].message.content;
        console.log(`✅ OpenAI ${selectedOpenaiModel} 검증 완료`);
      } catch (openaiError) {
        console.error('OpenAI 검증 오류:', openaiError.message);
        openaiReview = `OpenAI 검증 실패: ${openaiError.message}`;
      }
    }

    res.json({
      success: true,
      variation: {
        problem: geminiVariation,
        metadata: metadata,
        originalImages: images.length,
        geminiModel: selectedGeminiModel,
        openaiModel: selectedOpenaiModel || null,
        openaiReview: openaiReview
      }
    });
  } catch (error) {
    console.error('변형 문제 생성 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/problem-workflow
 * 멀티 모델 문제 출제 워크플로우
 * Step 1: 문제 생성 (GPT-4o 또는 지정 모델)
 * Step 2: 자동 검증 (o3 또는 지정 모델)
 * Step 3: 최종 해설 작성 (o3 또는 지정 모델)
 */
app.post('/api/problem-workflow', async (req, res) => {
  try {
    const {
      prompt,           // 문제 출제 요청 프롬프트
      engineCode,       // 선택된 엔진 코드 (선택적)
      context,          // 추가 컨텍스트 (선택적)
      models = {},      // 각 단계별 모델 지정
      options = {}      // 추가 옵션
    } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: '문제 출제 요청 프롬프트가 필요합니다.'
      });
    }

    // 모델 설정 (기본값)
    const generationModel = models.generation || 'gpt-4o';      // 문제 생성
    const verificationModel = models.verification || 'o3';      // 자동 검증
    const explanationModel = models.explanation || 'o3';        // 해설 작성

    console.log('📝 멀티 모델 문제 출제 워크플로우 시작');
    console.log(`  - 생성 모델: ${generationModel}`);
    console.log(`  - 검증 모델: ${verificationModel}`);
    console.log(`  - 해설 모델: ${explanationModel}`);

    const workflowResult = {
      steps: [],
      generatedProblem: null,
      verification: null,
      explanation: null,
      finalProblem: null
    };

    // ============ STEP 1: 문제 생성 ============
    console.log('🔷 Step 1: 문제 생성 시작...');
    workflowResult.steps.push({ step: 1, name: '문제 생성', status: 'in_progress', model: generationModel });

    let generationPrompt = `당신은 수학 문제 출제 전문가입니다.

## 요청사항
${prompt}

`;

    if (engineCode) {
      generationPrompt += `## 참고 엔진 코드
\`\`\`python
${engineCode}
\`\`\`

위 엔진 코드의 패턴을 참고하여 문제를 생성해주세요.

`;
    }

    if (context) {
      generationPrompt += `## 추가 컨텍스트
${context}

`;
    }

    generationPrompt += `## 출력 형식
다음 JSON 형식으로 출력해주세요:
{
  "problem": {
    "title": "문제 제목",
    "statement": "문제 지문 (LaTeX 수식 포함 가능)",
    "conditions": ["조건1", "조건2"],
    "question": "실제 질문",
    "choices": ["①", "②", "③", "④", "⑤"] 또는 null (주관식인 경우),
    "answer": "정답",
    "difficulty": "상/중/하",
    "category": "문제 유형"
  },
  "solution_hint": "풀이 핵심 힌트"
}`;

    let generatedProblem = null;

    try {
      if (generationModel.startsWith('gpt') || generationModel.startsWith('o')) {
        // OpenAI 모델 사용
        if (!openaiClient) {
          throw new Error('OpenAI API 키가 설정되지 않았습니다.');
        }

        const openaiConfig = {
          model: generationModel,
          messages: [
            { role: 'system', content: '당신은 수학 문제 출제 전문가입니다. 정확하고 교육적으로 가치 있는 문제를 생성합니다.' },
            { role: 'user', content: generationPrompt }
          ]
        };

        // o1, o3 모델은 다른 파라미터 사용
        if (generationModel.startsWith('o')) {
          openaiConfig.max_completion_tokens = 8192;
        } else {
          openaiConfig.max_tokens = 4096;
          openaiConfig.temperature = 0.7;
        }

        const response = await openaiClient.chat.completions.create(openaiConfig);
        generatedProblem = response.choices[0].message.content;
      } else {
        // Gemini 모델 사용
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
          model: generationModel,
          generationConfig: { temperature: 0.7 }
        });
        const result = await model.generateContent(generationPrompt);
        generatedProblem = result.response.text();
      }

      workflowResult.generatedProblem = generatedProblem;
      workflowResult.steps[0].status = 'completed';
      workflowResult.steps[0].result = '문제 생성 완료';
      console.log('✅ Step 1 완료: 문제 생성됨');

    } catch (error) {
      console.error('❌ Step 1 오류:', error.message);
      workflowResult.steps[0].status = 'failed';
      workflowResult.steps[0].error = error.message;

      return res.json({
        success: false,
        error: `문제 생성 실패: ${error.message}`,
        workflow: workflowResult
      });
    }

    // ============ STEP 2: 자동 검증 ============
    console.log('🔷 Step 2: 자동 검증 시작...');
    workflowResult.steps.push({ step: 2, name: '자동 검증', status: 'in_progress', model: verificationModel });

    const verificationPrompt = `당신은 수학 문제 검증 전문가입니다.

## 검증할 문제
${generatedProblem}

## 검증 항목
1. 수학적 정확성: 문제의 조건과 정답이 수학적으로 정확한가?
2. 논리적 일관성: 문제의 조건들이 서로 모순되지 않는가?
3. 풀이 가능성: 주어진 조건만으로 문제를 풀 수 있는가?
4. 정답 검증: 제시된 정답이 올바른가? (직접 풀어서 확인)
5. 난이도 적절성: 난이도가 적절하게 설정되었는가?

## 출력 형식 (JSON)
{
  "verification": {
    "isValid": true/false,
    "mathematicalAccuracy": {
      "score": 0-100,
      "issues": ["이슈1", "이슈2"] 또는 []
    },
    "logicalConsistency": {
      "score": 0-100,
      "issues": []
    },
    "solvability": {
      "score": 0-100,
      "issues": []
    },
    "answerVerification": {
      "isCorrect": true/false,
      "calculatedAnswer": "검증된 정답",
      "workingProcess": "풀이 과정 요약"
    },
    "difficultyAssessment": {
      "appropriate": true/false,
      "suggestedDifficulty": "상/중/하"
    },
    "overallScore": 0-100,
    "recommendations": ["권장사항1", "권장사항2"],
    "corrections": {
      "needed": true/false,
      "correctedProblem": null 또는 수정된 문제 JSON
    }
  }
}`;

    let verification = null;

    try {
      if (verificationModel.startsWith('gpt') || verificationModel.startsWith('o')) {
        if (!openaiClient) {
          throw new Error('OpenAI API 키가 설정되지 않았습니다.');
        }

        const openaiConfig = {
          model: verificationModel,
          messages: [
            { role: 'system', content: '당신은 수학 문제 검증 전문가입니다. 문제의 정확성과 품질을 엄격하게 검증합니다.' },
            { role: 'user', content: verificationPrompt }
          ]
        };

        if (verificationModel.startsWith('o')) {
          openaiConfig.max_completion_tokens = 16384;
        } else {
          openaiConfig.max_tokens = 8192;
          openaiConfig.temperature = 0.1;
        }

        const response = await openaiClient.chat.completions.create(openaiConfig);
        verification = response.choices[0].message.content;
      } else {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
          model: verificationModel,
          generationConfig: { temperature: 0.1 }
        });
        const result = await model.generateContent(verificationPrompt);
        verification = result.response.text();
      }

      workflowResult.verification = verification;
      workflowResult.steps[1].status = 'completed';
      workflowResult.steps[1].result = '검증 완료';
      console.log('✅ Step 2 완료: 검증됨');

    } catch (error) {
      console.error('❌ Step 2 오류:', error.message);
      workflowResult.steps[1].status = 'failed';
      workflowResult.steps[1].error = error.message;
      // 검증 실패해도 계속 진행
    }

    // ============ STEP 3: 최종 해설 작성 ============
    console.log('🔷 Step 3: 최종 해설 작성 시작...');
    workflowResult.steps.push({ step: 3, name: '해설 작성', status: 'in_progress', model: explanationModel });

    // 검증 결과에서 수정이 필요한 경우 수정된 문제 사용
    let problemForExplanation = generatedProblem;
    try {
      const verificationJson = JSON.parse(verification.match(/\{[\s\S]*\}/)?.[0] || '{}');
      if (verificationJson.verification?.corrections?.needed && verificationJson.verification?.corrections?.correctedProblem) {
        problemForExplanation = JSON.stringify(verificationJson.verification.corrections.correctedProblem, null, 2);
        console.log('📝 검증 결과에 따라 수정된 문제 사용');
      }
    } catch (e) {
      // JSON 파싱 실패 시 원본 문제 사용
    }

    const explanationPrompt = `당신은 수학 교육 전문가입니다.

## 문제
${problemForExplanation}

## 검증 결과
${verification || '검증 결과 없음'}

## 요청사항
위 문제에 대한 상세하고 교육적인 해설을 작성해주세요.

## 출력 형식 (JSON)
{
  "explanation": {
    "summary": "문제 해설 요약 (1-2문장)",
    "keyConceptsExplained": [
      {
        "concept": "핵심 개념명",
        "explanation": "개념 설명"
      }
    ],
    "stepByStepSolution": [
      {
        "step": 1,
        "title": "단계 제목",
        "content": "상세 풀이 내용 (LaTeX 수식 포함)",
        "tip": "학습 팁 (선택적)"
      }
    ],
    "commonMistakes": ["자주 하는 실수1", "자주 하는 실수2"],
    "relatedProblems": ["관련 문제 유형1", "관련 문제 유형2"],
    "difficultyAnalysis": "난이도 분석 및 학습 조언"
  }
}`;

    let explanation = null;

    try {
      if (explanationModel.startsWith('gpt') || explanationModel.startsWith('o')) {
        if (!openaiClient) {
          throw new Error('OpenAI API 키가 설정되지 않았습니다.');
        }

        const openaiConfig = {
          model: explanationModel,
          messages: [
            { role: 'system', content: '당신은 수학 교육 전문가입니다. 학생들이 이해하기 쉽도록 상세하고 친절한 해설을 작성합니다.' },
            { role: 'user', content: explanationPrompt }
          ]
        };

        if (explanationModel.startsWith('o')) {
          openaiConfig.max_completion_tokens = 16384;
        } else {
          openaiConfig.max_tokens = 8192;
          openaiConfig.temperature = 0.3;
        }

        const response = await openaiClient.chat.completions.create(openaiConfig);
        explanation = response.choices[0].message.content;
      } else {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
          model: explanationModel,
          generationConfig: { temperature: 0.3 }
        });
        const result = await model.generateContent(explanationPrompt);
        explanation = result.response.text();
      }

      workflowResult.explanation = explanation;
      workflowResult.steps[2].status = 'completed';
      workflowResult.steps[2].result = '해설 작성 완료';
      console.log('✅ Step 3 완료: 해설 작성됨');

    } catch (error) {
      console.error('❌ Step 3 오류:', error.message);
      workflowResult.steps[2].status = 'failed';
      workflowResult.steps[2].error = error.message;
    }

    // ============ 최종 결과 조합 ============
    console.log('📦 최종 결과 조합 중...');

    // JSON 파싱 시도
    const parseJSON = (text) => {
      try {
        const match = text?.match(/\{[\s\S]*\}/);
        return match ? JSON.parse(match[0]) : null;
      } catch (e) {
        return null;
      }
    };

    const problemData = parseJSON(generatedProblem);
    const verificationData = parseJSON(verification);
    const explanationData = parseJSON(explanation);

    workflowResult.finalProblem = {
      problem: problemData?.problem || { raw: generatedProblem },
      verification: verificationData?.verification || { raw: verification },
      explanation: explanationData?.explanation || { raw: explanation },
      models: {
        generation: generationModel,
        verification: verificationModel,
        explanation: explanationModel
      },
      timestamp: new Date().toISOString()
    };

    console.log('✅ 멀티 모델 문제 출제 워크플로우 완료');

    res.json({
      success: true,
      workflow: workflowResult
    });

  } catch (error) {
    console.error('워크플로우 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/variation-solution
 * 변형 문제에 대한 풀이 생성
 */
app.post('/api/variation-solution', async (req, res) => {
  try {
    const { problem, metadata, geminiModel, openaiModel, llmType } = req.body;

    // 하위 호환성
    const selectedGeminiModel = geminiModel || 'gemini-2.5-flash';
    const selectedOpenaiModel = openaiModel || (llmType === 'gpt4' ? 'gpt-4o' : '');

    if (!problem) {
      return res.status(400).json({
        success: false,
        error: '풀이할 문제가 필요합니다.'
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        success: false,
        error: 'Gemini API 키가 설정되지 않았습니다.'
      });
    }

    console.log(`💡 변형 문제 풀이 생성 시작 - Gemini: ${selectedGeminiModel}, OpenAI: ${selectedOpenaiModel || '없음'}`);

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const model = genAI.getGenerativeModel({
      model: selectedGeminiModel,
      generationConfig: {
        temperature: 0.3,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      }
    });

    const solutionPrompt = `당신은 ${metadata?.subject || '수학'} 전문 교사입니다.
다음 문제에 대한 상세한 풀이를 작성해주세요.

## 문제
${problem}

## 풀이 작성 규칙
1. **단계별로 명확하게** 풀이 과정을 설명하세요.
2. 각 단계의 **이유와 근거**를 설명하세요.
3. 수학 수식은 반드시 **LaTeX 형식** ($...$ 또는 $$...$$)으로 작성하세요.
4. 핵심 개념이나 공식이 있다면 **짚어주세요**.
5. 학생들이 자주 하는 **실수나 주의점**이 있다면 언급해주세요.
6. 마지막에 **최종 정답**을 명확히 표시하세요.

## 출력 형식
### 풀이 과정
[단계별 풀이]

### 핵심 개념
[이 문제에서 사용된 핵심 개념/공식]

### 주의할 점
[자주 하는 실수나 주의점]

### 최종 정답
[정답]

이제 풀이를 작성해주세요.`;

    const result = await model.generateContent(solutionPrompt);
    const response = await result.response;
    const geminiSolution = response.text();

    console.log('✅ Gemini 풀이 생성 완료');

    // OpenAI 추가 풀이 (선택된 경우)
    let openaiSolution = null;
    if (selectedOpenaiModel && openaiClient) {
      try {
        console.log(`🔄 OpenAI ${selectedOpenaiModel} 풀이 생성 시작...`);

        const openaiConfig = {
          model: selectedOpenaiModel,
          messages: [
            {
              role: 'system',
              content: `당신은 ${metadata?.subject || '수학'} 전문 교사입니다. 문제에 대한 상세한 풀이를 작성하세요. 수학 수식은 LaTeX 형식으로 작성하세요.`
            },
            {
              role: 'user',
              content: `다음 문제를 풀이해주세요:\n\n${problem}\n\n단계별로 명확하게 풀이하고, 핵심 개념과 주의점도 설명해주세요.`
            }
          ],
          max_tokens: 4096,
          temperature: 0.3
        };

        // o3 모델 설정
        if (selectedOpenaiModel.startsWith('o3')) {
          openaiConfig.max_completion_tokens = 8192;
          delete openaiConfig.max_tokens;
          delete openaiConfig.temperature;
        }

        const openaiResponse = await openaiClient.chat.completions.create(openaiConfig);
        openaiSolution = openaiResponse.choices[0].message.content;
        console.log(`✅ OpenAI ${selectedOpenaiModel} 풀이 생성 완료`);
      } catch (openaiError) {
        console.error('OpenAI 풀이 생성 오류:', openaiError.message);
        openaiSolution = `OpenAI 풀이 생성 실패: ${openaiError.message}`;
      }
    }

    res.json({
      success: true,
      solution: geminiSolution,
      geminiModel: selectedGeminiModel,
      openaiModel: selectedOpenaiModel || null,
      openaiSolution: openaiSolution
    });
  } catch (error) {
    console.error('변형 문제 풀이 생성 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== Phase 2: OCR 및 자동화 API ====================

/**
 * POST /api/ocr-extract
 * 이미지에서 텍스트 추출 (OCR)
 */
app.post('/api/ocr-extract', async (req, res) => {
  try {
    const { images, extractType = 'full', ocrModel = 'gemini' } = req.body;

    if (!images || images.length === 0) {
      return res.status(400).json({
        success: false,
        error: '추출할 이미지가 필요합니다.'
      });
    }

    // 특수문자 인식 프롬프트 (공통)
    const specialCharPrompt = `
## 중요: 특수문자 정확히 인식
다음 특수문자들을 반드시 정확하게 구분하여 추출해야 합니다:
- 원문자 한글: ㉠, ㉡, ㉢, ㉣, ㉤, ㉥, ㉦, ㉧, ㉨, ㉩, ㉪, ㉫, ㉬, ㉭ (영역/조건 표시용)
- 원문자 숫자: ①, ②, ③, ④, ⑤ (선지 번호용)
- 원문자 알파벳: ⓐ, ⓑ, ⓒ, ⓓ, ⓔ
- 괄호 문자: ⑴, ⑵, ⑶, ⑷, ⑸
- 밑줄/빈칸: ___, ______, (   ), [   ] 등 빈칸 표시 정확히 유지
- 첨자: 위첨자, 아래첨자 정확히 구분`;

    const ocrPrompt = extractType === 'problem'
      ? `이 이미지에서 수학/과학 문제를 정확하게 추출해주세요.
${specialCharPrompt}

## 추출 규칙
1. 문제 텍스트를 정확하게 그대로 추출 (특수문자 변형 금지)
2. 수학 수식은 LaTeX 형식으로 변환 ($...$ 사용)
3. 보기가 있으면 원본의 기호 그대로 유지 (①②③④⑤ 또는 ㄱㄴㄷㄹ 등)
4. 그림이나 그래프 설명이 필요하면 [그림: 설명] 형태로 추가
5. 문제 번호가 있으면 포함

추출된 문제 텍스트만 그대로 출력해주세요. JSON이나 다른 형식 없이 순수한 문제 내용만 출력합니다.`
      : `이 이미지의 모든 텍스트를 정확하게 추출해주세요.
${specialCharPrompt}

## 추출 규칙
1. 모든 텍스트를 빠짐없이 추출 (특수문자 변형 금지)
2. 수학 수식은 LaTeX 형식으로 변환 ($...$ 사용)
3. 레이아웃과 구조를 최대한 유지
4. 표가 있으면 마크다운 표 형식으로 변환
5. 그림이 있으면 [그림: 설명] 형태로 표시

추출된 텍스트를 그대로 출력해주세요.`;

    let extractedText = '';
    let usedModel = '';

    // OpenAI Vision OCR
    if (ocrModel === 'openai' || ocrModel === 'gpt4') {
      if (!openaiClient) {
        return res.status(503).json({
          success: false,
          error: 'OpenAI API 키가 설정되지 않았습니다.'
        });
      }

      console.log('📝 OpenAI Vision OCR 텍스트 추출 시작');

      // OpenAI Vision API용 이미지 포맷
      const imageContents = images.map(img => {
        let imageUrl = img.data;

        // base64 데이터 정리 (공백, 줄바꿈 제거)
        if (imageUrl.startsWith('data:')) {
          // data URL 형식이면 그대로 사용하되 base64 부분 정리
          const parts = imageUrl.split(',');
          if (parts.length === 2) {
            const cleanBase64 = parts[1].replace(/\s/g, '');
            imageUrl = parts[0] + ',' + cleanBase64;
          }
        } else {
          // 순수 base64면 data URL 형식으로 변환
          const cleanBase64 = imageUrl.replace(/\s/g, '');
          const mimeType = img.mimeType || 'image/png';
          imageUrl = `data:${mimeType};base64,${cleanBase64}`;
        }

        console.log('📷 이미지 URL 형식:', imageUrl.substring(0, 50) + '...');

        return {
          type: 'image_url',
          image_url: {
            url: imageUrl,
            detail: 'high'
          }
        };
      });

      const openaiResponse = await openaiClient.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: ocrPrompt },
              ...imageContents
            ]
          }
        ],
        max_tokens: 4096,
        temperature: 0.1
      });

      extractedText = openaiResponse.choices[0].message.content;
      usedModel = 'gpt-4o';
      console.log('✅ OpenAI Vision OCR 추출 완료');
    }
    // Gemini Vision OCR (기본)
    else {
      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({
          success: false,
          error: 'Gemini API 키가 설정되지 않았습니다.'
        });
      }

      console.log('📝 Gemini OCR 텍스트 추출 시작');

      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

      // OCR에는 더 정확한 모델 사용 (특수문자 인식 향상)
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
        }
      });

      const imageParts = images.map(img => ({
        inlineData: {
          mimeType: img.mimeType || 'image/png',
          data: img.data.replace(/^data:[^;]+;base64,/, '')
        }
      }));

      const result = await model.generateContent([ocrPrompt, ...imageParts]);
      const response = await result.response;
      extractedText = response.text();
      usedModel = 'gemini-2.5-flash';
      console.log('✅ Gemini OCR 추출 완료');
    }

    res.json({
      success: true,
      extractedText,
      extractType,
      model: usedModel
    });
  } catch (error) {
    console.error('OCR 추출 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/auto-label
 * 문제 자동 분류 및 라벨링
 */
app.post('/api/auto-label', async (req, res) => {
  try {
    const { problemText, images } = req.body;

    if (!problemText && (!images || images.length === 0)) {
      return res.status(400).json({
        success: false,
        error: '분류할 문제 텍스트 또는 이미지가 필요합니다.'
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        success: false,
        error: 'Gemini API 키가 설정되지 않았습니다.'
      });
    }

    console.log('🏷️ 자동 라벨링 시작');

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
      }
    });

    const labelPrompt = `당신은 한국 교육과정 전문가입니다.
다음 문제를 분석하여 정확한 분류 정보를 JSON 형식으로 제공해주세요.

## 문제
${problemText || '[이미지로 제공됨]'}

## 출력 형식 (반드시 유효한 JSON으로 출력)
{
  "subject": "교과명 (국어/영어/수학/과학/사회 중 하나)",
  "course": "과목명 (예: 수학, 수학I, 수학II, 미적분, 기하, 확률과통계, 물리학I, 화학I 등)",
  "grade": "학년 (예: 고등학교 1학년, 고등학교 2학년, 중학교 3학년 등)",
  "chapter": "추정 단원명",
  "difficulty": "난이도 (상/중/하)",
  "problemType": "문제 유형 (객관식/주관식/서술형/단답형)",
  "concepts": ["관련 개념1", "관련 개념2"],
  "skills": ["필요한 능력1", "필요한 능력2"],
  "estimatedTime": "예상 풀이 시간 (분)",
  "confidence": 0.0~1.0 (분류 신뢰도)
}

반드시 위 JSON 형식으로만 출력하세요. 다른 설명은 포함하지 마세요.`;

    let contents = [labelPrompt];
    if (images && images.length > 0) {
      const imageParts = images.map(img => ({
        inlineData: {
          mimeType: img.mimeType || 'image/png',
          data: img.data.replace(/^data:[^;]+;base64,/, '')
        }
      }));
      contents = [...contents, ...imageParts];
    }

    const result = await model.generateContent(contents);
    const response = await result.response;
    let labelText = response.text();

    // JSON 추출
    let labels;
    try {
      const jsonMatch = labelText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        labels = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('JSON 형식을 찾을 수 없습니다.');
      }
    } catch (e) {
      console.warn('라벨 JSON 파싱 실패:', e.message);
      labels = { raw: labelText, parseError: true };
    }

    console.log('✅ 자동 라벨링 완료');

    res.json({
      success: true,
      labels
    });
  } catch (error) {
    console.error('자동 라벨링 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/multi-llm-review
 * 다중 LLM으로 변형 문제 검토
 */
app.post('/api/multi-llm-review', async (req, res) => {
  try {
    const { originalProblem, variationProblem, metadata } = req.body;

    if (!originalProblem || !variationProblem) {
      return res.status(400).json({
        success: false,
        error: '원본 문제와 변형 문제가 모두 필요합니다.'
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        success: false,
        error: 'Gemini API 키가 설정되지 않았습니다.'
      });
    }

    console.log('🔍 다중 LLM 검토 시작');

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // 검토 관점 1: 수학적 정확성
    const accuracyModel = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: { temperature: 0.1 }
    });

    const accuracyPrompt = `당신은 수학 정확성 검토 전문가입니다.

## 원본 문제
${originalProblem}

## 변형 문제
${variationProblem}

## 검토 항목
1. 수학적 오류가 있는지 확인
2. 정답이 올바른지 검증
3. 계산 과정에 문제가 없는지 확인

## 출력 형식 (JSON)
{
  "isAccurate": true/false,
  "errors": ["오류1", "오류2"] 또는 [],
  "suggestions": ["개선제안1"] 또는 [],
  "score": 0~100
}`;

    // 검토 관점 2: 교육적 적절성
    const pedagogyModel = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: { temperature: 0.2 }
    });

    const pedagogyPrompt = `당신은 교육 전문가입니다.

## 원본 문제
${originalProblem}

## 변형 문제
${variationProblem}

## 메타데이터
학년: ${metadata?.grade || '미지정'}
단원: ${metadata?.chapter || '미지정'}

## 검토 항목
1. 해당 학년 수준에 적합한지
2. 학습 목표에 부합하는지
3. 문제 표현이 명확한지
4. 난이도가 적절한지

## 출력 형식 (JSON)
{
  "isAppropriate": true/false,
  "gradeMatch": true/false,
  "clarity": 0~100,
  "difficulty": "상/중/하",
  "feedback": ["피드백1", "피드백2"],
  "score": 0~100
}`;

    // 검토 관점 3: 변형 품질
    const qualityModel = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: { temperature: 0.2 }
    });

    const qualityPrompt = `당신은 문제 출제 전문가입니다.

## 원본 문제
${originalProblem}

## 변형 문제
${variationProblem}

## 검토 항목
1. 원본과 충분히 다른 변형인지
2. 원본의 핵심 개념을 유지하는지
3. 단순 숫자 변경이 아닌 창의적 변형인지
4. 문제로서의 완성도

## 출력 형식 (JSON)
{
  "isDifferentEnough": true/false,
  "preservesConcept": true/false,
  "creativity": 0~100,
  "completeness": 0~100,
  "overallQuality": 0~100,
  "improvements": ["개선점1", "개선점2"]
}`;

    // 병렬로 3가지 검토 실행
    const [accuracyResult, pedagogyResult, qualityResult] = await Promise.all([
      accuracyModel.generateContent(accuracyPrompt),
      pedagogyModel.generateContent(pedagogyPrompt),
      qualityModel.generateContent(qualityPrompt)
    ]);

    const parseReviewJSON = (text) => {
      try {
        const match = text.match(/\{[\s\S]*\}/);
        return match ? JSON.parse(match[0]) : { raw: text, parseError: true };
      } catch (e) {
        return { raw: text, parseError: true };
      }
    };

    const reviews = {
      accuracy: parseReviewJSON(accuracyResult.response.text()),
      pedagogy: parseReviewJSON(pedagogyResult.response.text()),
      quality: parseReviewJSON(qualityResult.response.text())
    };

    // 종합 점수 계산
    const avgScore = (
      (reviews.accuracy.score || 0) +
      (reviews.pedagogy.score || 0) +
      (reviews.quality.overallQuality || 0)
    ) / 3;

    const isApproved = avgScore >= 70 &&
      reviews.accuracy.isAccurate !== false &&
      reviews.pedagogy.isAppropriate !== false;

    console.log('✅ 다중 LLM 검토 완료 (점수:', Math.round(avgScore), ')');

    res.json({
      success: true,
      reviews,
      summary: {
        averageScore: Math.round(avgScore),
        isApproved,
        recommendation: isApproved ? '승인 권장' : '수정 필요'
      }
    });
  } catch (error) {
    console.error('다중 LLM 검토 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/save-variation
 * 변형 문제 저장 (승인 상태 포함)
 */
app.post('/api/save-variation', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'Firebase가 설정되지 않았습니다.'
      });
    }

    const {
      originalProblem,
      variationProblem,
      solution,
      metadata,
      reviewResult,
      status = 'pending' // pending, approved, rejected
    } = req.body;

    if (!variationProblem) {
      return res.status(400).json({
        success: false,
        error: '저장할 변형 문제가 필요합니다.'
      });
    }

    const variationData = {
      originalProblem: originalProblem || '',
      variationProblem,
      solution: solution || '',
      metadata: metadata || {},
      reviewResult: reviewResult || null,
      status,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('variations').add(variationData);

    console.log('✅ 변형 문제 저장:', docRef.id, '(상태:', status, ')');

    res.json({
      success: true,
      id: docRef.id,
      message: '변형 문제가 저장되었습니다.'
    });
  } catch (error) {
    console.error('변형 문제 저장 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/variations
 * 변형 문제 목록 조회
 */
app.get('/api/variations', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'Firebase가 설정되지 않았습니다.'
      });
    }

    const { status, limit = 20 } = req.query;

    let query = db.collection('variations')
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit));

    if (status) {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.get();
    const variations = [];

    snapshot.forEach(doc => {
      variations.push({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || null
      });
    });

    res.json({
      success: true,
      variations,
      count: variations.length
    });
  } catch (error) {
    console.error('변형 문제 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PATCH /api/variations/:id/status
 * 변형 문제 상태 업데이트 (승인/거절)
 */
app.patch('/api/variations/:id/status', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'Firebase가 설정되지 않았습니다.'
      });
    }

    const { id } = req.params;
    const { status, reviewNote } = req.body;

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: '유효하지 않은 상태입니다. (pending/approved/rejected)'
      });
    }

    await db.collection('variations').doc(id).update({
      status,
      reviewNote: reviewNote || '',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('✅ 변형 문제 상태 업데이트:', id, '→', status);

    res.json({
      success: true,
      message: `문제가 ${status === 'approved' ? '승인' : status === 'rejected' ? '거절' : '대기 상태로 변경'}되었습니다.`
    });
  } catch (error) {
    console.error('변형 문제 상태 업데이트 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== Phase 3: 고급 기능 API ====================

/**
 * POST /api/detect-regions
 * AI를 사용한 이미지 내 영역 자동 감지
 */
app.post('/api/detect-regions', async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        error: '이미지가 필요합니다.'
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        success: false,
        error: 'Gemini API 키가 설정되지 않았습니다.'
      });
    }

    console.log('🔍 영역 자동 감지 시작');

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
      }
    });

    const detectPrompt = `이 이미지에서 문제와 자료(그래프, 표, 그림) 영역을 감지해주세요.

## 출력 형식 (JSON)
{
  "problems": [
    {"x": 픽셀X, "y": 픽셀Y, "width": 너비, "height": 높이, "label": "문제1"}
  ],
  "assets": [
    {"x": 픽셀X, "y": 픽셀Y, "width": 너비, "height": 높이, "type": "graph|table|image", "label": "그래프1"}
  ]
}

## 규칙
1. 문제 텍스트가 있는 영역을 "problems"로 분류
2. 그래프, 표, 그림 등의 시각 자료를 "assets"로 분류
3. 좌표는 이미지의 왼쪽 상단을 (0,0)으로 함
4. 영역이 없으면 빈 배열 반환

반드시 JSON 형식으로만 출력하세요.`;

    const imagePart = {
      inlineData: {
        mimeType: 'image/png',
        data: image.replace(/^data:[^;]+;base64,/, '')
      }
    };

    const result = await model.generateContent([detectPrompt, imagePart]);
    const response = await result.response;
    let regionText = response.text();

    // JSON 추출
    let regions;
    try {
      const jsonMatch = regionText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        regions = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('JSON 형식을 찾을 수 없습니다.');
      }
    } catch (e) {
      console.warn('영역 감지 JSON 파싱 실패:', e.message);
      regions = { problems: [], assets: [] };
    }

    console.log('✅ 영역 자동 감지 완료:', regions);

    res.json({
      success: true,
      regions
    });
  } catch (error) {
    console.error('영역 감지 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/chat-modify
 * 대화형 문제 수정
 */
app.post('/api/chat-modify', async (req, res) => {
  try {
    const { problem, message, history } = req.body;

    if (!problem || !message) {
      return res.status(400).json({
        success: false,
        error: '문제와 수정 요청이 필요합니다.'
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        success: false,
        error: 'Gemini API 키가 설정되지 않았습니다.'
      });
    }

    console.log('💬 대화형 수정 시작:', message.substring(0, 50));

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
      }
    });

    // 대화 히스토리 구성
    const historyContext = history && history.length > 0
      ? history.map(h => `${h.role === 'user' ? '사용자' : 'AI'}: ${h.content}`).join('\n')
      : '';

    const chatPrompt = `당신은 수학 문제 편집 전문가입니다.

## 현재 문제
${problem}

${historyContext ? `## 이전 대화\n${historyContext}\n` : ''}

## 사용자 요청
${message}

## 응답 형식 (JSON)
{
  "response": "사용자에게 보여줄 응답 메시지",
  "modifiedProblem": "수정된 문제 (수정이 필요한 경우만, 없으면 null)",
  "explanation": "수정 내용에 대한 설명"
}

## 규칙
1. 사용자 요청에 따라 문제를 수정
2. 수학적 정확성 유지
3. LaTeX 형식 유지 ($...$)
4. 친절하고 명확한 응답

반드시 JSON 형식으로만 출력하세요.`;

    const result = await model.generateContent(chatPrompt);
    const response = await result.response;
    let chatText = response.text();

    // JSON 추출
    let chatResponse;
    try {
      const jsonMatch = chatText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        chatResponse = JSON.parse(jsonMatch[0]);
      } else {
        chatResponse = {
          response: chatText,
          modifiedProblem: null,
          explanation: ''
        };
      }
    } catch (e) {
      chatResponse = {
        response: chatText,
        modifiedProblem: null,
        explanation: ''
      };
    }

    console.log('✅ 대화형 수정 완료');

    res.json({
      success: true,
      response: chatResponse.response,
      modifiedProblem: chatResponse.modifiedProblem,
      explanation: chatResponse.explanation
    });
  } catch (error) {
    console.error('대화형 수정 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/check-rules
 * 엔진 규칙 검사
 */
app.post('/api/check-rules', async (req, res) => {
  try {
    const { problem, metadata } = req.body;

    if (!problem) {
      return res.status(400).json({
        success: false,
        error: '검사할 문제가 필요합니다.'
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        success: false,
        error: 'Gemini API 키가 설정되지 않았습니다.'
      });
    }

    console.log('⚙️ 엔진 규칙 검사 시작');

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
      }
    });

    const rulePrompt = `당신은 수학 문제 품질 검사 전문가입니다.

## 검사할 문제
${problem}

## 메타데이터
- 학년: ${metadata?.grade || '미지정'}
- 유형: ${metadata?.category || '미지정'}

## 검사 규칙
1. 학년 수준 적합성: 해당 학년에서 배우지 않은 개념이 있는지 확인
2. 수학적 정확성: 문제의 수학적 오류 확인
3. 문제 완결성: 풀이에 필요한 모든 정보가 제공되었는지 확인
4. 명확성: 문제가 명확하게 이해되는지 확인
5. 난이도 적절성: 학년에 맞는 난이도인지 확인

## 출력 형식 (JSON)
{
  "violations": [
    {"rule": "규칙명", "message": "위반 내용", "severity": "error|warning"}
  ],
  "suggestions": [
    {"type": "fix", "description": "수정 제안", "autoFixable": true|false}
  ],
  "passedRules": ["통과한 규칙1", "통과한 규칙2"],
  "overallScore": 0~100
}

## 규칙
- violations가 없으면 빈 배열 반환
- severity: error(심각한 오류), warning(경고)
- autoFixable: AI가 자동으로 수정 가능한지 여부

반드시 JSON 형식으로만 출력하세요.`;

    const result = await model.generateContent(rulePrompt);
    const response = await result.response;
    let ruleText = response.text();

    // JSON 추출
    let ruleResult;
    try {
      const jsonMatch = ruleText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        ruleResult = JSON.parse(jsonMatch[0]);
      } else {
        ruleResult = { violations: [], suggestions: [], passedRules: [], overallScore: 100 };
      }
    } catch (e) {
      ruleResult = { violations: [], suggestions: [], passedRules: [], overallScore: 100 };
    }

    console.log('✅ 엔진 규칙 검사 완료:', ruleResult.violations.length, '개 위반');

    res.json({
      success: true,
      violations: ruleResult.violations,
      suggestions: ruleResult.suggestions,
      passedRules: ruleResult.passedRules,
      overallScore: ruleResult.overallScore
    });
  } catch (error) {
    console.error('규칙 검사 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/auto-fix-problem
 * 문제 자동 수정
 */
app.post('/api/auto-fix-problem', async (req, res) => {
  try {
    const { problem, suggestions, metadata } = req.body;

    if (!problem || !suggestions) {
      return res.status(400).json({
        success: false,
        error: '문제와 수정 제안이 필요합니다.'
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        success: false,
        error: 'Gemini API 키가 설정되지 않았습니다.'
      });
    }

    console.log('🔧 자동 수정 시작');

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4096,
      }
    });

    const fixPrompt = `당신은 수학 문제 수정 전문가입니다.

## 원본 문제
${problem}

## 수정 제안
${JSON.stringify(suggestions, null, 2)}

## 메타데이터
- 학년: ${metadata?.grade || '미지정'}
- 유형: ${metadata?.category || '미지정'}

## 작업
위 수정 제안을 반영하여 문제를 수정해주세요.

## 출력 형식 (JSON)
{
  "fixedProblem": "수정된 문제 전체 텍스트",
  "changes": ["변경사항1", "변경사항2"],
  "confidence": 0.0~1.0
}

## 규칙
1. 수학적 정확성 유지
2. LaTeX 형식 유지
3. 원본 의도 보존
4. 학년 수준에 맞게 수정

반드시 JSON 형식으로만 출력하세요.`;

    const result = await model.generateContent(fixPrompt);
    const response = await result.response;
    let fixText = response.text();

    // JSON 추출
    let fixResult;
    try {
      const jsonMatch = fixText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        fixResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('JSON 형식을 찾을 수 없습니다.');
      }
    } catch (e) {
      return res.status(500).json({
        success: false,
        error: '자동 수정 결과 파싱 실패'
      });
    }

    console.log('✅ 자동 수정 완료');

    res.json({
      success: true,
      fixedProblem: fixResult.fixedProblem,
      changes: fixResult.changes,
      confidence: fixResult.confidence
    });
  } catch (error) {
    console.error('자동 수정 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/save-assets
 * 문제 자료(이미지/그래프/표) 저장
 */
app.post('/api/save-assets', async (req, res) => {
  try {
    const { assets, problemId } = req.body;

    if (!assets || assets.length === 0) {
      return res.status(400).json({
        success: false,
        error: '저장할 자료가 없습니다.'
      });
    }

    // Firebase 없이도 로컬 저장 가능
    const assetsDir = path.join(__dirname, 'uploads', 'assets');
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }

    const savedAssets = [];

    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      const assetData = asset.data || asset;

      // Base64 이미지 저장
      if (assetData.startsWith('data:')) {
        const matches = assetData.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          const mimeType = matches[1];
          const base64Data = matches[2];
          const ext = mimeType.split('/')[1] || 'png';
          const filename = `${problemId}_asset_${i + 1}_${Date.now()}.${ext}`;
          const filepath = path.join(assetsDir, filename);

          fs.writeFileSync(filepath, Buffer.from(base64Data, 'base64'));

          savedAssets.push({
            id: `asset_${Date.now()}_${i}`,
            filename,
            filepath: `/uploads/assets/${filename}`,
            type: asset.type || 'image',
            label: asset.label || `자료 ${i + 1}`
          });
        }
      }
    }

    // Firebase가 있으면 메타데이터 저장
    if (db) {
      await db.collection('assets').add({
        problemId,
        assets: savedAssets,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    console.log('✅ 자료 저장 완료:', savedAssets.length, '개');

    res.json({
      success: true,
      savedAssets,
      count: savedAssets.length
    });
  } catch (error) {
    console.error('자료 저장 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/extract-text
 * 단일 이미지에서 텍스트 추출 (OCR)
 */
app.post('/api/extract-text', async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        error: '이미지가 필요합니다.'
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        success: false,
        error: 'Gemini API 키가 설정되지 않았습니다.'
      });
    }

    console.log('📝 단일 이미지 OCR 시작');

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
      }
    });

    const ocrPrompt = `이 이미지의 모든 텍스트를 정확하게 추출해주세요.

## 추출 규칙
1. 모든 텍스트를 빠짐없이 추출
2. 수학 수식은 LaTeX 형식으로 변환 ($...$ 사용)
3. 레이아웃과 구조를 최대한 유지
4. 표가 있으면 마크다운 표 형식으로 변환
5. 그림이 있으면 [그림: 설명] 형태로 표시

추출된 텍스트만 출력해주세요. 다른 설명은 포함하지 마세요.`;

    const imagePart = {
      inlineData: {
        mimeType: 'image/png',
        data: image.replace(/^data:[^;]+;base64,/, '')
      }
    };

    const result = await model.generateContent([ocrPrompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    console.log('✅ 단일 이미지 OCR 완료');

    res.json({
      success: true,
      text
    });
  } catch (error) {
    console.error('OCR 추출 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== Phase 4: 완전 구현 - 문제/자료 분리 저장 (#8, #15, #16) ====================

/**
 * POST /api/problems/save-complete
 * #8: 문제 텍스트와 자료를 분리하여 저장
 */
app.post('/api/problems/save-complete', upload.array('assets', 10), async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ success: false, error: 'Firebase가 설정되지 않았습니다.' });
    }

    const {
      problemText,        // 문제 텍스트 (LaTeX 포함)
      solution,           // 풀이
      metadata,           // 메타데이터 (JSON string)
      assets,             // 자료 정보 (JSON string) - [{type, description, position}]
      isReference,        // 참조 문제 여부
      isVariation,        // 변형 문제 여부
      originalProblemId,  // 원본 문제 ID (변형인 경우)
      status              // pending, approved, rejected
    } = req.body;

    const parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata || {};
    const parsedAssets = typeof assets === 'string' ? JSON.parse(assets) : assets || [];

    // 1. 문제 저장 (problems 컬렉션)
    const problemData = {
      text: problemText || '',
      solution: solution || '',
      metadata: {
        ...parsedMetadata,
        subject: parsedMetadata.subject || '',
        course: parsedMetadata.course || '',
        grade: parsedMetadata.grade || '',
        chapter: parsedMetadata.chapter || '',
        examType: parsedMetadata.examType || '',
        problemCategory: parsedMetadata.problemCategory || '',
        difficulty: parsedMetadata.difficulty || '중',
        concepts: parsedMetadata.concepts || [],
        tags: parsedMetadata.tags || []
      },
      isReference: isReference === 'true' || isReference === true,
      isVariation: isVariation === 'true' || isVariation === true,
      originalProblemId: originalProblemId || null,
      status: status || 'pending',
      assetIds: [], // 자료 ID들
      ragIndexed: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const problemRef = await db.collection('problems').add(problemData);
    const problemId = problemRef.id;

    // 2. 자료 저장 (problem_assets 컬렉션)
    const savedAssets = [];
    const uploadedFiles = req.files || [];

    for (let i = 0; i < parsedAssets.length; i++) {
      const assetInfo = parsedAssets[i];
      const file = uploadedFiles[i];

      let assetData = {
        problemId,
        type: assetInfo.type || 'image', // image, graph, table, diagram, equation
        description: assetInfo.description || '',
        position: assetInfo.position || { x: 0, y: 0, width: 0, height: 0 },
        order: i,
        labels: assetInfo.labels || [],
        ragIndexed: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };

      // 파일이 업로드된 경우
      if (file) {
        const fileBuffer = await fs.promises.readFile(file.path);
        const base64Data = fileBuffer.toString('base64');
        assetData.fileData = base64Data;
        assetData.mimeType = file.mimetype;
        assetData.fileName = file.originalname;
        await cleanupFile(file.path);
      } else if (assetInfo.base64) {
        // Base64로 전달된 경우
        assetData.fileData = assetInfo.base64;
        assetData.mimeType = assetInfo.mimeType || 'image/png';
      }

      const assetRef = await db.collection('problem_assets').add(assetData);
      savedAssets.push({ id: assetRef.id, ...assetData });
    }

    // 3. 문제에 자료 ID 연결
    await problemRef.update({
      assetIds: savedAssets.map(a => a.id)
    });

    console.log(`✅ 문제 저장 완료: ${problemId}, 자료 ${savedAssets.length}개`);

    res.json({
      success: true,
      problemId,
      assetIds: savedAssets.map(a => a.id),
      message: '문제와 자료가 분리 저장되었습니다.'
    });
  } catch (error) {
    console.error('문제 저장 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/assets/label
 * #15, #16: 문제 자료 라벨링
 */
app.post('/api/assets/label', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ success: false, error: 'Firebase가 설정되지 않았습니다.' });
    }

    const { assetId, labels, autoLabel } = req.body;

    if (!assetId) {
      return res.status(400).json({ success: false, error: '자료 ID가 필요합니다.' });
    }

    const assetRef = db.collection('problem_assets').doc(assetId);
    const assetDoc = await assetRef.get();

    if (!assetDoc.exists) {
      return res.status(404).json({ success: false, error: '자료를 찾을 수 없습니다.' });
    }

    let finalLabels = labels || [];

    // 자동 라벨링 요청인 경우
    if (autoLabel && assetDoc.data().fileData) {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

      const imagePart = {
        inlineData: {
          data: assetDoc.data().fileData,
          mimeType: assetDoc.data().mimeType || 'image/png'
        }
      };

      const labelPrompt = `이 교육용 자료 이미지를 분석하여 다음 정보를 JSON으로 반환하세요:
{
  "type": "graph|table|diagram|equation|figure|map|chart",
  "subject": "교과목 (수학, 물리, 화학 등)",
  "concepts": ["관련 개념1", "관련 개념2"],
  "description": "자료에 대한 상세 설명",
  "dataPoints": "그래프/표의 경우 주요 데이터 포인트",
  "equations": ["포함된 수식들 (LaTeX)"],
  "accessibility": "시각장애인을 위한 대체 텍스트"
}`;

      const result = await model.generateContent([labelPrompt, imagePart]);
      const response = await result.response;
      const text = response.text();

      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const autoLabels = JSON.parse(jsonMatch[0]);
          finalLabels = { ...autoLabels, autoGenerated: true };
        }
      } catch (e) {
        console.warn('자동 라벨 파싱 실패:', e);
      }
    }

    await assetRef.update({
      labels: finalLabels,
      labeledAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      assetId,
      labels: finalLabels,
      message: '자료 라벨링이 완료되었습니다.'
    });
  } catch (error) {
    console.error('자료 라벨링 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/assets/rag-index
 * #15, #16: 문제 자료 RAG 인덱싱
 */
app.post('/api/assets/rag-index', async (req, res) => {
  try {
    const { assetId, assetIds } = req.body;
    const idsToProcess = assetIds || (assetId ? [assetId] : []);

    if (idsToProcess.length === 0) {
      return res.status(400).json({ success: false, error: '자료 ID가 필요합니다.' });
    }

    const agent = getAgent();
    const results = [];

    for (const id of idsToProcess) {
      const assetDoc = await db.collection('problem_assets').doc(id).get();
      if (!assetDoc.exists) continue;

      const assetData = assetDoc.data();

      // 자료 정보를 텍스트로 변환하여 RAG에 저장
      const ragContent = `
[문제 자료]
타입: ${assetData.type || 'unknown'}
설명: ${assetData.description || ''}
관련 개념: ${assetData.labels?.concepts?.join(', ') || ''}
수식: ${assetData.labels?.equations?.join(', ') || ''}
대체 텍스트: ${assetData.labels?.accessibility || ''}
문제 ID: ${assetData.problemId}
`;

      // RAG 인덱싱 (임시 파일로 저장 후 업로드)
      const tempPath = path.join(UPLOAD_DIR, `asset_${id}.txt`);
      await fs.promises.writeFile(tempPath, ragContent);

      try {
        await agent.uploadAndAddToStore(tempPath, `asset_${id}`);
        await cleanupFile(tempPath);

        await db.collection('problem_assets').doc(id).update({
          ragIndexed: true,
          ragIndexedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        results.push({ id, success: true });
      } catch (e) {
        results.push({ id, success: false, error: e.message });
      }
    }

    res.json({
      success: true,
      results,
      message: `${results.filter(r => r.success).length}/${idsToProcess.length} 자료가 RAG 인덱싱되었습니다.`
    });
  } catch (error) {
    console.error('자료 RAG 인덱싱 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Phase 4: 영역 자동 감지 (#4) ====================

/**
 * POST /api/detect-regions-auto
 * #4: AI 기반 문제/자료 영역 자동 감지
 */
app.post('/api/detect-regions-auto', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ success: false, error: '이미지가 필요합니다.' });
    }

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const imagePart = {
      inlineData: {
        data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
        mimeType: mimeType || 'image/png'
      }
    };

    const detectPrompt = `이 시험지/문제집 이미지를 분석하여 각 문제와 자료(그림, 그래프, 표 등)의 영역을 찾아주세요.

다음 JSON 형식으로 반환하세요:
{
  "regions": [
    {
      "id": 1,
      "type": "problem",
      "problemNumber": "1",
      "bounds": {"x": 0.0, "y": 0.0, "width": 0.5, "height": 0.2},
      "hasSubProblems": false,
      "associatedAssets": [2]
    },
    {
      "id": 2,
      "type": "asset",
      "assetType": "graph",
      "bounds": {"x": 0.5, "y": 0.0, "width": 0.4, "height": 0.2},
      "description": "좌표평면 위의 이차함수 그래프",
      "associatedProblem": 1
    }
  ],
  "pageInfo": {
    "orientation": "portrait",
    "columns": 1,
    "estimatedProblems": 5
  }
}

bounds는 이미지 전체 크기에 대한 비율(0~1)로 표시하세요.
모든 문제와 모든 자료(그림, 그래프, 표, 다이어그램 등)를 빠짐없이 찾아주세요.`;

    const result = await model.generateContent([detectPrompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    let detectedRegions = { regions: [], pageInfo: {} };
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        detectedRegions = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn('영역 감지 JSON 파싱 실패:', e);
    }

    res.json({
      success: true,
      ...detectedRegions,
      message: `${detectedRegions.regions?.length || 0}개 영역이 감지되었습니다.`
    });
  } catch (error) {
    console.error('영역 자동 감지 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Phase 4: 다중 문제/페이지 처리 (#2, #3) ====================

/**
 * POST /api/extract-problems-batch
 * #2, #3: 여러 문제가 있는 이미지/PDF에서 개별 문제 추출
 */
app.post('/api/extract-problems-batch', upload.single('file'), async (req, res) => {
  try {
    const { imageBase64, mimeType, pageNumber } = req.body;
    let imageData = imageBase64;
    let imageMime = mimeType || 'image/png';

    // 파일 업로드된 경우
    if (req.file) {
      const filePath = req.file.path;

      // PDF 처리
      if (req.file.mimetype === 'application/pdf') {
        const pdfParse = require('pdf-parse');
        const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

        const dataBuffer = await fs.promises.readFile(filePath);
        const pdf = await pdfjsLib.getDocument({ data: dataBuffer }).promise;
        const totalPages = pdf.numPages;

        // 모든 페이지 또는 특정 페이지 처리
        const pagesToProcess = pageNumber ? [parseInt(pageNumber)] : Array.from({ length: totalPages }, (_, i) => i + 1);
        const allProblems = [];

        for (const pageNum of pagesToProcess) {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 2.0 });

          // Canvas로 렌더링
          const { createCanvas } = require('canvas');
          const canvas = createCanvas(viewport.width, viewport.height);
          const context = canvas.getContext('2d');

          await page.render({ canvasContext: context, viewport }).promise;
          const pageImageBase64 = canvas.toDataURL('image/png').replace(/^data:image\/\w+;base64,/, '');

          // 해당 페이지에서 문제 추출
          const pageProblems = await extractProblemsFromImage(pageImageBase64, 'image/png', pageNum);
          allProblems.push(...pageProblems);
        }

        await cleanupFile(filePath);

        return res.json({
          success: true,
          problems: allProblems,
          totalPages,
          message: `${allProblems.length}개 문제가 추출되었습니다.`
        });
      } else {
        // 이미지 파일
        const fileBuffer = await fs.promises.readFile(filePath);
        imageData = fileBuffer.toString('base64');
        imageMime = req.file.mimetype;
        await cleanupFile(filePath);
      }
    }

    if (!imageData) {
      return res.status(400).json({ success: false, error: '이미지 또는 PDF가 필요합니다.' });
    }

    const problems = await extractProblemsFromImage(imageData, imageMime, 1);

    res.json({
      success: true,
      problems,
      message: `${problems.length}개 문제가 추출되었습니다.`
    });
  } catch (error) {
    console.error('문제 일괄 추출 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 이미지에서 문제 추출 헬퍼 함수
async function extractProblemsFromImage(imageBase64, mimeType, pageNumber) {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

  const imagePart = {
    inlineData: {
      data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
      mimeType: mimeType
    }
  };

  const extractPrompt = `이 시험지/문제집 이미지에서 모든 문제를 추출하세요.

각 문제에 대해 다음 정보를 JSON 배열로 반환하세요:
[
  {
    "problemNumber": "1",
    "text": "문제 전체 텍스트 (LaTeX 수식 포함, $...$로 감싸기)",
    "type": "multiple_choice|short_answer|essay",
    "choices": ["① 선택지1", "② 선택지2", ...],
    "hasAsset": true,
    "assetDescription": "그래프/그림 설명",
    "estimatedDifficulty": "상|중|하",
    "estimatedConcepts": ["관련 개념1", "관련 개념2"],
    "bounds": {"x": 0.0, "y": 0.1, "width": 0.9, "height": 0.15}
  }
]

수식은 반드시 LaTeX 형식으로 $...$ 안에 작성하세요.
bounds는 이미지 전체에 대한 비율(0~1)입니다.`;

  const result = await model.generateContent([extractPrompt, imagePart]);
  const response = await result.response;
  const text = response.text();

  let problems = [];
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      problems = JSON.parse(jsonMatch[0]);
      problems = problems.map((p, idx) => ({
        ...p,
        pageNumber,
        extractedAt: new Date().toISOString(),
        id: `page${pageNumber}_problem${idx + 1}`
      }));
    }
  } catch (e) {
    console.warn('문제 추출 JSON 파싱 실패:', e);
  }

  return problems;
}

// ==================== Phase 4: 엔진 규칙 강화 및 RAG 연동 (#6) ====================

/**
 * POST /api/generate-with-engine
 * #6: RAG + 엔진 규칙 기반 문제 출제
 */
app.post('/api/generate-with-engine', async (req, res) => {
  try {
    const {
      referenceProblem,
      referenceImage,
      metadata,
      variationCount = 3,
      useRag = true,
      engineRuleSet = 'default'
    } = req.body;

    // 1. 엔진 규칙 로드
    const engineRules = getEngineRules(engineRuleSet, metadata);

    // 2. RAG 컨텍스트 가져오기
    let ragContext = '';
    if (useRag && agentInstance) {
      try {
        const query = `${metadata.subject} ${metadata.chapter} 관련 문제 유형과 풀이 패턴`;
        ragContext = await agentInstance.query(query);
      } catch (e) {
        console.warn('RAG 쿼리 실패:', e);
      }
    }

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: { temperature: 0.8, maxOutputTokens: 8192 }
    });

    const parts = [];

    // 참조 이미지가 있는 경우
    if (referenceImage) {
      parts.push({
        inlineData: {
          data: referenceImage.replace(/^data:image\/\w+;base64,/, ''),
          mimeType: 'image/png'
        }
      });
    }

    const generatePrompt = `당신은 수학/과학 문제 출제 전문가입니다.

## 참조 문제
${referenceProblem || '(이미지 참조)'}

## 메타데이터
- 과목: ${metadata.subject || ''} > ${metadata.course || ''}
- 학년: ${metadata.grade || ''}
- 단원: ${metadata.chapter || ''}
- 시험 유형: ${metadata.examType || ''}
- 난이도: ${metadata.difficulty || '중'}

## RAG 참조 자료
${ragContext || '(참조 자료 없음)'}

## 엔진 규칙 (반드시 준수)
${JSON.stringify(engineRules, null, 2)}

## 출제 지시사항
1. 위 참조 문제를 기반으로 ${variationCount}개의 변형 문제를 출제하세요.
2. 엔진 규칙을 반드시 준수하세요:
   - 허용된 수학 개념만 사용
   - 난이도 범위 내에서 출제
   - 금지된 표현/개념 사용 금지
3. 각 문제는 원본과 유사하되 숫자, 조건, 상황을 변경하세요.
4. 수식은 반드시 LaTeX 형식($...$)으로 작성하세요.

## 출력 형식 (JSON)
{
  "variations": [
    {
      "problemNumber": 1,
      "text": "문제 텍스트 (LaTeX 수식 포함)",
      "choices": ["① 선택지1", ...],
      "answer": "정답",
      "solution": "상세 풀이",
      "difficulty": "상|중|하",
      "concepts": ["사용된 개념"],
      "engineCompliance": {
        "passed": true,
        "checkedRules": ["규칙1", "규칙2"],
        "warnings": []
      }
    }
  ],
  "generationInfo": {
    "ragUsed": true,
    "engineRuleSet": "${engineRuleSet}",
    "referenceAnalysis": "참조 문제 분석 요약"
  }
}`;

    parts.push(generatePrompt);

    const result = await model.generateContent(parts);
    const response = await result.response;
    const text = response.text();

    let generatedData = { variations: [], generationInfo: {} };
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        generatedData = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn('생성 결과 파싱 실패:', e);
      generatedData = { variations: [{ text: text }], generationInfo: {} };
    }

    res.json({
      success: true,
      ...generatedData,
      engineRulesApplied: engineRules,
      message: `${generatedData.variations?.length || 0}개 변형 문제가 생성되었습니다.`
    });
  } catch (error) {
    console.error('엔진 기반 문제 생성 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 엔진 규칙 로드 함수
function getEngineRules(ruleSet, metadata) {
  const baseRules = {
    default: {
      name: '기본 규칙',
      mathNotation: {
        required: ['LaTeX 형식 사용', '수식 $...$ 감싸기'],
        forbidden: ['특수문자 직접 사용', '불명확한 기호']
      },
      contentRules: {
        maxChoices: 5,
        minChoices: 4,
        requireDistractors: true,
        requireSolution: true
      }
    },
    math_high: {
      name: '고등 수학 규칙',
      allowedConcepts: {
        '고1': ['다항식', '방정식', '부등식', '함수의 기초', '집합', '명제'],
        '고2': ['함수', '수열', '미분', '적분 기초', '확률', '통계'],
        '고3': ['미적분', '기하', '확률과 통계 심화']
      },
      forbiddenConcepts: {
        '고1': ['미분', '적분', '복소수', '행렬'],
        '고2': ['편미분', '중적분', '미분방정식']
      },
      difficultyConstraints: {
        '하': { maxSteps: 3, maxVariables: 2 },
        '중': { maxSteps: 5, maxVariables: 3 },
        '상': { maxSteps: 8, maxVariables: 4 }
      }
    },
    science_physics: {
      name: '물리학 규칙',
      units: {
        required: true,
        siPreferred: true
      },
      allowedTopics: {
        '물리학I': ['역학', '열', '파동', '전자기'],
        '물리학II': ['역학 심화', '전자기학', '양자역학 기초']
      }
    },
    suneung: {
      name: '수능형 규칙',
      format: {
        problemLength: { min: 50, max: 300 },
        choiceFormat: '①②③④⑤',
        timeLimit: '3분 내 풀이 가능'
      },
      qualityChecks: ['중복 선택지 금지', '명확한 정답 존재', '오답의 합리적 근거']
    }
  };

  // 메타데이터 기반 규칙 선택
  let selectedRules = { ...baseRules.default };

  if (metadata.subject === '수학') {
    selectedRules = { ...selectedRules, ...baseRules.math_high };
  } else if (metadata.subject === '과학' && metadata.course?.includes('물리')) {
    selectedRules = { ...selectedRules, ...baseRules.science_physics };
  }

  if (metadata.examType === '수능') {
    selectedRules = { ...selectedRules, ...baseRules.suneung };
  }

  return selectedRules;
}

// ==================== Phase 4: 엔진 규칙 위반 자동 수정 (#7) ====================

/**
 * POST /api/auto-fix-violations
 * #7: 엔진 규칙 위반 자동 수정
 */
app.post('/api/auto-fix-violations', async (req, res) => {
  try {
    const { problem, violations, metadata } = req.body;

    if (!problem || !violations || violations.length === 0) {
      return res.status(400).json({ success: false, error: '문제와 위반 사항이 필요합니다.' });
    }

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const fixPrompt = `다음 문제에서 발견된 엔진 규칙 위반 사항을 수정해주세요.

## 원본 문제
${problem}

## 메타데이터
${JSON.stringify(metadata, null, 2)}

## 위반 사항
${violations.map((v, i) => `${i + 1}. [${v.severity}] ${v.rule}: ${v.description}`).join('\n')}

## 수정 지시
각 위반 사항을 해결하되, 문제의 본질과 난이도는 유지하세요.

## 출력 형식 (JSON)
{
  "fixedProblem": "수정된 문제 텍스트 (LaTeX 포함)",
  "fixedChoices": ["수정된 선택지"],
  "changes": [
    {
      "violation": "위반 사항",
      "fix": "수정 내용",
      "before": "수정 전",
      "after": "수정 후"
    }
  ],
  "remainingIssues": ["해결되지 않은 문제 (있는 경우)"]
}`;

    const result = await model.generateContent(fixPrompt);
    const response = await result.response;
    const text = response.text();

    let fixResult = { fixedProblem: problem, changes: [] };
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        fixResult = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn('자동 수정 결과 파싱 실패:', e);
    }

    res.json({
      success: true,
      ...fixResult,
      originalViolations: violations,
      message: `${fixResult.changes?.length || 0}개 위반 사항이 수정되었습니다.`
    });
  } catch (error) {
    console.error('자동 수정 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Phase 4: 참조 문제 자동 처리 (#10) ====================

/**
 * POST /api/reference/process-complete
 * #10: 참조 문제 OCR + 라벨링 + RAG화 일괄 처리
 */
app.post('/api/reference/process-complete', upload.single('file'), async (req, res) => {
  try {
    const { imageBase64, mimeType, metadata } = req.body;
    let imageData = imageBase64;
    let imageMime = mimeType || 'image/png';

    // 파일 업로드 처리
    if (req.file) {
      const fileBuffer = await fs.promises.readFile(req.file.path);
      imageData = fileBuffer.toString('base64');
      imageMime = req.file.mimetype;
      await cleanupFile(req.file.path);
    }

    if (!imageData) {
      return res.status(400).json({ success: false, error: '이미지가 필요합니다.' });
    }

    const parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata || {};

    // 1단계: OCR 추출
    console.log('📝 1단계: OCR 추출 시작...');
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const imagePart = {
      inlineData: {
        data: imageData.replace(/^data:image\/\w+;base64,/, ''),
        mimeType: imageMime
      }
    };

    const ocrPrompt = `이 시험 문제 이미지에서 모든 텍스트를 정확하게 추출하세요.
수식은 LaTeX 형식($...$)으로 변환하세요.
선택지가 있으면 ①②③④⑤ 형식으로 정리하세요.

출력 형식:
[문제 번호]
[문제 텍스트]
[선택지 (있는 경우)]`;

    const ocrResult = await model.generateContent([ocrPrompt, imagePart]);
    const ocrText = ocrResult.response.text();

    // 2단계: 자동 라벨링
    console.log('🏷️ 2단계: 자동 라벨링 시작...');
    const labelPrompt = `다음 문제를 분석하여 라벨을 생성하세요:

${ocrText}

출력 형식 (JSON):
{
  "subject": "교과",
  "course": "과목명",
  "chapter": "단원",
  "concepts": ["핵심 개념들"],
  "difficulty": "상|중|하",
  "problemType": "multiple_choice|short_answer|essay",
  "skills": ["필요한 능력"],
  "keywords": ["주요 키워드"],
  "estimatedTime": "예상 풀이 시간 (분)"
}`;

    const labelResult = await model.generateContent(labelPrompt);
    const labelText = labelResult.response.text();

    let autoLabels = {};
    try {
      const jsonMatch = labelText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        autoLabels = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn('라벨 파싱 실패:', e);
    }

    // 3단계: DB 저장
    console.log('💾 3단계: DB 저장...');
    const referenceData = {
      ocrText,
      imageData,
      mimeType: imageMime,
      metadata: { ...parsedMetadata, ...autoLabels },
      autoLabels,
      isReference: true,
      ragIndexed: false,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    let docId = null;
    if (db) {
      const docRef = await db.collection('reference_problems').add(referenceData);
      docId = docRef.id;
    }

    // 4단계: RAG 인덱싱
    console.log('🔍 4단계: RAG 인덱싱...');
    let ragIndexed = false;
    if (agentInstance) {
      try {
        const ragContent = `
[참조 문제]
ID: ${docId || 'local'}
과목: ${autoLabels.subject || parsedMetadata.subject || ''}
단원: ${autoLabels.chapter || parsedMetadata.chapter || ''}
난이도: ${autoLabels.difficulty || '중'}
개념: ${autoLabels.concepts?.join(', ') || ''}

[문제 내용]
${ocrText}
`;
        const tempPath = path.join(UPLOAD_DIR, `ref_${docId || Date.now()}.txt`);
        await fs.promises.writeFile(tempPath, ragContent);
        await agentInstance.uploadAndAddToStore(tempPath, `reference_${docId || Date.now()}`);
        await cleanupFile(tempPath);

        if (db && docId) {
          await db.collection('reference_problems').doc(docId).update({ ragIndexed: true });
        }
        ragIndexed = true;
      } catch (e) {
        console.warn('RAG 인덱싱 실패:', e);
      }
    }

    console.log('✅ 참조 문제 처리 완료:', docId);

    res.json({
      success: true,
      referenceId: docId,
      ocrText,
      autoLabels,
      ragIndexed,
      steps: {
        ocr: true,
        labeling: true,
        saved: !!docId,
        ragIndexed
      },
      message: '참조 문제가 OCR, 라벨링, RAG화되어 저장되었습니다.'
    });
  } catch (error) {
    console.error('참조 문제 처리 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Phase 4: Multi-LLM 검수 (#11) ====================

/**
 * POST /api/review/multi-llm
 * #11: 여러 LLM으로 문제 검수
 */
app.post('/api/review/multi-llm', async (req, res) => {
  try {
    const { problem, solution, metadata, llmList = ['gemini', 'gpt4'] } = req.body;

    if (!problem) {
      return res.status(400).json({ success: false, error: '검수할 문제가 필요합니다.' });
    }

    const reviewPrompt = `당신은 수학/과학 문제 검수 전문가입니다.

## 검수 대상 문제
${problem}

## 풀이
${solution || '(풀이 없음)'}

## 메타데이터
${JSON.stringify(metadata, null, 2)}

## 검수 항목
1. 수학적/과학적 정확성 (오류 여부)
2. 교육과정 적합성 (학년 수준)
3. 문제 완성도 (명확성, 풀이 가능성)
4. 선택지 품질 (오답의 타당성)
5. 난이도 적절성

## 출력 형식 (JSON)
{
  "overallScore": 85,
  "recommendation": "approve|revise|reject",
  "categories": {
    "accuracy": { "score": 90, "comments": "정확함" },
    "curriculum": { "score": 80, "comments": "적합함" },
    "completeness": { "score": 85, "comments": "명확함" },
    "choices": { "score": 75, "comments": "개선 필요" },
    "difficulty": { "score": 90, "comments": "적절함" }
  },
  "issues": [
    { "severity": "error|warning|info", "description": "문제점" }
  ],
  "suggestions": ["개선 제안"],
  "correctAnswer": "정답 확인",
  "solutionCheck": "풀이 검증 결과"
}`;

    const reviews = [];

    // Gemini 검수
    if (llmList.includes('gemini')) {
      try {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

        const result = await model.generateContent(reviewPrompt);
        const text = result.response.text();

        let geminiReview = {};
        try {
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            geminiReview = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          geminiReview = { rawResponse: text };
        }

        reviews.push({ llm: 'gemini', ...geminiReview, timestamp: new Date().toISOString() });
      } catch (e) {
        reviews.push({ llm: 'gemini', error: e.message });
      }
    }

    // GPT-4 검수
    if (llmList.includes('gpt4') && process.env.OPENAI_API_KEY) {
      try {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: reviewPrompt }],
          max_tokens: 2000
        });

        const text = completion.choices[0].message.content;

        let gptReview = {};
        try {
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            gptReview = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          gptReview = { rawResponse: text };
        }

        reviews.push({ llm: 'gpt4', ...gptReview, timestamp: new Date().toISOString() });
      } catch (e) {
        reviews.push({ llm: 'gpt4', error: e.message });
      }
    }

    // 검수 결과 종합
    const validReviews = reviews.filter(r => !r.error && r.overallScore);
    const averageScore = validReviews.length > 0
      ? Math.round(validReviews.reduce((sum, r) => sum + r.overallScore, 0) / validReviews.length)
      : null;

    const consensusRecommendation = validReviews.length > 0
      ? validReviews.every(r => r.recommendation === 'approve') ? 'approve'
        : validReviews.some(r => r.recommendation === 'reject') ? 'reject' : 'revise'
      : 'pending';

    const allIssues = validReviews.flatMap(r => (r.issues || []).map(i => ({ ...i, from: r.llm })));

    res.json({
      success: true,
      reviews,
      summary: {
        averageScore,
        consensusRecommendation,
        allIssues,
        reviewCount: validReviews.length,
        llmsUsed: llmList
      },
      message: `${reviews.length}개 LLM 검수 완료`
    });
  } catch (error) {
    console.error('Multi-LLM 검수 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Phase 4: 변형 문제 자동 처리 (#12, #13) ====================

/**
 * POST /api/variation/process-complete
 * #12, #13: 변형 문제 라벨링 + RAG화 + 승인 파이프라인
 */
app.post('/api/variation/process-complete', async (req, res) => {
  try {
    const {
      variationProblem,
      solution,
      originalProblemId,
      metadata,
      reviewResult,
      autoApprove = false
    } = req.body;

    if (!variationProblem) {
      return res.status(400).json({ success: false, error: '변형 문제가 필요합니다.' });
    }

    const parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata || {};

    // 1단계: 자동 라벨링
    console.log('🏷️ 1단계: 자동 라벨링...');
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const labelPrompt = `다음 문제를 분석하여 상세 라벨을 생성하세요:

${variationProblem}

풀이: ${solution || '(없음)'}

출력 형식 (JSON):
{
  "subject": "교과",
  "course": "과목명",
  "chapter": "단원",
  "subChapter": "소단원",
  "concepts": ["핵심 개념"],
  "skills": ["필요 능력"],
  "difficulty": "상|중|하",
  "difficultyScore": 1-10,
  "problemType": "유형",
  "keywords": ["키워드"],
  "prerequisites": ["선수 지식"],
  "similarProblems": ["유사 문제 유형"]
}`;

    const labelResult = await model.generateContent(labelPrompt);
    const labelText = labelResult.response.text();

    let autoLabels = {};
    try {
      const jsonMatch = labelText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        autoLabels = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn('라벨 파싱 실패:', e);
    }

    // 2단계: 승인 상태 결정
    let status = 'pending';
    if (autoApprove) {
      // 자동 승인 조건: 리뷰 점수 80점 이상
      if (reviewResult && reviewResult.overallScore >= 80) {
        status = 'approved';
      }
    }

    // 3단계: DB 저장
    console.log('💾 2단계: DB 저장...');
    const variationData = {
      text: variationProblem,
      solution: solution || '',
      originalProblemId,
      metadata: { ...parsedMetadata, ...autoLabels },
      autoLabels,
      reviewResult: reviewResult || null,
      status,
      isVariation: true,
      ragIndexed: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    let docId = null;
    if (db) {
      const docRef = await db.collection('variations').add(variationData);
      docId = docRef.id;
    }

    // 4단계: RAG 인덱싱 (승인된 경우만)
    let ragIndexed = false;
    if (status === 'approved' && agentInstance) {
      console.log('🔍 3단계: RAG 인덱싱 (승인됨)...');
      try {
        const ragContent = `
[변형 문제]
ID: ${docId || 'local'}
원본: ${originalProblemId || '없음'}
과목: ${autoLabels.subject || parsedMetadata.subject || ''}
단원: ${autoLabels.chapter || parsedMetadata.chapter || ''}
난이도: ${autoLabels.difficulty || '중'}
개념: ${autoLabels.concepts?.join(', ') || ''}
상태: 승인됨

[문제]
${variationProblem}

[풀이]
${solution || ''}
`;
        const tempPath = path.join(UPLOAD_DIR, `var_${docId || Date.now()}.txt`);
        await fs.promises.writeFile(tempPath, ragContent);
        await agentInstance.uploadAndAddToStore(tempPath, `variation_${docId || Date.now()}`);
        await cleanupFile(tempPath);

        if (db && docId) {
          await db.collection('variations').doc(docId).update({ ragIndexed: true });
        }
        ragIndexed = true;
      } catch (e) {
        console.warn('RAG 인덱싱 실패:', e);
      }
    }

    console.log('✅ 변형 문제 처리 완료:', docId, '(상태:', status, ')');

    res.json({
      success: true,
      variationId: docId,
      autoLabels,
      status,
      ragIndexed,
      steps: {
        labeling: true,
        saved: !!docId,
        approved: status === 'approved',
        ragIndexed
      },
      message: status === 'approved'
        ? '변형 문제가 승인되어 RAG에 인덱싱되었습니다.'
        : '변형 문제가 저장되었습니다. 승인 후 RAG에 인덱싱됩니다.'
    });
  } catch (error) {
    console.error('변형 문제 처리 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/variation/approve
 * 변형 문제 승인 및 RAG 인덱싱
 */
app.post('/api/variation/approve', async (req, res) => {
  try {
    const { variationId, reviewNote } = req.body;

    if (!variationId) {
      return res.status(400).json({ success: false, error: '변형 문제 ID가 필요합니다.' });
    }

    if (!db) {
      return res.status(503).json({ success: false, error: 'Firebase가 설정되지 않았습니다.' });
    }

    const varRef = db.collection('variations').doc(variationId);
    const varDoc = await varRef.get();

    if (!varDoc.exists) {
      return res.status(404).json({ success: false, error: '변형 문제를 찾을 수 없습니다.' });
    }

    const varData = varDoc.data();

    // 상태 업데이트
    await varRef.update({
      status: 'approved',
      reviewNote: reviewNote || '',
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // RAG 인덱싱
    let ragIndexed = false;
    if (agentInstance && !varData.ragIndexed) {
      try {
        const ragContent = `
[승인된 변형 문제]
ID: ${variationId}
과목: ${varData.metadata?.subject || varData.autoLabels?.subject || ''}
단원: ${varData.metadata?.chapter || varData.autoLabels?.chapter || ''}
개념: ${varData.autoLabels?.concepts?.join(', ') || ''}

[문제]
${varData.text}

[풀이]
${varData.solution || ''}
`;
        const tempPath = path.join(UPLOAD_DIR, `approved_${variationId}.txt`);
        await fs.promises.writeFile(tempPath, ragContent);
        await agentInstance.uploadAndAddToStore(tempPath, `approved_${variationId}`);
        await cleanupFile(tempPath);

        await varRef.update({ ragIndexed: true });
        ragIndexed = true;
      } catch (e) {
        console.warn('승인 후 RAG 인덱싱 실패:', e);
      }
    }

    res.json({
      success: true,
      variationId,
      ragIndexed,
      message: '변형 문제가 승인되었습니다.'
    });
  } catch (error) {
    console.error('변형 문제 승인 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Phase 5: 관리 기능 API ====================

/**
 * GET /api/labels
 * 라벨 마스터 데이터 목록 조회
 */
app.get('/api/labels', async (req, res) => {
  try {
    if (!db) {
      // Firebase 없으면 기본 라벨 반환
      return res.json({
        success: true,
        labels: getDefaultLabels()
      });
    }

    const snapshot = await db.collection('labels').orderBy('category').get();
    const labels = [];

    snapshot.forEach(doc => {
      labels.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // 라벨이 없으면 기본 라벨 초기화
    if (labels.length === 0) {
      const defaultLabels = getDefaultLabels();
      for (const label of defaultLabels) {
        const docRef = await db.collection('labels').add(label);
        labels.push({ id: docRef.id, ...label });
      }
    }

    res.json({
      success: true,
      labels,
      count: labels.length
    });
  } catch (error) {
    console.error('라벨 목록 조회 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/labels
 * 새 라벨 추가
 */
app.post('/api/labels', async (req, res) => {
  try {
    const { category, name, parent, metadata } = req.body;

    if (!category || !name) {
      return res.status(400).json({
        success: false,
        error: 'category와 name이 필요합니다.'
      });
    }

    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'Firebase가 설정되지 않았습니다.'
      });
    }

    const labelData = {
      category,
      name,
      parent: parent || null,
      metadata: metadata || {},
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('labels').add(labelData);

    res.json({
      success: true,
      id: docRef.id,
      label: { id: docRef.id, ...labelData },
      message: '라벨이 추가되었습니다.'
    });
  } catch (error) {
    console.error('라벨 추가 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/labels/:id
 * 라벨 수정
 */
app.put('/api/labels/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, parent, metadata } = req.body;

    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'Firebase가 설정되지 않았습니다.'
      });
    }

    const updateData = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (name) updateData.name = name;
    if (parent !== undefined) updateData.parent = parent;
    if (metadata) updateData.metadata = metadata;

    await db.collection('labels').doc(id).update(updateData);

    res.json({
      success: true,
      message: '라벨이 수정되었습니다.'
    });
  } catch (error) {
    console.error('라벨 수정 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/labels/:id
 * 라벨 삭제
 */
app.delete('/api/labels/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'Firebase가 설정되지 않았습니다.'
      });
    }

    await db.collection('labels').doc(id).delete();

    res.json({
      success: true,
      message: '라벨이 삭제되었습니다.'
    });
  } catch (error) {
    console.error('라벨 삭제 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 기본 라벨 데이터 생성
 */
function getDefaultLabels() {
  return [
    // 교과
    { category: 'subject', name: '국어', parent: null, metadata: {} },
    { category: 'subject', name: '영어', parent: null, metadata: {} },
    { category: 'subject', name: '수학', parent: null, metadata: {} },
    { category: 'subject', name: '과학', parent: null, metadata: {} },
    { category: 'subject', name: '사회', parent: null, metadata: {} },
    // 난이도
    { category: 'difficulty', name: '상', parent: null, metadata: { score: 3 } },
    { category: 'difficulty', name: '중', parent: null, metadata: { score: 2 } },
    { category: 'difficulty', name: '하', parent: null, metadata: { score: 1 } },
    // 문제 유형
    { category: 'problemType', name: '객관식', parent: null, metadata: {} },
    { category: 'problemType', name: '주관식', parent: null, metadata: {} },
    { category: 'problemType', name: '서술형', parent: null, metadata: {} },
    // 학년
    { category: 'grade', name: '고등학교 1학년', parent: null, metadata: { level: 10 } },
    { category: 'grade', name: '고등학교 2학년', parent: null, metadata: { level: 11 } },
    { category: 'grade', name: '고등학교 3학년', parent: null, metadata: { level: 12 } },
    { category: 'grade', name: '중학교 1학년', parent: null, metadata: { level: 7 } },
    { category: 'grade', name: '중학교 2학년', parent: null, metadata: { level: 8 } },
    { category: 'grade', name: '중학교 3학년', parent: null, metadata: { level: 9 } }
  ];
}

// ==================== RAG 관리 API ====================

/**
 * GET /api/rag/documents
 * RAG에 인덱싱된 문서 목록 조회
 */
app.get('/api/rag/documents', async (req, res) => {
  try {
    if (!agentInstance) {
      return res.status(400).json({
        success: false,
        error: '먼저 스토어를 초기화하세요.',
        documents: []
      });
    }

    // RAG Agent에서 문서 목록 조회
    const documents = await agentInstance.listDocuments();

    // DB에서 추가 메타데이터 조회
    let enrichedDocs = documents;
    if (db) {
      const ragDocsSnapshot = await db.collection('ragDocuments').get();
      const dbDocs = {};
      ragDocsSnapshot.forEach(doc => {
        dbDocs[doc.id] = doc.data();
      });

      enrichedDocs = documents.map(doc => ({
        ...doc,
        dbMetadata: dbDocs[doc.name] || null
      }));
    }

    res.json({
      success: true,
      documents: enrichedDocs,
      count: enrichedDocs.length,
      storeName: currentStoreName
    });
  } catch (error) {
    console.error('RAG 문서 목록 조회 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/rag/documents/:documentName
 * RAG에서 문서 삭제
 */
app.delete('/api/rag/documents/:documentName', async (req, res) => {
  try {
    const { documentName } = req.params;

    if (!agentInstance) {
      return res.status(400).json({
        success: false,
        error: '먼저 스토어를 초기화하세요.'
      });
    }

    // RAG에서 문서 삭제
    await agentInstance.deleteDocument(documentName);

    // DB에서도 삭제
    if (db) {
      try {
        await db.collection('ragDocuments').doc(documentName).delete();
      } catch (e) {
        // DB 삭제 실패는 무시
      }
    }

    res.json({
      success: true,
      message: 'RAG에서 문서가 삭제되었습니다.'
    });
  } catch (error) {
    console.error('RAG 문서 삭제 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/rag/reindex/:variationId
 * 특정 변형 문제 재인덱싱
 */
app.post('/api/rag/reindex/:variationId', async (req, res) => {
  try {
    const { variationId } = req.params;

    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'Firebase가 설정되지 않았습니다.'
      });
    }

    if (!agentInstance) {
      return res.status(400).json({
        success: false,
        error: '먼저 스토어를 초기화하세요.'
      });
    }

    const varDoc = await db.collection('variations').doc(variationId).get();
    if (!varDoc.exists) {
      return res.status(404).json({
        success: false,
        error: '변형 문제를 찾을 수 없습니다.'
      });
    }

    const varData = varDoc.data();

    // RAG 인덱싱
    const ragContent = `
[변형 문제]
ID: ${variationId}
과목: ${varData.metadata?.subject || varData.autoLabels?.subject || ''}
단원: ${varData.metadata?.chapter || varData.autoLabels?.chapter || ''}
개념: ${varData.autoLabels?.concepts?.join(', ') || ''}
상태: ${varData.status}

[문제]
${varData.text}

[풀이]
${varData.solution || ''}
`;

    const tempPath = path.join(UPLOAD_DIR, `reindex_${variationId}.txt`);
    await fs.promises.writeFile(tempPath, ragContent);
    await agentInstance.uploadAndAddToStore(tempPath, `variation_${variationId}`);
    await cleanupFile(tempPath);

    await db.collection('variations').doc(variationId).update({
      ragIndexed: true,
      ragIndexedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      message: '문제가 RAG에 재인덱싱되었습니다.'
    });
  } catch (error) {
    console.error('RAG 재인덱싱 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 승인 대기 관리 API (확장) ====================

/**
 * GET /api/variations/pending
 * 승인 대기 중인 문제 목록 (상세)
 */
app.get('/api/variations/pending', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'Firebase가 설정되지 않았습니다.'
      });
    }

    const { limit = 50, orderBy = 'createdAt' } = req.query;

    const snapshot = await db.collection('variations')
      .where('status', '==', 'pending')
      .orderBy(orderBy, 'desc')
      .limit(parseInt(limit))
      .get();

    const pendingProblems = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      pendingProblems.push({
        id: doc.id,
        text: data.text,
        textPreview: data.text?.substring(0, 200) + (data.text?.length > 200 ? '...' : ''),
        solution: data.solution,
        metadata: data.metadata,
        autoLabels: data.autoLabels,
        reviewResult: data.reviewResult,
        originalProblemId: data.originalProblemId,
        createdAt: data.createdAt?.toDate?.() || null,
        updatedAt: data.updatedAt?.toDate?.() || null
      });
    });

    res.json({
      success: true,
      problems: pendingProblems,
      count: pendingProblems.length
    });
  } catch (error) {
    console.error('승인 대기 목록 조회 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/variations/batch-approve
 * 여러 문제 일괄 승인
 */
app.post('/api/variations/batch-approve', async (req, res) => {
  try {
    const { variationIds, reviewNote } = req.body;

    if (!variationIds || !Array.isArray(variationIds) || variationIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: '승인할 문제 ID 목록이 필요합니다.'
      });
    }

    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'Firebase가 설정되지 않았습니다.'
      });
    }

    const results = [];
    const batch = db.batch();

    for (const variationId of variationIds) {
      const varRef = db.collection('variations').doc(variationId);
      batch.update(varRef, {
        status: 'approved',
        reviewNote: reviewNote || '일괄 승인',
        approvedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      results.push({ id: variationId, approved: true });
    }

    await batch.commit();

    // RAG 인덱싱 (비동기)
    if (agentInstance) {
      for (const variationId of variationIds) {
        try {
          const varDoc = await db.collection('variations').doc(variationId).get();
          if (varDoc.exists) {
            const varData = varDoc.data();
            const ragContent = `[승인된 문제] ID: ${variationId}\n${varData.text}\n[풀이] ${varData.solution || ''}`;
            const tempPath = path.join(UPLOAD_DIR, `batch_${variationId}.txt`);
            await fs.promises.writeFile(tempPath, ragContent);
            await agentInstance.uploadAndAddToStore(tempPath, `variation_${variationId}`);
            await cleanupFile(tempPath);
            await db.collection('variations').doc(variationId).update({ ragIndexed: true });
          }
        } catch (e) {
          console.warn(`RAG 인덱싱 실패 (${variationId}):`, e);
        }
      }
    }

    res.json({
      success: true,
      results,
      approvedCount: results.length,
      message: `${results.length}개 문제가 승인되었습니다.`
    });
  } catch (error) {
    console.error('일괄 승인 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/variations/batch-reject
 * 여러 문제 일괄 거절
 */
app.post('/api/variations/batch-reject', async (req, res) => {
  try {
    const { variationIds, reviewNote } = req.body;

    if (!variationIds || !Array.isArray(variationIds) || variationIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: '거절할 문제 ID 목록이 필요합니다.'
      });
    }

    if (!db) {
      return res.status(503).json({
        success: false,
        error: 'Firebase가 설정되지 않았습니다.'
      });
    }

    const batch = db.batch();

    for (const variationId of variationIds) {
      const varRef = db.collection('variations').doc(variationId);
      batch.update(varRef, {
        status: 'rejected',
        reviewNote: reviewNote || '일괄 거절',
        rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    await batch.commit();

    res.json({
      success: true,
      rejectedCount: variationIds.length,
      message: `${variationIds.length}개 문제가 거절되었습니다.`
    });
  } catch (error) {
    console.error('일괄 거절 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/variations/stats
 * 문제 통계 조회
 */
app.get('/api/variations/stats', async (req, res) => {
  try {
    if (!db) {
      return res.json({
        success: true,
        stats: { pending: 0, approved: 0, rejected: 0, total: 0, ragIndexed: 0 }
      });
    }

    const collection = db.collection('variations');

    const [pendingSnap, approvedSnap, rejectedSnap, ragIndexedSnap] = await Promise.all([
      collection.where('status', '==', 'pending').count().get(),
      collection.where('status', '==', 'approved').count().get(),
      collection.where('status', '==', 'rejected').count().get(),
      collection.where('ragIndexed', '==', true).count().get()
    ]);

    const stats = {
      pending: pendingSnap.data().count,
      approved: approvedSnap.data().count,
      rejected: rejectedSnap.data().count,
      ragIndexed: ragIndexedSnap.data().count,
      total: pendingSnap.data().count + approvedSnap.data().count + rejectedSnap.data().count
    };

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('통계 조회 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 커스텀 엔진 관리 API ====================

/**
 * GET /api/engines
 * 저장된 커스텀 엔진 목록 조회
 */
app.get('/api/engines', async (req, res) => {
  try {
    if (!db) {
      return res.json({
        success: true,
        engines: [],
        message: 'Firebase가 설정되지 않았습니다.'
      });
    }

    const snapshot = await db.collection('engines')
      .orderBy('createdAt', 'desc')
      .get();

    const engines = [];
    snapshot.forEach(doc => {
      engines.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json({
      success: true,
      engines,
      count: engines.length
    });
  } catch (error) {
    console.error('엔진 목록 조회 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/engines/folders
 * 업로드 가능한 엔진 폴더 목록 반환
 * NOTE: 이 라우트는 /api/engines/:id 보다 먼저 정의되어야 함
 */
app.get('/api/engines/folders', (req, res) => {
  const folders = [
    { value: 'core', label: '🔧 core (핵심 엔진)', accepts: '.md' },
    { value: 'plugins/no_asset', label: '📁 plugins/no_asset', accepts: '.py' },
    { value: 'plugins/diagram_2d', label: '📁 plugins/diagram_2d (2D 다이어그램)', accepts: '.py' },
    { value: 'plugins/geometry_2d', label: '📁 plugins/geometry_2d (2D 기하학)', accepts: '.py' },
    { value: 'plugins/graph_2d', label: '📁 plugins/graph_2d (2D 그래프)', accepts: '.py' },
    { value: 'plugins/numberline_1d', label: '📁 plugins/numberline_1d (1D 수직선)', accepts: '.py' },
    { value: 'plugins/table', label: '📁 plugins/table (표, 행렬)', accepts: '.py' },
    { value: 'plugins/chart_stat', label: '📁 plugins/chart_stat (차트, 통계)', accepts: '.py' },
    { value: 'plugins/tree_graph', label: '📁 plugins/tree_graph (트리, 그래프)', accepts: '.py' },
    { value: 'plugins/network_flow', label: '📁 plugins/network_flow (네트워크 흐름)', accepts: '.py' },
    { value: 'plugins/solid_3d', label: '📁 plugins/solid_3d (3D 입체도형)', accepts: '.py' },
    { value: 'plugins/net_unfold', label: '📁 plugins/net_unfold (전개도)', accepts: '.py' },
    { value: 'plugins/coordinate_3d', label: '📁 plugins/coordinate_3d (3D 좌표)', accepts: '.py' },
    { value: 'plugins/mixed', label: '📁 plugins/mixed (복합/혼합)', accepts: '.py' }
  ];
  res.json({ success: true, folders });
});

/**
 * GET /api/engines/files
 * 실제 엔진 폴더 스캔하여 파일 목록 반환
 * NOTE: 이 라우트는 /api/engines/:id 보다 먼저 정의되어야 함
 */
app.get('/api/engines/files', async (req, res) => {
  try {
    const ENGINES_DIR = path.join(__dirname, 'public', 'engines');
    const result = { core: {}, plugin: {} };
    const coreDir = path.join(ENGINES_DIR, 'core');
    if (fs.existsSync(coreDir)) {
      const coreFiles = await fs.promises.readdir(coreDir);
      result.core['핵심 엔진'] = coreFiles.filter(f => f.endsWith('.md') || (f.endsWith('.py') && f !== '__init__.py'));
    }
    const pluginsDir = path.join(ENGINES_DIR, 'plugins');
    if (fs.existsSync(pluginsDir)) {
      const pluginCategories = await fs.promises.readdir(pluginsDir);
      for (const category of pluginCategories) {
        const categoryPath = path.join(pluginsDir, category);
        const stat = await fs.promises.stat(categoryPath);
        if (stat.isDirectory()) {
          const files = await fs.promises.readdir(categoryPath);
          result.plugin[category] = files.filter(f => f.endsWith('.py') && f !== '__init__.py');
        }
      }
    }
    res.json({ success: true, engines: result });
  } catch (error) {
    console.error('엔진 파일 스캔 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/engines/file-content
 * 엔진 파일 내용 읽기
 * NOTE: 이 라우트는 /api/engines/:id 보다 먼저 정의되어야 함
 */
app.get('/api/engines/file-content', async (req, res) => {
  try {
    const { folder, filename } = req.query;

    if (!folder || !filename) {
      return res.status(400).json({ success: false, error: '폴더와 파일명이 필요합니다.' });
    }

    // 보안: 경로 탐색 공격 방지
    const safeFolderName = path.basename(folder);
    const safeFileName = path.basename(filename);

    const ENGINES_DIR = path.join(__dirname, 'public', 'engines');
    let filePath;

    if (folder === 'core' || safeFolderName === 'core') {
      filePath = path.join(ENGINES_DIR, 'core', safeFileName);
    } else {
      // plugins 폴더
      filePath = path.join(ENGINES_DIR, 'plugins', safeFolderName, safeFileName);
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: '파일을 찾을 수 없습니다.' });
    }

    const content = await fs.promises.readFile(filePath, 'utf-8');
    res.json({ success: true, content, filename: safeFileName, folder });
  } catch (error) {
    console.error('엔진 파일 읽기 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/engines/run
 * Python 엔진 실행 및 이미지 생성
 * NOTE: 이 라우트는 /api/engines/:id 보다 먼저 정의되어야 함
 */
app.post('/api/engines/run', async (req, res) => {
  try {
    const { folder, filename, params } = req.body;

    if (!folder || !filename) {
      return res.status(400).json({ success: false, error: '폴더와 파일명이 필요합니다.' });
    }

    // 보안: 경로 탐색 공격 방지
    const safeFolderName = path.basename(folder);
    const safeFileName = path.basename(filename);

    // 엔진 경로 구성
    const ENGINES_DIR = path.join(__dirname, 'public', 'engines');
    let engineRelativePath;

    if (folder === 'core' || safeFolderName === 'core') {
      engineRelativePath = `core/${safeFileName}`;
    } else {
      engineRelativePath = `plugins/${safeFolderName}/${safeFileName}`;
    }

    const fullEnginePath = path.join(ENGINES_DIR, engineRelativePath.replace(/\//g, path.sep));
    if (!fs.existsSync(fullEnginePath)) {
      return res.status(404).json({ success: false, error: '엔진 파일을 찾을 수 없습니다.' });
    }

    // Python 실행 래퍼 경로
    const runnerPath = path.join(ENGINES_DIR, 'engine_runner.py');
    if (!fs.existsSync(runnerPath)) {
      return res.status(500).json({ success: false, error: 'engine_runner.py가 없습니다.' });
    }

    // 출력 디렉토리
    const outputDir = path.join(ENGINES_DIR, 'output', `run_${Date.now()}`);

    // Python 명령어 구성
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const args = [
      runnerPath,
      '--engine', engineRelativePath,
      '--output', outputDir
    ];

    if (params) {
      args.push('--params', JSON.stringify(params));
    }

    console.log(`🐍 Python 엔진 실행: ${pythonCmd} ${args.join(' ')}`);

    // child_process로 Python 실행
    const { spawn } = require('child_process');

    const pythonProcess = spawn(pythonCmd, args, {
      cwd: ENGINES_DIR,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      console.log(`🐍 Python 종료 코드: ${code}`);
      if (stderr) {
        console.log(`🐍 Python stderr: ${stderr}`);
      }

      try {
        // JSON 결과 파싱
        const result = JSON.parse(stdout);

        if (result.success) {
          res.json({
            success: true,
            png_base64: result.png_base64,
            svg_base64: result.svg_base64,
            png_path: result.png_path,
            svg_path: result.svg_path,
            engine: safeFileName,
            folder: safeFolderName
          });
        } else {
          res.status(500).json({
            success: false,
            error: result.error || 'Python 엔진 실행 실패',
            stderr: stderr
          });
        }
      } catch (parseError) {
        console.error('Python 출력 파싱 오류:', parseError);
        console.error('stdout:', stdout);
        res.status(500).json({
          success: false,
          error: `Python 출력 파싱 오류: ${parseError.message}`,
          stdout: stdout,
          stderr: stderr
        });
      }
    });

    pythonProcess.on('error', (err) => {
      console.error('Python 프로세스 오류:', err);
      res.status(500).json({
        success: false,
        error: `Python 실행 오류: ${err.message}. Python이 설치되어 있는지 확인하세요.`
      });
    });

  } catch (error) {
    console.error('엔진 실행 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/engines/file
 * 엔진 파일 삭제
 * NOTE: 이 라우트는 /api/engines/:id 보다 먼저 정의되어야 함
 */
app.delete('/api/engines/file', async (req, res) => {
  try {
    const { folder, filename } = req.body;

    if (!folder || !filename) {
      return res.status(400).json({ success: false, error: '폴더와 파일명이 필요합니다.' });
    }

    // 보안: 경로 탐색 공격 방지
    const safeFolderName = path.basename(folder);
    const safeFileName = path.basename(filename);

    // 허용된 폴더만 삭제 가능
    const ALLOWED_FOLDERS = [
      'core', 'no_asset', 'diagram_2d', 'geometry_2d',
      'graph_2d', 'numberline_1d', 'table', 'chart_stat',
      'tree_graph', 'network_flow', 'solid_3d',
      'net_unfold', 'coordinate_3d', 'mixed'
    ];

    if (!ALLOWED_FOLDERS.includes(safeFolderName)) {
      return res.status(400).json({ success: false, error: '유효하지 않은 폴더입니다.' });
    }

    const ENGINES_DIR = path.join(__dirname, 'public', 'engines');
    let filePath;

    if (safeFolderName === 'core') {
      filePath = path.join(ENGINES_DIR, 'core', safeFileName);
    } else {
      filePath = path.join(ENGINES_DIR, 'plugins', safeFolderName, safeFileName);
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: '파일을 찾을 수 없습니다.' });
    }

    await fs.promises.unlink(filePath);
    console.log('🗑️ 엔진 파일 삭제: ' + folder + '/' + safeFileName);
    res.json({ success: true, message: '파일이 삭제되었습니다.', deletedFile: safeFileName });
  } catch (error) {
    console.error('엔진 파일 삭제 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/engines/:id
 * 특정 엔진 상세 조회
 */
app.get('/api/engines/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!db) {
      return res.status(400).json({
        success: false,
        error: 'Firebase가 설정되지 않았습니다.'
      });
    }

    const doc = await db.collection('engines').doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: '엔진을 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      engine: {
        id: doc.id,
        ...doc.data()
      }
    });
  } catch (error) {
    console.error('엔진 조회 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/engines
 * 새 커스텀 엔진 저장
 */
app.post('/api/engines', async (req, res) => {
  try {
    const {
      name,
      description,
      promptRules,
      pythonCode,
      subject,
      chapter,
      version = '1.0.0',
      tags = []
    } = req.body;

    if (!name || !promptRules) {
      return res.status(400).json({
        success: false,
        error: '엔진 이름과 프롬프트 규칙은 필수입니다.'
      });
    }

    if (!db) {
      return res.status(400).json({
        success: false,
        error: 'Firebase가 설정되지 않았습니다.'
      });
    }

    const engineData = {
      name,
      description: description || '',
      promptRules,
      pythonCode: pythonCode || '',
      subject: subject || '',
      chapter: chapter || '',
      version,
      tags,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      usageCount: 0
    };

    const docRef = await db.collection('engines').add(engineData);

    console.log(`✅ 새 엔진 저장됨: ${name} (ID: ${docRef.id})`);

    res.json({
      success: true,
      engine: {
        id: docRef.id,
        ...engineData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      message: '엔진이 성공적으로 저장되었습니다.'
    });
  } catch (error) {
    console.error('엔진 저장 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/engines/:id
 * 엔진 수정
 */
app.put('/api/engines/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      promptRules,
      pythonCode,
      subject,
      chapter,
      version,
      tags
    } = req.body;

    if (!db) {
      return res.status(400).json({
        success: false,
        error: 'Firebase가 설정되지 않았습니다.'
      });
    }

    const docRef = db.collection('engines').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: '엔진을 찾을 수 없습니다.'
      });
    }

    const updateData = {
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(promptRules && { promptRules }),
      ...(pythonCode !== undefined && { pythonCode }),
      ...(subject !== undefined && { subject }),
      ...(chapter !== undefined && { chapter }),
      ...(version && { version }),
      ...(tags && { tags }),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await docRef.update(updateData);

    console.log(`✅ 엔진 수정됨: ${id}`);

    res.json({
      success: true,
      message: '엔진이 수정되었습니다.'
    });
  } catch (error) {
    console.error('엔진 수정 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/engines/:id
 * 엔진 삭제
 */
app.delete('/api/engines/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!db) {
      return res.status(400).json({
        success: false,
        error: 'Firebase가 설정되지 않았습니다.'
      });
    }

    const docRef = db.collection('engines').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: '엔진을 찾을 수 없습니다.'
      });
    }

    await docRef.delete();

    console.log(`🗑️ 엔진 삭제됨: ${id}`);

    res.json({
      success: true,
      message: '엔진이 삭제되었습니다.'
    });
  } catch (error) {
    console.error('엔진 삭제 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/engines/:id/generate
 * 특정 커스텀 엔진을 사용하여 문제 생성
 */
app.post('/api/engines/:id/generate', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      referenceImage,
      referenceProblem,
      metadata = {},
      variationCount = 3,
      additionalInstructions = ''
    } = req.body;

    if (!db) {
      return res.status(400).json({
        success: false,
        error: 'Firebase가 설정되지 않았습니다.'
      });
    }

    // 엔진 조회
    const doc = await db.collection('engines').doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: '엔진을 찾을 수 없습니다.'
      });
    }

    const engine = doc.data();
    console.log(`⚙️ 커스텀 엔진으로 문제 생성: ${engine.name}`);

    // 사용 횟수 증가
    await db.collection('engines').doc(id).update({
      usageCount: admin.firestore.FieldValue.increment(1),
      lastUsedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Gemini API로 문제 생성
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: { temperature: 0.7, maxOutputTokens: 16384 }
    });

    const parts = [];

    // 참조 이미지가 있는 경우
    if (referenceImage) {
      const base64Data = referenceImage.replace(/^data:image\/\w+;base64,/, '');
      parts.push({
        inlineData: {
          data: base64Data,
          mimeType: 'image/png'
        }
      });
    }

    // 엔진 프롬프트 규칙을 적용한 생성 프롬프트 구성
    const generatePrompt = `# 커스텀 엔진 기반 문제 생성

## 엔진 정보
- 엔진 이름: ${engine.name}
- 버전: ${engine.version}
- 설명: ${engine.description || '없음'}

## 엔진 프롬프트 규칙 (반드시 준수)
${engine.promptRules}

${engine.pythonCode ? `## 검증 코드 참조 (이 로직을 이해하고 준수)
\`\`\`python
${engine.pythonCode}
\`\`\`` : ''}

## 참조 문제
${referenceProblem || '(이미지 참조)'}

## 메타데이터
- 과목: ${metadata.subject || engine.subject || ''}
- 단원: ${metadata.chapter || engine.chapter || ''}
- 학년: ${metadata.grade || ''}
- 시험 유형: ${metadata.examType || ''}
- 문제 유형: ${metadata.problemType || ''}

## 생성 지시사항
1. 위 엔진 규칙을 **반드시** 준수하여 ${variationCount}개의 변형 문제를 생성하세요.
2. 참조 문제와 유사하지만 숫자, 조건, 상황을 적절히 변경하세요.
3. 수식은 LaTeX 형식($...$)으로 작성하세요.
${additionalInstructions ? `4. 추가 지시: ${additionalInstructions}` : ''}

## 출력 형식 (JSON)
\`\`\`json
{
  "variations": [
    {
      "problemNumber": 1,
      "text": "문제 텍스트 (LaTeX 수식 포함)",
      "choices": ["① 선택지1", "② 선택지2", ...],
      "answer": "정답",
      "solution": "상세 풀이",
      "difficulty": "상|중|하",
      "engineCompliance": {
        "passed": true,
        "appliedRules": ["적용된 규칙들"],
        "notes": "특이사항"
      }
    }
  ],
  "generationInfo": {
    "engineId": "${id}",
    "engineName": "${engine.name}",
    "engineVersion": "${engine.version}",
    "referenceAnalysis": "참조 문제 분석 요약"
  }
}
\`\`\``;

    parts.push(generatePrompt);

    const result = await model.generateContent(parts);
    const response = await result.response;
    const text = response.text();

    // JSON 파싱
    let generatedData = { variations: [], generationInfo: {} };
    try {
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        generatedData = JSON.parse(jsonStr);
      }
    } catch (e) {
      console.warn('생성 결과 파싱 실패:', e);
      generatedData = {
        variations: [{ text: text, problemNumber: 1 }],
        generationInfo: { engineId: id, engineName: engine.name }
      };
    }

    console.log(`✅ 커스텀 엔진 문제 생성 완료: ${generatedData.variations?.length || 0}개`);

    res.json({
      success: true,
      ...generatedData,
      engine: {
        id: id,
        name: engine.name,
        version: engine.version
      },
      message: `${engine.name} 엔진으로 ${generatedData.variations?.length || 0}개 문제가 생성되었습니다.`
    });
  } catch (error) {
    console.error('커스텀 엔진 문제 생성 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/engines/import
 * docx 파일에서 엔진 가져오기
 */
app.post('/api/engines/import', upload.single('engineFile'), async (req, res) => {
  let filePath = null;
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '엔진 파일이 필요합니다.'
      });
    }

    filePath = req.file.path;
    const { name, subject, chapter } = req.body;

    // docx 파일 읽기 (텍스트 추출)
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    const content = result.value;

    // 파일 정리
    await cleanupFile(filePath);

    if (!db) {
      return res.status(400).json({
        success: false,
        error: 'Firebase가 설정되지 않았습니다.'
      });
    }

    // 엔진 저장
    const engineData = {
      name: name || req.file.originalname.replace(/\.[^/.]+$/, ''),
      description: `${req.file.originalname}에서 가져온 엔진`,
      promptRules: content,
      pythonCode: '', // docx에서 Python 코드 분리는 별도 처리 필요
      subject: subject || '',
      chapter: chapter || '',
      version: '1.0.0',
      tags: ['imported'],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      usageCount: 0,
      sourceFile: req.file.originalname
    };

    const docRef = await db.collection('engines').add(engineData);

    console.log(`✅ 엔진 가져오기 완료: ${engineData.name} (ID: ${docRef.id})`);

    res.json({
      success: true,
      engine: {
        id: docRef.id,
        ...engineData
      },
      message: '엔진이 성공적으로 가져와졌습니다.'
    });
  } catch (error) {
    if (filePath) await cleanupFile(filePath);
    console.error('엔진 가져오기 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/engines/upload-file
 * 로컬 엔진 파일(.md, .py)을 특정 폴더에 업로드
 */
app.post('/api/engines/upload-file', upload.single('engineFile'), async (req, res) => {
  let filePath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '엔진 파일이 필요합니다.' });
    }
    filePath = req.file.path;
    const { targetFolder } = req.body;
    const ALLOWED_FOLDERS = [
      'core', 'plugins/no_asset', 'plugins/diagram_2d', 'plugins/geometry_2d',
      'plugins/graph_2d', 'plugins/numberline_1d', 'plugins/table', 'plugins/chart_stat',
      'plugins/tree_graph', 'plugins/network_flow', 'plugins/solid_3d',
      'plugins/net_unfold', 'plugins/coordinate_3d', 'plugins/mixed'
    ];
    if (!targetFolder || !ALLOWED_FOLDERS.includes(targetFolder)) {
      await cleanupFile(filePath);
      return res.status(400).json({ success: false, error: '유효하지 않은 대상 폴더입니다.', allowedFolders: ALLOWED_FOLDERS });
    }
    const originalName = req.file.originalname;
    const ext = path.extname(originalName).toLowerCase();
    if (targetFolder === 'core' && ext !== '.py') {
      await cleanupFile(filePath);
      return res.status(400).json({ success: false, error: 'core 폴더에는 .py 파일만 업로드 가능합니다.' });
    }
    if (targetFolder.startsWith('plugins/') && ext !== '.py') {
      await cleanupFile(filePath);
      return res.status(400).json({ success: false, error: 'plugins 폴더에는 .py 파일만 업로드 가능합니다.' });
    }
    const baseName = path.basename(originalName);
    if (baseName.includes('..') || baseName.includes('/') || baseName.includes(String.fromCharCode(92))) {
      await cleanupFile(filePath);
      return res.status(400).json({ success: false, error: '파일명에 허용되지 않은 문자가 포함되어 있습니다.' });
    }
    const ENGINES_DIR = path.join(__dirname, 'public', 'engines');
    const destDir = path.join(ENGINES_DIR, targetFolder);
    const destPath = path.join(destDir, baseName);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    const overwrite = req.body.overwrite === 'true';
    if (fs.existsSync(destPath) && !overwrite) {
      await cleanupFile(filePath);
      return res.status(409).json({ success: false, error: '동일한 이름의 파일이 이미 존재합니다.', existingFile: baseName });
    }
    await fs.promises.copyFile(filePath, destPath);
    await cleanupFile(filePath);
    console.log('📤 엔진 파일 업로드: ' + targetFolder + '/' + baseName);
    res.json({ success: true, message: '엔진 파일이 업로드되었습니다.', file: { name: baseName, folder: targetFolder, path: '/engines/' + targetFolder + '/' + baseName } });
  } catch (error) {
    if (filePath) await cleanupFile(filePath);
    console.error('엔진 파일 업로드 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 에러 핸들링 미들웨어
app.use((err, req, res, next) => {
  console.error('서버 오류:', err);

  // 프로덕션 환경에서는 상세 에러 메시지 숨김 (API 키, 경로 등 노출 방지)
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const safeErrorMessage = isDevelopment
    ? err.message
    : '서버 내부 오류가 발생했습니다.';

  res.status(err.statusCode || 500).json({
    success: false,
    error: safeErrorMessage
  });
});

// 서버 시작


/**
 * POST /api/rag/chunks/search
 * RAG 청크 검색 (유사도 기반)
 */
app.post('/api/rag/chunks/search', async (req, res) => {
  try {
    const { query, limit = 50 } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: '검색어를 입력해주세요.'
      });
    }

    if (!agentInstance) {
      return res.status(400).json({
        success: false,
        error: '먼저 스토어를 초기화하세요.'
      });
    }

    const storeName = currentStoreName;

    if (!storeName) {
      return res.status(400).json({
        success: false,
        error: '활성화된 스토어가 없습니다.'
      });
    }

    // @google/genai SDK를 사용하여 File Search
    const { GoogleGenAI } = require('@google/genai');
    const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // File Search Tool을 사용하여 검색
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [{ text: `다음 검색어와 관련된 문서 내용을 찾아주세요: "${query}"\n\n관련 내용이 있다면 해당 부분을 인용해주세요.` }]
      }],
      config: {
        tools: [{
          fileSearch: {
            fileSearchStoreNames: [storeName]
          }
        }]
      }
    });

    const chunks = [];

    if (response.candidates && response.candidates[0]) {
      const candidate = response.candidates[0];

      if (candidate.groundingMetadata && candidate.groundingMetadata.groundingChunks) {
        candidate.groundingMetadata.groundingChunks.forEach((chunk, index) => {
          chunks.push({
            id: `chunk_${index}`,
            content: chunk.retrievedContext?.text || chunk.web?.title || '',
            source: chunk.retrievedContext?.uri || chunk.web?.uri || '',
            score: 1 - (index * 0.1),
            createdAt: new Date().toISOString()
          });
        });
      }

      if (candidate.content && candidate.content.parts && chunks.length === 0) {
        const responseText = candidate.content.parts.map(p => p.text).join('');
        if (responseText) {
          chunks.push({
            id: 'response_chunk',
            content: responseText,
            source: 'AI 검색 결과',
            score: 1,
            createdAt: new Date().toISOString()
          });
        }
      }
    }

    res.json({
      success: true,
      chunks: chunks.slice(0, limit),
      totalCount: chunks.length,
      query: query
    });

  } catch (error) {
    console.error('청크 검색 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== 파일 기반 엔진 시스템 API ====================

// fs.promises 사용 (fs는 이미 상단에 선언됨)
const fsPromises = fs.promises;

/**
 * GET /api/file-engines
 * 파일 기반 엔진 목록 조회
 */
app.get('/api/file-engines', async (req, res) => {
  try {
    const enginesPath = path.join(__dirname, 'public', 'engines');
    const categories = ['core', 'styles', 'templates'];
    const engines = {};

    for (const category of categories) {
      const categoryPath = path.join(enginesPath, category);
      try {
        const files = await fsPromises.readdir(categoryPath);
        engines[category] = files
          .filter(f => f.endsWith('.md'))
          .map(f => ({
            id: f.replace('.md', ''),
            name: f.replace('.md', '').replace(/_/g, ' '),
            file: f,
            category
          }));
      } catch (err) {
        engines[category] = [];
      }
    }

    // index.md 파일 존재 확인
    let indexContent = null;
    try {
      indexContent = await fsPromises.readFile(path.join(enginesPath, 'index.md'), 'utf-8');
    } catch (err) {
      indexContent = null;
    }

    res.json({
      success: true,
      engines,
      hasIndex: !!indexContent,
      totalCount: Object.values(engines).reduce((sum, arr) => sum + arr.length, 0)
    });
  } catch (error) {
    console.error('파일 엔진 목록 조회 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/file-engines/:category/:id
 * 특정 파일 기반 엔진 로드
 */
app.get('/api/file-engines/:category/:id', async (req, res) => {
  try {
    const { category, id } = req.params;
    const validCategories = ['core', 'styles', 'templates'];

    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        error: '유효하지 않은 카테고리입니다. (core, styles, templates)'
      });
    }

    const filePath = path.join(__dirname, 'public', 'engines', category, `${id}.md`);

    try {
      const content = await fsPromises.readFile(filePath, 'utf-8');

      // 마크다운에서 메타데이터 추출
      const metadata = parseEngineMetadata(content);

      res.json({
        success: true,
        engine: {
          id,
          category,
          content,
          metadata,
          filePath: `/engines/${category}/${id}.md`
        }
      });
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({
          success: false,
          error: `엔진을 찾을 수 없습니다: ${category}/${id}`
        });
      }
      throw err;
    }
  } catch (error) {
    console.error('파일 엔진 로드 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 엔진 마크다운에서 메타데이터 추출
 */
function parseEngineMetadata(content) {
  const metadata = {
    title: '',
    id: '',
    version: '',
    description: '',
    ragPatterns: [],
    rules: []
  };

  // 제목 추출 (첫 번째 # 헤딩)
  const titleMatch = content.match(/^#\s+(.+?)(?:\s*\(|$)/m);
  if (titleMatch) {
    metadata.title = titleMatch[1].trim();
  }

  // 엔진 정보 테이블에서 ID, 버전 추출
  const idMatch = content.match(/\*\*ID\*\*\s*\|\s*`([^`]+)`/);
  if (idMatch) {
    metadata.id = idMatch[1];
  }

  const versionMatch = content.match(/\*\*버전\*\*\s*\|\s*([^\n|]+)/);
  if (versionMatch) {
    metadata.version = versionMatch[1].trim();
  }

  // RAG 검색 쿼리 패턴 추출
  const ragSection = content.match(/## RAG 검색 쿼리 패턴[\s\S]*?(?=##|$)/);
  if (ragSection) {
    const patternMatches = ragSection[0].matchAll(/"([^"]+)"/g);
    for (const match of patternMatches) {
      if (!metadata.ragPatterns.includes(match[1])) {
        metadata.ragPatterns.push(match[1]);
      }
    }
  }

  // 규칙 섹션 추출
  const rulesSection = content.match(/## 문제 생성 규칙[\s\S]*?(?=##|$)/);
  if (rulesSection) {
    metadata.hasRules = true;
  }

  return metadata;
}

/**
 * POST /api/generate-with-file-engine
 * 파일 기반 엔진 + RAG를 사용한 문제 생성
 */
app.post('/api/generate-with-file-engine', async (req, res) => {
  try {
    const {
      engineId,
      engineCategory = 'core',
      templateId = 'multiple_choice',
      styleId = 'exam_style',
      subject,
      chapter,
      difficulty = '중',
      problemCount = 3,
      ragQuery,
      additionalInstructions = '',
      referenceImage,
      referenceProblem
    } = req.body;

    if (!engineId) {
      return res.status(400).json({
        success: false,
        error: '엔진 ID는 필수입니다.'
      });
    }

    console.log(`🔧 파일 기반 엔진으로 문제 생성: ${engineCategory}/${engineId}`);

    // 1. 엔진 파일 로드
    const enginePath = path.join(__dirname, 'public', 'engines', engineCategory, `${engineId}.md`);
    let engineContent;
    try {
      engineContent = await fsPromises.readFile(enginePath, 'utf-8');
    } catch (err) {
      return res.status(404).json({
        success: false,
        error: `엔진을 찾을 수 없습니다: ${engineCategory}/${engineId}`
      });
    }

    // 2. 템플릿 로드
    let templateContent = '';
    try {
      const templatePath = path.join(__dirname, 'public', 'engines', 'templates', `${templateId}.md`);
      templateContent = await fsPromises.readFile(templatePath, 'utf-8');
    } catch (err) {
      console.log(`템플릿 ${templateId} 로드 실패, 기본 형식 사용`);
    }

    // 3. 스타일 로드
    let styleContent = '';
    try {
      const stylePath = path.join(__dirname, 'public', 'engines', 'styles', `${styleId}.md`);
      styleContent = await fsPromises.readFile(stylePath, 'utf-8');
    } catch (err) {
      console.log(`스타일 ${styleId} 로드 실패, 기본 형식 사용`);
    }

    // 4. RAG 검색 (agent가 있는 경우)
    let ragContext = '';
    if (ragQuery && agent) {
      try {
        const ragResult = await agent.query(ragQuery);
        ragContext = ragResult.answer || '';
        console.log(`📚 RAG 검색 완료: ${ragQuery.substring(0, 50)}...`);
      } catch (err) {
        console.log('RAG 검색 실패:', err.message);
      }
    }

    // 5. 프롬프트 구성
    const systemPrompt = `당신은 전문 문제 출제자입니다.

## 사용 엔진
${engineContent}

## 출력 템플릿
${templateContent || '표준 JSON 형식으로 출력'}

## 출력 스타일
${styleContent || '시험지 형식'}

## RAG 참조 자료
${ragContext || '(참조 자료 없음)'}

## 출제 조건
- 과목: ${subject || '미지정'}
- 단원: ${chapter || '미지정'}
- 난이도: ${difficulty}
- 문항 수: ${problemCount}
${additionalInstructions ? `- 추가 지시: ${additionalInstructions}` : ''}

## 출력 형식
다음 JSON 형식으로 출력하세요:
{
  "problems": [
    {
      "number": 1,
      "content": "문제 본문 (LaTeX 수식 포함 가능)",
      "choices": ["① ...", "② ...", "③ ...", "④ ...", "⑤ ..."],
      "answer": "정답",
      "solution": "풀이 과정",
      "concepts": ["관련 개념"],
      "difficulty": "상/중/하"
    }
  ],
  "metadata": {
    "engine": "${engineId}",
    "template": "${templateId}",
    "subject": "${subject || ''}",
    "chapter": "${chapter || ''}"
  }
}`;

    // 6. Gemini API 호출
    const parts = [{ text: systemPrompt }];

    // 참조 이미지가 있는 경우
    if (referenceImage) {
      const base64Data = referenceImage.replace(/^data:image\/\w+;base64,/, '');
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Data
        }
      });
      parts.push({ text: '위 이미지의 문제를 참고하여 유사한 변형 문제를 생성하세요.' });
    }

    // 참조 문제 텍스트가 있는 경우
    if (referenceProblem) {
      parts.push({ text: `\n\n참조 문제:\n${referenceProblem}\n\n이 문제를 참고하여 변형 문제를 생성하세요.` });
    }

    const result = await model.generateContent({ contents: [{ parts }] });
    const responseText = result.response.text();

    // 7. JSON 파싱
    let generatedProblems;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        generatedProblems = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('JSON 응답을 찾을 수 없습니다.');
      }
    } catch (parseErr) {
      generatedProblems = {
        problems: [{
          number: 1,
          content: responseText,
          raw: true
        }],
        parseError: parseErr.message
      };
    }

    console.log(`✅ 문제 생성 완료: ${generatedProblems.problems?.length || 0}개`);

    res.json({
      success: true,
      result: generatedProblems,
      engineUsed: {
        id: engineId,
        category: engineCategory,
        template: templateId,
        style: styleId
      },
      ragUsed: !!ragContext
    });

  } catch (error) {
    console.error('파일 기반 엔진 문제 생성 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/file-engines/index
 * 엔진 인덱스 파일 조회
 */
app.get('/api/file-engines/index', async (req, res) => {
  try {
    const indexPath = path.join(__dirname, 'public', 'engines', 'index.md');
    const content = await fsPromises.readFile(indexPath, 'utf-8');

    res.json({
      success: true,
      content,
      path: '/engines/index.md'
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({
        success: false,
        error: '엔진 인덱스 파일을 찾을 수 없습니다.'
      });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 로컬 청크 관리 API ====================

/**
 * GET /api/local-chunks
 * 로컬 저장된 청크 목록 조회
 */
app.get('/api/local-chunks', async (req, res) => {
  try {
    const { documentId, limit = 100 } = req.query;

    let query = db.collection('localChunks').orderBy('createdAt', 'desc');

    if (documentId) {
      query = query.where('documentId', '==', documentId);
    }

    const snapshot = await query.limit(parseInt(limit)).get();

    const chunks = [];
    snapshot.forEach(doc => {
      chunks.push({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
      });
    });

    res.json({
      success: true,
      chunks,
      totalCount: chunks.length
    });
  } catch (error) {
    console.error('로컬 청크 조회 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/local-chunks
 * 새 로컬 청크 저장
 */
app.post('/api/local-chunks', async (req, res) => {
  try {
    const { content, documentId, documentName, metadata = {} } = req.body;

    if (!content) {
      return res.status(400).json({ success: false, error: '청크 내용이 필요합니다.' });
    }

    const chunkData = {
      content,
      documentId: documentId || null,
      documentName: documentName || '직접 입력',
      metadata,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('localChunks').add(chunkData);
    res.json({ success: true, id: docRef.id, message: '청크가 저장되었습니다.' });
  } catch (error) {
    console.error('로컬 청크 저장 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/local-chunks/batch
 * 여러 청크 일괄 저장
 */
app.post('/api/local-chunks/batch', async (req, res) => {
  try {
    const { chunks, documentId, documentName } = req.body;

    if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
      return res.status(400).json({ success: false, error: '저장할 청크가 없습니다.' });
    }

    const batch = db.batch();
    const savedIds = [];

    for (const chunk of chunks) {
      const docRef = db.collection('localChunks').doc();
      batch.set(docRef, {
        content: chunk.content,
        index: chunk.index,
        documentId: documentId || null,
        documentName: documentName || '직접 입력',
        metadata: chunk.metadata || {},
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      savedIds.push(docRef.id);
    }

    await batch.commit();
    res.json({ success: true, savedCount: savedIds.length, ids: savedIds, message: savedIds.length + '개 청크가 저장되었습니다.' });
  } catch (error) {
    console.error('청크 일괄 저장 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/local-chunks/:id
 * 로컬 청크 수정
 */
app.put('/api/local-chunks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { content, metadata } = req.body;

    if (!content) {
      return res.status(400).json({ success: false, error: '청크 내용이 필요합니다.' });
    }

    const docRef = db.collection('localChunks').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, error: '청크를 찾을 수 없습니다.' });
    }

    await docRef.update({
      content,
      metadata: metadata || doc.data().metadata,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ success: true, message: '청크가 수정되었습니다.' });
  } catch (error) {
    console.error('로컬 청크 수정 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/local-chunks/:id
 * 로컬 청크 삭제
 */
app.delete('/api/local-chunks/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const docRef = db.collection('localChunks').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, error: '청크를 찾을 수 없습니다.' });
    }

    await docRef.delete();
    res.json({ success: true, message: '청크가 삭제되었습니다.' });
  } catch (error) {
    console.error('로컬 청크 삭제 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/local-chunks/document/:documentId
 * 문서의 모든 청크 삭제
 */
app.delete('/api/local-chunks/document/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;

    const snapshot = await db.collection('localChunks')
      .where('documentId', '==', documentId)
      .get();

    if (snapshot.empty) {
      return res.json({ success: true, deletedCount: 0, message: '삭제할 청크가 없습니다.' });
    }

    const batch = db.batch();
    snapshot.forEach(doc => { batch.delete(doc.ref); });

    await batch.commit();
    res.json({ success: true, deletedCount: snapshot.size, message: snapshot.size + '개 청크가 삭제되었습니다.' });
  } catch (error) {
    console.error('문서 청크 삭제 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});


/**
 * POST /api/embedding-visualization
 * Embedding 벡터 시각화 (PCA 차원 축소)
 */
app.post('/api/embedding-visualization', async (req, res) => {
  try {
    const { documentId, chunkIds } = req.body;

    // Firestore에서 청크 조회
    let query = db.collection('local_chunks');

    if (documentId) {
      query = query.where('documentId', '==', documentId);
    }

    const snapshot = await query.limit(100).get();

    if (snapshot.empty) {
      return res.json({ success: true, chunks: [], visualization: null });
    }

    const chunks = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.embedding && Array.isArray(data.embedding)) {
        chunks.push({
          id: doc.id,
          content: data.content?.substring(0, 100) + '...',
          documentName: data.documentName || '알 수 없음',
          embedding: data.embedding
        });
      }
    });

    if (chunks.length < 2) {
      return res.json({
        success: true,
        chunks: chunks.map(c => ({ ...c, x: 0, y: 0, embedding: undefined })),
        visualization: null,
        message: '시각화하려면 최소 2개 이상의 임베딩된 청크가 필요합니다.'
      });
    }

    // PCA 차원 축소 (간단한 구현)
    const embeddings = chunks.map(c => c.embedding);
    const dim = embeddings[0].length;
    const n = embeddings.length;

    // 1. 평균 계산
    const mean = new Array(dim).fill(0);
    for (const emb of embeddings) {
      for (let i = 0; i < dim; i++) {
        mean[i] += emb[i] / n;
      }
    }

    // 2. 중심화
    const centered = embeddings.map(emb => emb.map((v, i) => v - mean[i]));

    // 3. 공분산 행렬 계산 (2x2만 필요하므로 간단화)
    // Power iteration으로 상위 2개 주성분 근사
    function normalize(v) {
      const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
      return v.map(x => x / (norm || 1));
    }

    function matVecMul(data, v) {
      const result = new Array(v.length).fill(0);
      for (const row of data) {
        const dot = row.reduce((s, x, i) => s + x * v[i], 0);
        for (let i = 0; i < v.length; i++) {
          result[i] += row[i] * dot;
        }
      }
      return result;
    }

    // 첫 번째 주성분
    let pc1 = normalize(new Array(dim).fill(0).map(() => Math.random() - 0.5));
    for (let iter = 0; iter < 50; iter++) {
      pc1 = normalize(matVecMul(centered, pc1));
    }

    // 두 번째 주성분 (직교화)
    let pc2 = normalize(new Array(dim).fill(0).map(() => Math.random() - 0.5));
    for (let iter = 0; iter < 50; iter++) {
      pc2 = matVecMul(centered, pc2);
      // Gram-Schmidt 직교화
      const dot = pc2.reduce((s, x, i) => s + x * pc1[i], 0);
      pc2 = pc2.map((x, i) => x - dot * pc1[i]);
      pc2 = normalize(pc2);
    }

    // 4. 투영
    const projected = centered.map(row => ({
      x: row.reduce((s, v, i) => s + v * pc1[i], 0),
      y: row.reduce((s, v, i) => s + v * pc2[i], 0)
    }));

    // 정규화 (0-100 범위로)
    const xs = projected.map(p => p.x);
    const ys = projected.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;

    const result = chunks.map((chunk, i) => ({
      id: chunk.id,
      content: chunk.content,
      documentName: chunk.documentName,
      x: ((projected[i].x - minX) / rangeX) * 90 + 5,
      y: ((projected[i].y - minY) / rangeY) * 90 + 5
    }));

    res.json({
      success: true,
      chunks: result,
      stats: {
        totalChunks: result.length,
        dimensions: dim
      }
    });
  } catch (error) {
    console.error('Embedding 시각화 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/rechunk/:documentId
 * 청크 재생성 - 기존 청크 삭제 후 새 설정으로 재생성
 */
app.post('/api/rechunk/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const { chunkingConfig } = req.body;

    // 1. 기존 문서 정보 조회
    const chunksSnapshot = await db.collection('local_chunks')
      .where('documentId', '==', documentId)
      .limit(1)
      .get();

    if (chunksSnapshot.empty) {
      return res.status(404).json({ success: false, error: '해당 문서의 청크를 찾을 수 없습니다.' });
    }

    const firstChunk = chunksSnapshot.docs[0].data();
    const documentName = firstChunk.documentName || '알 수 없음';

    // 2. 해당 문서의 모든 청크에서 원본 텍스트 조합
    const allChunksSnapshot = await db.collection('local_chunks')
      .where('documentId', '==', documentId)
      .orderBy('chunkIndex', 'asc')
      .get();

    let originalText = '';
    const oldChunkIds = [];
    allChunksSnapshot.forEach(doc => {
      oldChunkIds.push(doc.id);
      originalText += (doc.data().content || '') + '\n';
    });

    originalText = originalText.trim();

    if (!originalText) {
      return res.status(400).json({ success: false, error: '원본 텍스트를 복구할 수 없습니다.' });
    }

    // 3. 기존 청크 삭제
    const batch = db.batch();
    allChunksSnapshot.forEach(doc => { batch.delete(doc.ref); });
    await batch.commit();

    // 4. 새 청킹 설정으로 청크 생성
    const maxTokens = chunkingConfig?.maxTokensPerChunk || 800;
    const overlap = chunkingConfig?.maxOverlapTokens || 100;

    // 간단한 청킹 로직 (문장 단위)
    const sentences = originalText.split(/(?<=[.!?。])\s+/);
    const newChunks = [];
    let currentChunk = '';
    let currentTokens = 0;

    for (const sentence of sentences) {
      const sentenceTokens = Math.ceil(sentence.length / 4); // 대략적인 토큰 추정

      if (currentTokens + sentenceTokens > maxTokens && currentChunk) {
        newChunks.push(currentChunk.trim());
        // 오버랩 처리
        const overlapText = currentChunk.slice(-overlap * 4);
        currentChunk = overlapText + ' ' + sentence;
        currentTokens = Math.ceil(currentChunk.length / 4);
      } else {
        currentChunk += ' ' + sentence;
        currentTokens += sentenceTokens;
      }
    }

    if (currentChunk.trim()) {
      newChunks.push(currentChunk.trim());
    }

    // 5. 새 청크 저장
    const newBatch = db.batch();
    const newChunkIds = [];

    for (let i = 0; i < newChunks.length; i++) {
      const chunkRef = db.collection('local_chunks').doc();
      newChunkIds.push(chunkRef.id);

      newBatch.set(chunkRef, {
        documentId: documentId,
        documentName: documentName,
        content: newChunks[i],
        chunkIndex: i,
        createdAt: new Date().toISOString(),
        rechunked: true,
        chunkingConfig: {
          maxTokensPerChunk: maxTokens,
          maxOverlapTokens: overlap
        }
      });
    }

    await newBatch.commit();

    res.json({
      success: true,
      message: `청크가 재생성되었습니다. (${oldChunkIds.length}개 → ${newChunks.length}개)`,
      oldChunkCount: oldChunkIds.length,
      newChunkCount: newChunks.length,
      newChunkIds: newChunkIds
    });
  } catch (error) {
    console.error('청크 재생성 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/documents
 * 문서 목록 조회 (청크 재생성용)
 */
app.get('/api/documents', async (req, res) => {
  try {
    const snapshot = await db.collection('local_chunks').get();

    const documentsMap = new Map();
    snapshot.forEach(doc => {
      const data = doc.data();
      const docId = data.documentId;
      if (docId && !documentsMap.has(docId)) {
        documentsMap.set(docId, {
          documentId: docId,
          documentName: data.documentName || '알 수 없음',
          chunkCount: 0
        });
      }
      if (docId) {
        documentsMap.get(docId).chunkCount++;
      }
    });

    res.json({
      success: true,
      documents: Array.from(documentsMap.values())
    });
  } catch (error) {
    console.error('문서 목록 조회 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== RAG 문서 관리 시스템 API ====================

// ChunkingService 인스턴스 (지연 초기화)
let chunkingService = null;

function getChunkingService() {
  if (!chunkingService) {
    const agent = getAgent();
    chunkingService = new ChunkingService(agent.gemini);
  }
  return chunkingService;
}

/**
 * POST /api/rag/documents
 * 새 RAG 문서 생성
 */
app.post('/api/rag/documents', upload.single('file'), async (req, res) => {
  if (!db) {
    return res.status(500).json({ success: false, error: 'Firebase가 초기화되지 않았습니다.' });
  }

  try {
    const { documentType, title, metadata: metadataStr } = req.body;
    const metadata = metadataStr ? JSON.parse(metadataStr) : {};

    // 스키마 검증
    const validationResult = validators.validateDocument({
      documentType,
      title,
      metadata
    });

    if (!validationResult.valid) {
      return res.status(400).json({
        success: false,
        error: '유효성 검증 실패',
        details: validationResult.errors
      });
    }

    // 문서 생성
    const now = admin.firestore.FieldValue.serverTimestamp();
    const docData = {
      documentType,
      title,
      description: req.body.description || '',
      originalFileName: req.file?.originalname || '',
      mimeType: req.file?.mimetype || 'text/plain',
      fileSize: req.file?.size || 0,
      status: 'pending',
      chunkCount: 0,
      metadata,
      createdAt: now,
      updatedAt: now
    };

    const docRef = await db.collection('rag_documents').add(docData);

    // 파일이 업로드된 경우 청킹 처리 큐에 추가
    if (req.file) {
      await db.collection('document_processing_queue').add({
        documentId: docRef.id,
        filePath: req.file.path,
        status: 'queued',
        priority: 1,
        createdAt: now
      });
    }

    res.json({
      success: true,
      document: {
        id: docRef.id,
        ...docData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('RAG 문서 생성 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/rag/documents
 * RAG 문서 목록 조회
 */
app.get('/api/rag/documents', async (req, res) => {
  if (!db) {
    return res.status(500).json({ success: false, error: 'Firebase가 초기화되지 않았습니다.' });
  }

  try {
    const {
      documentType,
      status,
      subject,
      year,
      limit: limitStr = '50',
      offset: offsetStr = '0',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    let query = db.collection('rag_documents');

    // 필터 적용
    if (documentType) {
      query = query.where('documentType', '==', documentType);
    }
    if (status) {
      query = query.where('status', '==', status);
    }
    if (subject) {
      query = query.where('metadata.subject', '==', subject);
    }
    if (year) {
      query = query.where('metadata.year', '==', parseInt(year));
    }

    // 정렬
    query = query.orderBy(sortBy, sortOrder);

    // 페이지네이션
    const limit = parseInt(limitStr);
    const offset = parseInt(offsetStr);
    query = query.limit(limit);

    const snapshot = await query.get();
    const documents = [];

    snapshot.forEach(doc => {
      documents.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // 전체 개수 조회
    const countSnapshot = await db.collection('rag_documents').count().get();
    const total = countSnapshot.data().count;

    res.json({
      success: true,
      documents,
      total,
      hasMore: offset + documents.length < total
    });

  } catch (error) {
    console.error('RAG 문서 목록 조회 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/rag/documents/:id
 * RAG 문서 상세 조회
 */
app.get('/api/rag/documents/:id', async (req, res) => {
  if (!db) {
    return res.status(500).json({ success: false, error: 'Firebase가 초기화되지 않았습니다.' });
  }

  try {
    const { id } = req.params;

    const docRef = await db.collection('rag_documents').doc(id).get();

    if (!docRef.exists) {
      return res.status(404).json({ success: false, error: '문서를 찾을 수 없습니다.' });
    }

    // 관련 청크 조회
    const chunksSnapshot = await db.collection('rag_chunks')
      .where('documentId', '==', id)
      .orderBy('index', 'asc')
      .get();

    const chunks = [];
    chunksSnapshot.forEach(doc => {
      chunks.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json({
      success: true,
      document: {
        id: docRef.id,
        ...docRef.data()
      },
      chunks
    });

  } catch (error) {
    console.error('RAG 문서 상세 조회 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/rag/documents/:id
 * RAG 문서 메타데이터 수정
 */
app.put('/api/rag/documents/:id', async (req, res) => {
  if (!db) {
    return res.status(500).json({ success: false, error: 'Firebase가 초기화되지 않았습니다.' });
  }

  try {
    const { id } = req.params;
    const { title, description, metadata } = req.body;

    const docRef = db.collection('rag_documents').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, error: '문서를 찾을 수 없습니다.' });
    }

    const currentData = doc.data();
    const updatedMetadata = { ...currentData.metadata, ...metadata };

    // 메타데이터 검증
    const validationResult = validators.validateDocumentMetadata(
      currentData.documentType,
      updatedMetadata
    );

    if (!validationResult.valid) {
      return res.status(400).json({
        success: false,
        error: '유효성 검증 실패',
        details: validationResult.errors
      });
    }

    const updates = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (title) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (metadata) updates.metadata = updatedMetadata;

    await docRef.update(updates);

    const updatedDoc = await docRef.get();

    res.json({
      success: true,
      document: {
        id: updatedDoc.id,
        ...updatedDoc.data()
      }
    });

  } catch (error) {
    console.error('RAG 문서 수정 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/rag/documents/:id
 * RAG 문서 삭제
 */
app.delete('/api/rag/documents/:id', async (req, res) => {
  if (!db) {
    return res.status(500).json({ success: false, error: 'Firebase가 초기화되지 않았습니다.' });
  }

  try {
    const { id } = req.params;

    const docRef = db.collection('rag_documents').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, error: '문서를 찾을 수 없습니다.' });
    }

    // 관련 청크 삭제
    const chunksSnapshot = await db.collection('rag_chunks')
      .where('documentId', '==', id)
      .get();

    const batch = db.batch();
    let deletedChunkCount = 0;

    chunksSnapshot.forEach(chunkDoc => {
      batch.delete(chunkDoc.ref);
      deletedChunkCount++;
    });

    // 문서 삭제
    batch.delete(docRef);

    await batch.commit();

    res.json({
      success: true,
      message: '문서가 삭제되었습니다.',
      deletedChunkCount
    });

  } catch (error) {
    console.error('RAG 문서 삭제 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/rag/documents/:id/chunk
 * 문서 청킹 실행
 */
app.post('/api/rag/documents/:id/chunk', async (req, res) => {
  if (!db) {
    return res.status(500).json({ success: false, error: 'Firebase가 초기화되지 않았습니다.' });
  }

  try {
    const { id } = req.params;
    const { strategy = 'auto', options = {} } = req.body;

    const docRef = db.collection('rag_documents').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, error: '문서를 찾을 수 없습니다.' });
    }

    const docData = doc.data();

    // 청킹에 필요한 콘텐츠 가져오기
    let content = docData.content || req.body.content;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: '청킹할 콘텐츠가 없습니다. content 필드를 제공하세요.'
      });
    }

    // 청킹 서비스 실행
    const chunkingService = getChunkingService();
    const result = await chunkingService.chunkDocument({
      id,
      documentType: docData.documentType,
      metadata: docData.metadata,
      content,
      assets: docData.assets || []
    }, {
      strategy,
      ...options
    });

    // 기존 청크 삭제
    const existingChunks = await db.collection('rag_chunks')
      .where('documentId', '==', id)
      .get();

    const batch = db.batch();
    existingChunks.forEach(chunkDoc => {
      batch.delete(chunkDoc.ref);
    });

    // 새 청크 저장
    const chunkIds = [];
    for (const chunk of result.chunks) {
      const chunkRef = db.collection('rag_chunks').doc();
      chunkIds.push(chunkRef.id);

      batch.set(chunkRef, {
        ...chunk,
        documentId: id,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // 문서 업데이트
    batch.update(docRef, {
      chunkCount: result.chunks.length,
      status: 'indexed',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();

    res.json({
      success: true,
      chunkCount: result.chunks.length,
      chunks: result.chunks.map((chunk, i) => ({
        id: chunkIds[i],
        ...chunk
      })),
      metadata: result.metadata
    });

  } catch (error) {
    console.error('문서 청킹 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/rag/documents/:id/chunks
 * 문서의 청크 목록 조회
 */
app.get('/api/rag/documents/:id/chunks', async (req, res) => {
  if (!db) {
    return res.status(500).json({ success: false, error: 'Firebase가 초기화되지 않았습니다.' });
  }

  try {
    const { id } = req.params;

    const chunksSnapshot = await db.collection('rag_chunks')
      .where('documentId', '==', id)
      .orderBy('index', 'asc')
      .get();

    const chunks = [];
    let totalTokens = 0;

    chunksSnapshot.forEach(doc => {
      const data = doc.data();
      chunks.push({
        id: doc.id,
        ...data
      });
      totalTokens += data.tokenCount || 0;
    });

    res.json({
      success: true,
      chunks,
      totalTokens
    });

  } catch (error) {
    console.error('청크 목록 조회 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/rag/chunks/:id
 * 청크 수정
 */
app.put('/api/rag/chunks/:id', async (req, res) => {
  if (!db) {
    return res.status(500).json({ success: false, error: 'Firebase가 초기화되지 않았습니다.' });
  }

  try {
    const { id } = req.params;
    const { content, contentType, problemData, conceptData } = req.body;

    const chunkRef = db.collection('rag_chunks').doc(id);
    const chunk = await chunkRef.get();

    if (!chunk.exists) {
      return res.status(404).json({ success: false, error: '청크를 찾을 수 없습니다.' });
    }

    const updates = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (content) updates.content = content;
    if (contentType) updates.contentType = contentType;
    if (problemData) updates.problemData = problemData;
    if (conceptData) updates.conceptData = conceptData;

    await chunkRef.update(updates);

    const updatedChunk = await chunkRef.get();

    res.json({
      success: true,
      chunk: {
        id: updatedChunk.id,
        ...updatedChunk.data()
      }
    });

  } catch (error) {
    console.error('청크 수정 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/rag/units/import
 * 자이스토리 기준 단원 분류 가져오기 (CSV)
 */
app.post('/api/rag/units/import', upload.single('file'), async (req, res) => {
  if (!db) {
    return res.status(500).json({ success: false, error: 'Firebase가 초기화되지 않았습니다.' });
  }

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '파일이 필요합니다.' });
    }

    const { curriculum = '2022', subject } = req.body;

    // CSV 파일 읽기
    const fileContent = fs.readFileSync(req.file.path, 'utf-8');
    const lines = fileContent.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
      return res.status(400).json({ success: false, error: 'CSV 파일에 데이터가 없습니다.' });
    }

    // 헤더 파싱 (예: majorCode,majorName,middleCode,middleName,typeCode,typeName)
    const headers = lines[0].split(',').map(h => h.trim());

    const units = [];
    const batch = db.batch();
    let importedCount = 0;
    const errors = [];

    // 그룹화를 위한 맵
    const unitMap = new Map();

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());

      if (values.length < headers.length) {
        errors.push({ row: i + 1, error: '열 수가 맞지 않습니다.' });
        continue;
      }

      const row = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx];
      });

      // 대단원-중단원 키 생성
      const majorKey = `${row.majorCode || row.major_code}`;
      const middleKey = `${majorKey}-${row.middleCode || row.middle_code}`;

      if (!unitMap.has(middleKey)) {
        unitMap.set(middleKey, {
          subject: subject || row.subject,
          curriculum,
          majorUnit: {
            code: row.majorCode || row.major_code,
            name: row.majorName || row.major_name
          },
          middleUnit: {
            code: row.middleCode || row.middle_code,
            name: row.middleName || row.middle_name
          },
          types: []
        });
      }

      // 유형 추가
      const unit = unitMap.get(middleKey);
      if (row.typeCode || row.type_code) {
        unit.types.push({
          code: row.typeCode || row.type_code,
          name: row.typeName || row.type_name,
          fullCode: `${row.middleCode || row.middle_code}${row.typeCode || row.type_code}`
        });
      }
    }

    // Firestore에 저장
    for (const [key, unit] of unitMap) {
      // 검증
      const validationResult = validators.validateUnitClassification(unit);
      if (!validationResult.valid) {
        errors.push({ unit: key, error: validationResult.errors.join(', ') });
        continue;
      }

      const unitRef = db.collection('rag_units').doc();
      batch.set(unitRef, {
        ...unit,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      importedCount++;
    }

    await batch.commit();

    // 임시 파일 삭제
    await cleanupFile(req.file.path);

    res.json({
      success: true,
      importedCount,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('단원 분류 가져오기 오류:', error);
    if (req.file) await cleanupFile(req.file.path);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/rag/units
 * 단원 분류 목록 조회
 */
app.get('/api/rag/units', async (req, res) => {
  if (!db) {
    return res.status(500).json({ success: false, error: 'Firebase가 초기화되지 않았습니다.' });
  }

  try {
    const { subject, curriculum } = req.query;

    let query = db.collection('rag_units');

    if (subject) {
      query = query.where('subject', '==', subject);
    }
    if (curriculum) {
      query = query.where('curriculum', '==', curriculum);
    }

    const snapshot = await query.get();
    const units = [];

    snapshot.forEach(doc => {
      units.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json({
      success: true,
      units
    });

  } catch (error) {
    console.error('단원 분류 조회 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/rag/search
 * RAG 시맨틱 검색 with 메타데이터 필터
 */
app.post('/api/rag/search', async (req, res) => {
  if (!db) {
    return res.status(500).json({ success: false, error: 'Firebase가 초기화되지 않았습니다.' });
  }

  try {
    const {
      query,
      filters = {},
      limit = 10,
      includeChunks = true
    } = req.body;

    if (!query) {
      return res.status(400).json({ success: false, error: '검색어가 필요합니다.' });
    }

    // 1. 메타데이터 필터링으로 문서 ID 목록 가져오기
    let docsQuery = db.collection('rag_documents').where('status', '==', 'indexed');

    if (filters.documentType) {
      const types = Array.isArray(filters.documentType) ? filters.documentType : [filters.documentType];
      docsQuery = docsQuery.where('documentType', 'in', types);
    }
    if (filters.subject) {
      const subjects = Array.isArray(filters.subject) ? filters.subject : [filters.subject];
      docsQuery = docsQuery.where('metadata.subject', 'in', subjects);
    }
    if (filters.difficulty) {
      const difficulties = Array.isArray(filters.difficulty) ? filters.difficulty : [filters.difficulty];
      docsQuery = docsQuery.where('metadata.difficulty', 'in', difficulties);
    }

    const docsSnapshot = await docsQuery.limit(100).get();
    const docIds = [];
    const docsMap = new Map();

    docsSnapshot.forEach(doc => {
      docIds.push(doc.id);
      docsMap.set(doc.id, { id: doc.id, ...doc.data() });
    });

    if (docIds.length === 0) {
      return res.json({
        success: true,
        results: [],
        message: '필터 조건에 맞는 문서가 없습니다.'
      });
    }

    // 2. RAG 검색 실행
    const agent = getAgent();
    let ragAnswer = null;

    try {
      ragAnswer = await agent.ask(query);
    } catch (e) {
      console.warn('RAG 검색 실패, 키워드 검색으로 폴백:', e.message);
    }

    // 3. 청크에서 키워드 검색 (보조)
    const results = [];

    for (const docId of docIds.slice(0, limit)) {
      const doc = docsMap.get(docId);
      const result = {
        document: doc,
        chunks: [],
        relevanceScore: 0
      };

      if (includeChunks) {
        const chunksSnapshot = await db.collection('rag_chunks')
          .where('documentId', '==', docId)
          .orderBy('index', 'asc')
          .limit(5)
          .get();

        chunksSnapshot.forEach(chunkDoc => {
          const chunkData = chunkDoc.data();
          // 간단한 키워드 매칭 점수
          const content = chunkData.content?.toLowerCase() || '';
          const queryLower = query.toLowerCase();
          const matchScore = content.includes(queryLower) ? 1 : 0;

          result.chunks.push({
            id: chunkDoc.id,
            ...chunkData
          });
          result.relevanceScore += matchScore;
        });
      }

      results.push(result);
    }

    // 관련성 점수로 정렬
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    res.json({
      success: true,
      results: results.slice(0, limit),
      answer: ragAnswer,
      totalFiltered: docIds.length
    });

  } catch (error) {
    console.error('RAG 검색 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/rag/document-types
 * 문서 유형 및 메타데이터 스키마 조회
 */
app.get('/api/rag/document-types', (req, res) => {
  res.json({
    success: true,
    types: validators.DOCUMENT_TYPES,
    schemas: {
      textbook: {
        required: ['domain', 'subject', 'curriculum'],
        optional: ['publisher', 'unit', 'contentType', 'keyConcepts']
      },
      supplementary: {
        required: ['domain', 'subject', 'materialName'],
        optional: ['publisher', 'unit', 'contentType']
      },
      csat_past: {
        required: ['examType', 'year', 'domain', 'subject'],
        optional: ['unit', 'problemNumber', 'problemFormat', 'difficulty', 'knowledgeType', 'zystoryUnit']
      },
      csat_mock: {
        required: ['examType', 'year', 'domain', 'subject'],
        optional: ['month', 'unit', 'problemNumber', 'difficulty']
      },
      school_exam: {
        required: ['examType', 'year', 'domain', 'subject', 'schoolInfo'],
        optional: ['unit', 'problemNumber', 'difficulty']
      },
      university_essay: {
        required: ['universityName', 'year', 'admissionType'],
        optional: ['campus', 'department', 'problemNumber', 'problemType', 'units', 'difficulty', 'solutionStrategy', 'gradingKeySentences']
      },
      university_interview: {
        required: ['universityName', 'department', 'year', 'originalQuestion'],
        optional: ['admissionType', 'interviewType', 'interviewDuration', 'followUpSequence', 'questionIntent', 'modelAnswerSummary', 'evaluationCompetencies']
      },
      other: {
        required: [],
        optional: ['category', 'tags', 'description', 'customFields']
      }
    },
    enums: {
      examTypes: validators.EXAM_TYPES,
      problemFormats: validators.PROBLEM_FORMATS,
      difficultyLevels: validators.DIFFICULTY_LEVELS,
      knowledgeTypes: validators.KNOWLEDGE_TYPES,
      contentTypes: validators.TEXTBOOK_CONTENT_TYPES,
      interviewTypes: validators.INTERVIEW_TYPES
    }
  });
});

/**
 * GET /api/rag/chunking-config
 * 문서 유형별 권장 청킹 설정 조회
 */
app.get('/api/rag/chunking-config', (req, res) => {
  const { documentType } = req.query;
  const chunkingService = getChunkingService();

  if (documentType) {
    const config = chunkingService.getRecommendedConfig(documentType);
    res.json({ success: true, config });
  } else {
    const configs = {};
    for (const type of validators.DOCUMENT_TYPES) {
      configs[type] = chunkingService.getRecommendedConfig(type);
    }
    res.json({ success: true, configs });
  }
});

// ==================== Gemini Imagen API ====================

/**
 * POST /api/imagen/generate
 * Gemini Imagen을 사용한 이미지 생성
 */
app.post('/api/imagen/generate', async (req, res) => {
  try {
    const { prompt, width = 1024, height = 1024, numberOfImages = 1 } = req.body;

    if (!prompt) {
      return res.status(400).json({ success: false, error: '프롬프트가 필요합니다.' });
    }

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // Imagen 모델 사용 (또는 대체 모델)
    // 참고: Gemini 2.0 Flash에서 이미지 생성이 지원되는 경우 사용
    // 현재는 텍스트로 이미지 설명을 반환하는 대체 구현
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const result = await model.generateContent(`
      다음 프롬프트에 기반한 교육용 이미지를 설명해주세요.
      이미지 프롬프트: ${prompt}

      다음 형식으로 응답해주세요:
      1. 이미지 설명
      2. SVG 코드 (가능한 경우)
    `);

    const response = await result.response;
    const text = response.text();

    // SVG 추출 시도
    const svgMatch = text.match(/<svg[\s\S]*?<\/svg>/i);

    if (svgMatch) {
      // SVG를 Base64로 인코딩
      const svgBase64 = Buffer.from(svgMatch[0]).toString('base64');
      res.json({
        success: true,
        imageUrl: `data:image/svg+xml;base64,${svgBase64}`,
        base64: svgBase64,
        type: 'svg',
        description: text
      });
    } else {
      // 이미지 설명만 반환 (실제 Imagen API 사용 시 이미지 반환)
      res.json({
        success: true,
        description: text,
        type: 'description',
        message: 'Gemini Imagen API 호출 대신 이미지 설명이 생성되었습니다.'
      });
    }
  } catch (error) {
    console.error('Imagen 생성 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/imagen/edit
 * 이미지 편집 (현재는 설명 기반 편집)
 */
app.post('/api/imagen/edit', async (req, res) => {
  try {
    const { image, prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ success: false, error: '편집 프롬프트가 필요합니다.' });
    }

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    // 이미지가 Base64인 경우
    let imageDescription = '';
    if (image && image.startsWith('data:')) {
      // 이미지 분석 시도 (Vision 모델 사용)
      const base64Data = image.split(',')[1];
      const visionModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      const visionResult = await visionModel.generateContent([
        '이 이미지를 간략히 설명해주세요.',
        { inlineData: { mimeType: 'image/png', data: base64Data } }
      ]);
      imageDescription = (await visionResult.response).text();
    }

    const result = await model.generateContent(`
      원본 이미지 설명: ${imageDescription || '(원본 이미지 없음)'}
      편집 요청: ${prompt}

      수정된 이미지를 SVG 형식으로 생성해주세요.
    `);

    const response = await result.response;
    const text = response.text();

    const svgMatch = text.match(/<svg[\s\S]*?<\/svg>/i);

    if (svgMatch) {
      const svgBase64 = Buffer.from(svgMatch[0]).toString('base64');
      res.json({
        success: true,
        imageUrl: `data:image/svg+xml;base64,${svgBase64}`,
        base64: svgBase64,
        type: 'svg'
      });
    } else {
      res.json({
        success: true,
        description: text,
        type: 'description'
      });
    }
  } catch (error) {
    console.error('이미지 편집 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== RAG 관리자 API ====================

// RAG 관리자 서비스 초기화
let ragManagerService = null;

async function getRAGManagerService() {
  if (!ragManagerService && db) {
    // RAGManagerService는 TypeScript로 작성되어 dist에서 가져옴
    try {
      const { RAGManagerService } = require('./dist/services/RAGManagerService');
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      ragManagerService = new RAGManagerService(db, genAI);
    } catch (error) {
      console.error('RAG Manager Service 초기화 오류:', error.message);
      console.warn('TypeScript 빌드가 필요합니다: npm run build');
    }
  }
  return ragManagerService;
}

// RAG 관리자 통계
app.get('/api/rag-manager/stats', async (req, res) => {
  try {
    const service = await getRAGManagerService();
    if (!service) {
      return res.status(503).json({
        success: false,
        error: 'RAG Manager Service가 초기화되지 않았습니다.'
      });
    }

    const stats = await service.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('RAG Manager 통계 조회 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 버전 히스토리 조회
app.get('/api/rag-manager/versions/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const service = await getRAGManagerService();
    if (!service) {
      return res.status(503).json({
        success: false,
        error: 'RAG Manager Service가 초기화되지 않았습니다.'
      });
    }

    const history = await service.getVersionHistory(documentId);
    res.json({ success: true, data: history });
  } catch (error) {
    console.error('버전 히스토리 조회 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 버전 비교
app.post('/api/rag-manager/versions/compare', async (req, res) => {
  try {
    const { collectionName, versionIdA, versionIdB } = req.body;
    const service = await getRAGManagerService();
    if (!service) {
      return res.status(503).json({
        success: false,
        error: 'RAG Manager Service가 초기화되지 않았습니다.'
      });
    }

    const comparison = await service.compareVersions(collectionName, versionIdA, versionIdB);
    res.json({ success: true, data: comparison });
  } catch (error) {
    console.error('버전 비교 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 버전 승인
app.post('/api/rag-manager/versions/:versionId/approve', async (req, res) => {
  try {
    const { versionId } = req.params;
    const { collectionName, approvedBy } = req.body;
    const service = await getRAGManagerService();
    if (!service) {
      return res.status(503).json({
        success: false,
        error: 'RAG Manager Service가 초기화되지 않았습니다.'
      });
    }

    await service.approveVersion(collectionName, versionId, approvedBy);
    res.json({ success: true, message: '버전이 승인되었습니다.' });
  } catch (error) {
    console.error('버전 승인 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 최신 승인 버전 조회 (RAG 검색용)
app.get('/api/rag-manager/versions/:collectionName/:documentId/latest-approved', async (req, res) => {
  try {
    const { collectionName, documentId } = req.params;
    const service = await getRAGManagerService();
    if (!service) {
      return res.status(503).json({
        success: false,
        error: 'RAG Manager Service가 초기화되지 않았습니다.'
      });
    }

    const document = await service.getLatestApprovedVersion(collectionName, documentId);
    res.json({ success: true, data: document });
  } catch (error) {
    console.error('최신 승인 버전 조회 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 에셋 생성
app.post('/api/rag-manager/assets', async (req, res) => {
  try {
    const assetData = req.body;
    const service = await getRAGManagerService();
    if (!service) {
      return res.status(503).json({
        success: false,
        error: 'RAG Manager Service가 초기화되지 않았습니다.'
      });
    }

    const assetId = await service.createAsset(assetData);
    res.json({ success: true, data: { assetId } });
  } catch (error) {
    console.error('에셋 생성 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 미페어링 에셋 조회
app.get('/api/rag-manager/assets/unpaired', async (req, res) => {
  try {
    const service = await getRAGManagerService();
    if (!service) {
      return res.status(503).json({
        success: false,
        error: 'RAG Manager Service가 초기화되지 않았습니다.'
      });
    }

    const assets = await service.getUnpairedAssets();
    res.json({ success: true, data: assets });
  } catch (error) {
    console.error('미페어링 에셋 조회 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 페어링 생성
app.post('/api/rag-manager/pairings', async (req, res) => {
  try {
    const pairingData = req.body;
    const service = await getRAGManagerService();
    if (!service) {
      return res.status(503).json({
        success: false,
        error: 'RAG Manager Service가 초기화되지 않았습니다.'
      });
    }

    const pairingId = await service.createPairing(pairingData);
    res.json({ success: true, data: { pairingId } });
  } catch (error) {
    console.error('페어링 생성 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 페어링 상태 업데이트
app.patch('/api/rag-manager/pairings/:pairingId', async (req, res) => {
  try {
    const { pairingId } = req.params;
    const { status, verifiedBy, notes } = req.body;
    const service = await getRAGManagerService();
    if (!service) {
      return res.status(503).json({
        success: false,
        error: 'RAG Manager Service가 초기화되지 않았습니다.'
      });
    }

    await service.updatePairingStatus(pairingId, status, verifiedBy, notes);
    res.json({ success: true, message: '페어링 상태가 업데이트되었습니다.' });
  } catch (error) {
    console.error('페어링 상태 업데이트 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 페어링 추천
app.get('/api/rag-manager/pairings/suggest/:assetId', async (req, res) => {
  try {
    const { assetId } = req.params;
    const service = await getRAGManagerService();
    if (!service) {
      return res.status(503).json({
        success: false,
        error: 'RAG Manager Service가 초기화되지 않았습니다.'
      });
    }

    const suggestions = await service.suggestPairings(assetId);
    res.json({ success: true, data: suggestions });
  } catch (error) {
    console.error('페어링 추천 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 에셋 페어링 조회
app.get('/api/rag-manager/pairings/asset/:assetId', async (req, res) => {
  try {
    const { assetId } = req.params;
    const service = await getRAGManagerService();
    if (!service) {
      return res.status(503).json({
        success: false,
        error: 'RAG Manager Service가 초기화되지 않았습니다.'
      });
    }

    const pairings = await service.getPairingsForAsset(assetId);
    res.json({ success: true, data: pairings });
  } catch (error) {
    console.error('에셋 페어링 조회 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 대상 페어링 조회
app.get('/api/rag-manager/pairings/target/:targetId', async (req, res) => {
  try {
    const { targetId } = req.params;
    const service = await getRAGManagerService();
    if (!service) {
      return res.status(503).json({
        success: false,
        error: 'RAG Manager Service가 초기화되지 않았습니다.'
      });
    }

    const pairings = await service.getPairingsForTarget(targetId);
    res.json({ success: true, data: pairings });
  } catch (error) {
    console.error('대상 페어링 조회 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 청크 유형별 생성
app.post('/api/rag-manager/chunks', async (req, res) => {
  try {
    const { chunkData, options } = req.body;
    const service = await getRAGManagerService();
    if (!service) {
      return res.status(503).json({
        success: false,
        error: 'RAG Manager Service가 초기화되지 않았습니다.'
      });
    }

    const chunkId = await service.createTypedChunk(chunkData, options);
    res.json({ success: true, data: { chunkId } });
  } catch (error) {
    console.error('청크 생성 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 청크 그룹 생성
app.post('/api/rag-manager/chunk-groups', async (req, res) => {
  try {
    const { groupType, chunkIds, primaryChunkId, metadata } = req.body;
    const service = await getRAGManagerService();
    if (!service) {
      return res.status(503).json({
        success: false,
        error: 'RAG Manager Service가 초기화되지 않았습니다.'
      });
    }

    const groupId = await service.createChunkGroup(groupType, chunkIds, primaryChunkId, metadata);
    res.json({ success: true, data: { groupId } });
  } catch (error) {
    console.error('청크 그룹 생성 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 청크 임베딩 생성
app.post('/api/rag-manager/chunks/:chunkId/embed', async (req, res) => {
  try {
    const { chunkId } = req.params;
    const service = await getRAGManagerService();
    if (!service) {
      return res.status(503).json({
        success: false,
        error: 'RAG Manager Service가 초기화되지 않았습니다.'
      });
    }

    await service.embedChunk(chunkId);
    res.json({ success: true, message: '청크 임베딩이 생성되었습니다.' });
  } catch (error) {
    console.error('청크 임베딩 생성 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 청크 일괄 임베딩
app.post('/api/rag-manager/chunks/embed-batch', async (req, res) => {
  try {
    const { chunkIds } = req.body;
    const service = await getRAGManagerService();
    if (!service) {
      return res.status(503).json({
        success: false,
        error: 'RAG Manager Service가 초기화되지 않았습니다.'
      });
    }

    const result = await service.embedChunksBatch(chunkIds);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('청크 일괄 임베딩 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 청크 유형별 조회
app.get('/api/rag-manager/chunks/type/:chunkType', async (req, res) => {
  try {
    const { chunkType } = req.params;
    const { onlyApproved, limit } = req.query;
    const service = await getRAGManagerService();
    if (!service) {
      return res.status(503).json({
        success: false,
        error: 'RAG Manager Service가 초기화되지 않았습니다.'
      });
    }

    const chunks = await service.getChunksByType(chunkType, {
      onlyApproved: onlyApproved !== 'false',
      limit: limit ? parseInt(limit) : 100
    });
    res.json({ success: true, data: chunks });
  } catch (error) {
    console.error('청크 유형별 조회 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 문제와 자료 함께 생성
app.post('/api/rag-manager/problems-with-assets', async (req, res) => {
  try {
    const { problemData, assets, options } = req.body;
    const service = await getRAGManagerService();
    if (!service) {
      return res.status(503).json({
        success: false,
        error: 'RAG Manager Service가 초기화되지 않았습니다.'
      });
    }

    const result = await service.createProblemWithAssets(problemData, assets, options);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('문제+자료 생성 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 교과서 본문과 이미지 함께 생성
app.post('/api/rag-manager/textbook-with-assets', async (req, res) => {
  try {
    const { contentData, assets, options } = req.body;
    const service = await getRAGManagerService();
    if (!service) {
      return res.status(503).json({
        success: false,
        error: 'RAG Manager Service가 초기화되지 않았습니다.'
      });
    }

    const result = await service.createTextbookContentWithAssets(contentData, assets, options);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('교과서 본문+이미지 생성 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 문서별 페어링 상태 조회
app.get('/api/rag-manager/documents/:documentId/pairing-status', async (req, res) => {
  try {
    const { documentId } = req.params;
    const service = await getRAGManagerService();
    if (!service) {
      return res.status(503).json({
        success: false,
        error: 'RAG Manager Service가 초기화되지 않았습니다.'
      });
    }

    const status = await service.getDocumentPairingStatus(documentId);
    res.json({ success: true, data: status });
  } catch (error) {
    console.error('문서 페어링 상태 조회 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 청킹 미리보기
app.post('/api/rag-manager/chunking/preview', async (req, res) => {
  try {
    const { text, strategy, options } = req.body;
    const service = await getRAGManagerService();
    if (!service) {
      return res.status(503).json({
        success: false,
        error: 'RAG Manager Service가 초기화되지 않았습니다.'
      });
    }

    const result = await service.previewChunking(text, strategy, options || {});
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('청킹 미리보기 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 자동 청킹 실행
app.post('/api/rag-manager/chunking/auto', async (req, res) => {
  try {
    const { text, options } = req.body;
    const service = await getRAGManagerService();
    if (!service) {
      return res.status(503).json({
        success: false,
        error: 'RAG Manager Service가 초기화되지 않았습니다.'
      });
    }

    const result = await service.autoChunk(text, options);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('자동 청킹 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 노무 AI 전용 API ====================

/**
 * 노무 AI 전용 RAG Agent 인스턴스 관리
 */
let laborAgentInstance = null;

function getLaborAgent() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.');
  }

  const laborStoreName = process.env.LABOR_STORE_NAME || 'labor-law-knowledge-base';

  if (!laborAgentInstance) {
    laborAgentInstance = new RAGAgent(process.env.GEMINI_API_KEY, {
      storeName: laborStoreName
    });
  }

  return laborAgentInstance;
}

/**
 * 노무 AI - 사건 분석 그래프 생성
 * POST /api/labor/analyze-case
 * Body: { description: string }
 * 
 * 사건 내용을 받아 askLabor + findSimilarCases를 병렬 호출한 뒤
 * 그래프 시각화용 nodes/links 구조로 반환합니다.
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

    console.log(`[사건 분석] 그래프 생성 시작: ${description.substring(0, 50)}...`);

    const agent = getLaborAgent();

    // 1. askLabor + findSimilarCases 병렬 호출
    const [askResult, casesResult] = await Promise.allSettled([
      agent.askLabor(description, {
        includeCases: true,
        includeInterpretations: true
      }),
      agent.findSimilarCases(description)
    ]);

    const askData = askResult.status === 'fulfilled' ? askResult.value : null;
    const casesData = casesResult.status === 'fulfilled' ? casesResult.value : null;

    // 2. 분석 요약 추출
    const summary = askData
      ? (askData.text || askData)
      : '사건 분석 결과를 가져올 수 없습니다.';

    const similarCasesSummary = casesData
      ? (casesData.text || casesData)
      : '';

    // 3. Citations → Graph Nodes/Links 변환
    const nodes = [];
    const links = [];
    const seenTitles = new Set();

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

    // askLabor citations 처리
    const askCitations = askData?.citations || [];
    askCitations.forEach((cit, idx) => {
      if (seenTitles.has(cit.title)) return;
      seenTitles.add(cit.title);

      const nodeType = classifyCitationType(cit.title);
      const nodeId = `ask-${idx}`;

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

    // findSimilarCases citations 처리
    const casesCitations = casesData?.citations || [];
    casesCitations.forEach((cit, idx) => {
      if (seenTitles.has(cit.title)) return;
      seenTitles.add(cit.title);

      const nodeType = classifyCitationType(cit.title);
      const nodeId = `case-${idx}`;

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

    console.log(`[사건 분석] 그래프 생성 완료: ${nodes.length} nodes, ${links.length} links`);

    res.json({
      success: true,
      data: {
        summary,
        similarCasesSummary,
        nodes,
        links,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[사건 분석] 오류:', error);
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

    const agent = getLaborAgent();

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
        model: 'gemini-2.0-flash',
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

    const agent = getLaborAgent();

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

    const agent = getLaborAgent();

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

    const agent = getLaborAgent();
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

    const agent = getLaborAgent();
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

    const agent = getLaborAgent();
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

    const agent = getLaborAgent();
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

    const agent = getLaborAgent();

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

    const agent = getLaborAgent();

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
    const agent = getLaborAgent();

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

    const agent = getLaborAgent();
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

    const agent = getLaborAgent();
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
            model: 'gemini-2.0-flash',
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
