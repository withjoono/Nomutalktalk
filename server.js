const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const RAGAgent = require('./RAGAgent');
const OpenAI = require('openai');
require('dotenv').config();

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
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    db = admin.firestore();
    console.log('✅ Firebase Firestore 연결 성공');
  } else {
    console.warn('⚠️  Firebase 서비스 계정 파일이 없습니다:', serviceAccountPath);
    console.warn('   저장 기능을 사용하려면 firebase-service-account.json 파일을 프로젝트 루트에 추가하세요.');
  }
} catch (error) {
  console.error('❌ Firebase 초기화 오류:', error.message);
}

const app = express();
const PORT = process.env.PORT || 3000;

// 업로드 디렉토리 설정
const UPLOAD_DIR = path.join(__dirname, 'uploads');
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
          'http://127.0.0.1:3000',
          'http://127.0.0.1:3001',
          'https://google-file-search.vercel.app',
          'https://google-file-search.netlify.app'
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
app.post('/api/store/initialize', async (req, res) => {
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
 * POST /api/upload
 * 파일 업로드 (직접 업로드 방식)
 */
app.post('/api/upload', upload.single('file'), async (req, res) => {
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
 * 질문하기
 */
app.post('/api/ask', async (req, res) => {
  try {
    if (!currentStoreName) {
      return res.status(400).json({
        success: false,
        error: '먼저 스토어를 초기화하세요.'
      });
    }

    const { query } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: '질문이 필요합니다.'
      });
    }

    const agent = getAgent();
    let answer = await agent.ask(query);

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
    const selectedGeminiModel = geminiModel || 'gemini-2.0-flash-exp';
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
 * POST /api/variation-solution
 * 변형 문제에 대한 풀이 생성
 */
app.post('/api/variation-solution', async (req, res) => {
  try {
    const { problem, metadata, geminiModel, openaiModel, llmType } = req.body;

    // 하위 호환성
    const selectedGeminiModel = geminiModel || 'gemini-2.0-flash-exp';
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
    const { images, extractType = 'full' } = req.body;

    if (!images || images.length === 0) {
      return res.status(400).json({
        success: false,
        error: '추출할 이미지가 필요합니다.'
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        success: false,
        error: 'Gemini API 키가 설정되지 않았습니다.'
      });
    }

    console.log('📝 OCR 텍스트 추출 시작');

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
      }
    });

    const ocrPrompt = extractType === 'problem'
      ? `이 이미지에서 수학/과학 문제를 정확하게 추출해주세요.

## 추출 규칙
1. 문제 텍스트를 정확하게 그대로 추출
2. 수학 수식은 LaTeX 형식으로 변환 ($...$ 사용)
3. 보기가 있으면 ①, ②, ③, ④, ⑤ 형식으로 표시
4. 그림이나 그래프 설명이 필요하면 [그림: 설명] 형태로 추가
5. 문제 번호가 있으면 포함

추출된 문제 텍스트만 그대로 출력해주세요. JSON이나 다른 형식 없이 순수한 문제 내용만 출력합니다.`
      : `이 이미지의 모든 텍스트를 정확하게 추출해주세요.

## 추출 규칙
1. 모든 텍스트를 빠짐없이 추출
2. 수학 수식은 LaTeX 형식으로 변환 ($...$ 사용)
3. 레이아웃과 구조를 최대한 유지
4. 표가 있으면 마크다운 표 형식으로 변환
5. 그림이 있으면 [그림: 설명] 형태로 표시

추출된 텍스트를 그대로 출력해주세요.`;

    const imageParts = images.map(img => ({
      inlineData: {
        mimeType: img.mimeType || 'image/png',
        data: img.data.replace(/^data:[^;]+;base64,/, '')
      }
    }));

    const result = await model.generateContent([ocrPrompt, ...imageParts]);
    const response = await result.response;
    const extractedText = response.text();

    console.log('✅ OCR 추출 완료');

    res.json({
      success: true,
      extractedText,
      extractType
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
app.listen(PORT, () => {
  console.log(`
🚀 Google File Search RAG Agent 서버 시작
📡 URL: http://localhost:${PORT}
🔑 API 키 설정: ${process.env.GEMINI_API_KEY ? '✅' : '❌ (.env 파일 확인 필요)'}
  `);

  if (!process.env.GEMINI_API_KEY) {
    console.warn('⚠️  GEMINI_API_KEY가 설정되지 않았습니다.');
    console.warn('   .env 파일에 API 키를 추가하세요.');
  }
});
