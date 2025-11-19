# Google Cloud Run용 Dockerfile
# Node.js 22 LTS 버전 사용
FROM node:22-slim

# 작업 디렉토리 설정
WORKDIR /app

# 패키지 파일 복사 (캐싱 최적화)
COPY package*.json ./

# 프로덕션 의존성만 설치
RUN npm ci --only=production

# 애플리케이션 파일 복사
COPY . .

# public 디렉토리 존재 확인
RUN mkdir -p public uploads

# 보안: non-root 사용자로 실행
RUN chown -R node:node /app
USER node

# Cloud Run이 제공하는 PORT 환경 변수 사용
ENV PORT=8080

# 포트 노출
EXPOSE 8080

# 헬스체크
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:'+process.env.PORT+'/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 서버 시작
CMD ["node", "server.js"]
