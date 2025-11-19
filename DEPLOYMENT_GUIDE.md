# Google Cloud Run 배포 가이드

Google File Search RAG Agent를 Google Cloud Run에 배포하는 단계별 가이드입니다.

## 📋 목차
- [사전 준비](#사전-준비)
- [배포 단계](#배포-단계)
- [환경 변수 설정](#환경-변수-설정)
- [배포 확인](#배포-확인)
- [업데이트 및 관리](#업데이트-및-관리)
- [비용 관리](#비용-관리)
- [문제 해결](#문제-해결)

## 🚀 사전 준비

### 1. Google Cloud 계정 및 프로젝트

1. **Google Cloud 계정 생성**
   - https://cloud.google.com/ 접속
   - 무료 체험 시작 (12개월 무료 + $300 크레딧)

2. **새 프로젝트 생성**
   ```
   프로젝트 이름: filesearch-rag (또는 원하는 이름)
   ```

3. **결제 계정 연결**
   - Cloud Run은 사용량 기반 과금
   - 무료 할당량: 월 2백만 요청, 360,000 GB-초

### 2. gcloud CLI 설치

**Windows:**
```powershell
# Google Cloud SDK 설치
# https://cloud.google.com/sdk/docs/install 에서 설치 프로그램 다운로드
```

**설치 확인:**
```bash
gcloud --version
```

### 3. gcloud 인증 및 설정

```bash
# Google 계정으로 로그인
gcloud auth login

# 프로젝트 설정
gcloud config set project PROJECT_ID

# 프로젝트 ID 확인
gcloud config get-value project
```

**프로젝트 ID 찾기:**
- GCP Console → 대시보드 → 프로젝트 정보에서 확인

### 4. 필요한 API 활성화

```bash
# Cloud Run API 활성화
gcloud services enable run.googleapis.com

# Container Registry API 활성화
gcloud services enable containerregistry.googleapis.com

# Cloud Build API 활성화
gcloud services enable cloudbuild.googleapis.com
```

또는 GCP Console에서:
1. API 및 서비스 → 라이브러리
2. 다음 API 검색 및 활성화:
   - Cloud Run API
   - Container Registry API
   - Cloud Build API

## 📦 배포 단계

### 단계 1: 프로젝트 준비

프로젝트 디렉토리로 이동:
```bash
cd E:\Dev\github\GoogleFileSearch
```

### 단계 2: Docker 이미지 빌드 및 푸시

**방법 A: Cloud Build 사용 (권장)**

```bash
# Cloud Build로 이미지 빌드 및 푸시 (한 번에)
gcloud builds submit --tag gcr.io/PROJECT_ID/filesearch-rag
```

**방법 B: 로컬 Docker 사용**

```bash
# 로컬에서 이미지 빌드
docker build -t gcr.io/PROJECT_ID/filesearch-rag .

# Container Registry에 푸시
docker push gcr.io/PROJECT_ID/filesearch-rag
```

**PROJECT_ID 교체 예시:**
```bash
# 프로젝트 ID가 "my-project-123"인 경우
gcloud builds submit --tag gcr.io/my-project-123/filesearch-rag
```

### 단계 3: Cloud Run 배포

**기본 배포:**
```bash
gcloud run deploy filesearch-rag \
  --image gcr.io/PROJECT_ID/filesearch-rag \
  --platform managed \
  --region asia-northeast3 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 10 \
  --timeout 300
```

**배포 옵션 설명:**
- `--region asia-northeast3`: 서울 리전 (또는 asia-northeast1: 도쿄)
- `--allow-unauthenticated`: 인증 없이 접근 가능 (공개 웹앱)
- `--memory 512Mi`: 메모리 512MB 할당
- `--cpu 1`: 1 vCPU
- `--max-instances 10`: 최대 10개 인스턴스
- `--timeout 300`: 타임아웃 5분

**인증이 필요한 경우:**
```bash
# --allow-unauthenticated 제거하고 배포
gcloud run deploy filesearch-rag \
  --image gcr.io/PROJECT_ID/filesearch-rag \
  --platform managed \
  --region asia-northeast3 \
  --memory 512Mi
```

### 단계 4: 환경 변수 설정

**옵션 A: Secret Manager 사용 (권장 - 보안)**

1. **Secret Manager API 활성화:**
```bash
gcloud services enable secretmanager.googleapis.com
```

2. **시크릿 생성:**
```bash
# API 키를 시크릿으로 저장
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets create gemini-api-key --data-file=-
```

3. **Cloud Run에 시크릿 연결:**
```bash
gcloud run services update filesearch-rag \
  --update-secrets GEMINI_API_KEY=gemini-api-key:latest \
  --region asia-northeast3
```

**옵션 B: 환경 변수 직접 설정 (간단하지만 덜 안전)**

```bash
gcloud run services update filesearch-rag \
  --set-env-vars GEMINI_API_KEY=YOUR_ACTUAL_API_KEY \
  --region asia-northeast3
```

**⚠️ 주의**: 옵션 B는 API 키가 Cloud Run 설정에 평문으로 저장됩니다. 프로덕션에서는 Secret Manager(옵션 A)를 사용하세요.

## ✅ 배포 확인

### 1. 서비스 URL 확인

```bash
gcloud run services describe filesearch-rag \
  --region asia-northeast3 \
  --format 'value(status.url)'
```

출력 예시:
```
https://filesearch-rag-abcd1234-an.a.run.app
```

### 2. 헬스 체크

```bash
curl https://YOUR-SERVICE-URL/api/health
```

정상 응답:
```json
{
  "status": "ok",
  "apiKeyConfigured": true,
  "currentStore": null
}
```

### 3. 브라우저에서 접속

브라우저에서 서비스 URL 접속:
```
https://filesearch-rag-abcd1234-an.a.run.app
```

## 🔄 업데이트 및 관리

### 코드 수정 후 재배포

```bash
# 1. 이미지 다시 빌드
gcloud builds submit --tag gcr.io/PROJECT_ID/filesearch-rag

# 2. 자동으로 새 이미지로 배포됨
# 또는 수동으로 재배포:
gcloud run deploy filesearch-rag \
  --image gcr.io/PROJECT_ID/filesearch-rag \
  --region asia-northeast3
```

### 로그 확인

```bash
# 실시간 로그 스트리밍
gcloud run services logs tail filesearch-rag \
  --region asia-northeast3

# 최근 로그 조회
gcloud run services logs read filesearch-rag \
  --region asia-northeast3 \
  --limit 100
```

### 서비스 설정 확인

```bash
gcloud run services describe filesearch-rag \
  --region asia-northeast3
```

### 트래픽 분할 (Blue-Green 배포)

```bash
# 새 버전 배포 (트래픽 0%)
gcloud run deploy filesearch-rag \
  --image gcr.io/PROJECT_ID/filesearch-rag:v2 \
  --no-traffic \
  --region asia-northeast3

# 트래픽 점진적으로 이동
gcloud run services update-traffic filesearch-rag \
  --to-revisions LATEST=10 \
  --region asia-northeast3
```

### 서비스 삭제

```bash
gcloud run services delete filesearch-rag \
  --region asia-northeast3
```

## 💰 비용 관리

### Cloud Run 무료 할당량 (월간)

- **요청**: 2,000,000건
- **컴퓨팅 시간**: 360,000 vCPU-초
- **메모리**: 180,000 GiB-초
- **네트워크 이그레스**: 1 GB (북미)

### 예상 비용 (무료 할당량 초과 시)

**서울 리전 기준:**
- vCPU: $0.00002400/vCPU-초
- 메모리: $0.00000250/GiB-초
- 요청: $0.40/백만 요청

**예시 계산:**
- 일 1,000 요청 (평균 1초 실행, 512MB 메모리)
- 월 30,000 요청 → 무료 할당량 내
- **비용: $0/월**

**월 100만 요청 시:**
- 요청 비용: $0.40
- 컴퓨팅 비용: ~$2-5
- **총 예상 비용: ~$5-10/월**

### 비용 절감 팁

1. **최소 인스턴스 0으로 설정** (기본값)
   - 트래픽 없을 때 자동으로 0으로 스케일 다운

2. **메모리 최적화**
   ```bash
   # 메모리 256MB로 줄이기 (가능한 경우)
   gcloud run services update filesearch-rag \
     --memory 256Mi \
     --region asia-northeast3
   ```

3. **타임아웃 조정**
   ```bash
   # 짧은 타임아웃 설정 (필요한 만큼만)
   gcloud run services update filesearch-rag \
     --timeout 60 \
     --region asia-northeast3
   ```

4. **리전 선택**
   - 서울(asia-northeast3) vs 도쿄(asia-northeast1)
   - 사용자와 가까운 리전 선택

### 예산 알림 설정

1. GCP Console → 결제 → 예산 및 알림
2. 예산 생성:
   - 금액: $10/월
   - 알림: 50%, 90%, 100% 도달 시

## 🔧 고급 설정

### 커스텀 도메인 연결

1. **도메인 소유권 확인**
2. **Cloud Run에 도메인 매핑**
```bash
gcloud run domain-mappings create \
  --service filesearch-rag \
  --domain your-domain.com \
  --region asia-northeast3
```

### VPC 연결

```bash
gcloud run services update filesearch-rag \
  --vpc-connector YOUR_CONNECTOR \
  --region asia-northeast3
```

### 동시성 설정

```bash
# 인스턴스당 최대 80개 동시 요청
gcloud run services update filesearch-rag \
  --concurrency 80 \
  --region asia-northeast3
```

### CI/CD 파이프라인 (Cloud Build)

**cloudbuild.yaml** 생성:
```yaml
steps:
  # 이미지 빌드
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/filesearch-rag', '.']

  # 이미지 푸시
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/filesearch-rag']

  # Cloud Run 배포
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'filesearch-rag'
      - '--image'
      - 'gcr.io/$PROJECT_ID/filesearch-rag'
      - '--region'
      - 'asia-northeast3'
      - '--platform'
      - 'managed'

images:
  - 'gcr.io/$PROJECT_ID/filesearch-rag'
```

**GitHub 연동:**
1. Cloud Build → 트리거 → GitHub 연결
2. Push 이벤트 시 자동 배포

## 🐛 문제 해결

### 1. 빌드 실패

**오류: "permission denied"**
```bash
# Cloud Build 권한 부여
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member serviceAccount:PROJECT_NUMBER@cloudbuild.gserviceaccount.com \
  --role roles/run.admin
```

**오류: "API not enabled"**
```bash
# 필요한 API 활성화
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

### 2. 배포 실패

**오류: "Container failed to start"**
- 로그 확인: `gcloud run services logs tail filesearch-rag`
- PORT 환경 변수 확인 (server.js에서 process.env.PORT 사용)

**오류: "Service account does not have permission"**
```bash
# Cloud Run 서비스 계정에 권한 부여
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com \
  --role roles/secretmanager.secretAccessor
```

### 3. API 키 오류

**증상: "API 키가 설정되지 않았습니다"**
```bash
# 시크릿 확인
gcloud secrets versions access latest --secret gemini-api-key

# 서비스에 시크릿 연결 확인
gcloud run services describe filesearch-rag \
  --region asia-northeast3
```

### 4. 성능 문제

**느린 응답 시간:**
```bash
# 메모리 증가
gcloud run services update filesearch-rag \
  --memory 1Gi \
  --region asia-northeast3

# CPU 증가
gcloud run services update filesearch-rag \
  --cpu 2 \
  --region asia-northeast3
```

**콜드 스타트 문제:**
```bash
# 최소 인스턴스 설정 (비용 증가)
gcloud run services update filesearch-rag \
  --min-instances 1 \
  --region asia-northeast3
```

### 5. 연결 시간 초과

```bash
# 타임아웃 증가
gcloud run services update filesearch-rag \
  --timeout 600 \
  --region asia-northeast3
```

## 📊 모니터링

### Cloud Console 모니터링

1. Cloud Run → filesearch-rag 서비스
2. **메트릭** 탭:
   - 요청 수
   - 요청 지연 시간
   - 인스턴스 수
   - CPU 사용률
   - 메모리 사용률

### Uptime Checks 설정

1. Cloud Console → Monitoring → Uptime checks
2. 새 체크 생성:
   - URL: `https://YOUR-SERVICE-URL/api/health`
   - 간격: 1분
   - 알림: 이메일

## 🔐 보안 권장사항

1. **Secret Manager 사용** (환경 변수 대신)
2. **IAM 최소 권한 원칙**
3. **VPC 네트워크 사용** (필요 시)
4. **Cloud Armor** 활성화 (DDoS 방어)
5. **정기적인 의존성 업데이트**

## 📞 추가 리소스

- [Cloud Run 문서](https://cloud.google.com/run/docs)
- [가격 계산기](https://cloud.google.com/products/calculator)
- [할당량 및 한도](https://cloud.google.com/run/quotas)
- [샘플 및 튜토리얼](https://cloud.google.com/run/docs/samples)

## ✅ 배포 체크리스트

배포 전:
- [ ] GCP 프로젝트 생성
- [ ] gcloud CLI 설치 및 인증
- [ ] 필요한 API 활성화
- [ ] Gemini API 키 준비

배포:
- [ ] Docker 이미지 빌드
- [ ] Cloud Run 배포
- [ ] 환경 변수/시크릿 설정
- [ ] 헬스 체크 확인

배포 후:
- [ ] 서비스 URL 테스트
- [ ] 로그 모니터링
- [ ] 예산 알림 설정
- [ ] 백업 계획 수립

---

**배포 완료 후 접속 URL**: `https://filesearch-rag-XXXXX.a.run.app`

문제가 발생하면 로그를 확인하고 이 가이드의 문제 해결 섹션을 참조하세요!
