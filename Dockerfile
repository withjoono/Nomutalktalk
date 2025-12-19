# Google Cloud Run용 Dockerfile - Multi-stage build
# Stage 1: TypeScript 빌드
FROM node:22-slim AS builder

WORKDIR /app

# 패키지 파일 복사
COPY package*.json ./
COPY tsconfig.json ./

# 모든 의존성 설치 (TypeScript 빌드를 위해)
RUN npm ci

# 소스 파일 복사 및 빌드
COPY src/ ./src/
RUN npm run build

# Stage 2: 프로덕션 이미지
FROM node:22-slim

WORKDIR /app

# 패키지 파일 복사
COPY package*.json ./

# 프로덕션 의존성만 설치
RUN npm ci --only=production

# 빌드된 파일 복사
COPY --from=builder /app/dist ./dist

# 애플리케이션 파일 복사
COPY server.js ./
COPY RAGAgent.js ./
COPY models/ ./models/
COPY services/*.js ./services/
COPY public/ ./public/

# 디렉토리 생성
RUN mkdir -p uploads

# 보안: non-root 사용자로 실행
RUN chown -R node:node /app
USER node

# Cloud Run이 제공하는 PORT 환경 변수 사용
ENV PORT=8080
ENV NODE_ENV=production

# 포트 노출
EXPOSE 8080

# 헬스체크
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:'+process.env.PORT+'/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 서버 시작
CMD ["node", "server.js"]
