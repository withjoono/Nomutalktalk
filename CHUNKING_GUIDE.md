# 청킹(Chunking) 구성 가이드

파일 검색 성능을 최적화하기 위한 청킹 구성 완벽 가이드입니다.

## 📋 목차
- [청킹이란?](#청킹이란)
- [청킹 설정 파라미터](#청킹-설정-파라미터)
- [최적 청킹 전략](#최적-청킹-전략)
- [사용 방법](#사용-방법)
- [모범 사례](#모범-사례)
- [문제 해결](#문제-해결)

---

## 청킹이란?

**청킹(Chunking)**은 긴 문서를 작은 조각(chunk)으로 나누는 프로세스입니다. 이를 통해:

- ✅ **검색 정확도 향상**: 관련 정보를 더 정확하게 찾음
- ✅ **컨텍스트 유지**: 청크 간 오버랩으로 문맥 연결
- ✅ **성능 최적화**: 필요한 부분만 검색하여 속도 향상
- ✅ **비용 절감**: 토큰 사용량 최적화

---

## 청킹 설정 파라미터

### whiteSpaceConfig

공백(공백, 줄바꿈 등)을 기준으로 텍스트를 청킹합니다.

#### maxTokensPerChunk

**설명**: 각 청크의 최대 토큰 수

**범위**: 양수 (권장: 100-500)

**영향**:
- **작은 값 (100-200)**: 정밀한 검색, 문맥 제한적
- **중간 값 (200-300)**: 균형잡힌 성능
- **큰 값 (300-500)**: 넓은 문맥, 검색 정확도 감소 가능

#### maxOverlapTokens

**설명**: 인접 청크 간 겹치는 토큰 수

**범위**: 0 이상, maxTokensPerChunk 미만

**영향**:
- **0**: 겹침 없음, 문맥 단절 가능
- **10-20**: 기본적인 문맥 연결
- **30-50**: 강력한 문맥 유지
- **너무 큼**: 중복 증가, 비효율

**권장 비율**: maxOverlapTokens ≈ 10% of maxTokensPerChunk

---

## 최적 청킹 전략

### 문서 타입별 권장 설정

#### 1. 코드 파일 (`.js`, `.py`, `.java`)

```javascript
{
  whiteSpaceConfig: {
    maxTokensPerChunk: 150,
    maxOverlapTokens: 15
  }
}
```

**이유**:
- 함수/클래스 단위로 분리
- 코드 블록 간 독립성
- 정확한 코드 검색

#### 2. 기술 문서 (`.md`, `.rst`, `.txt`)

```javascript
{
  whiteSpaceConfig: {
    maxTokensPerChunk: 250,
    maxOverlapTokens: 25
  }
}
```

**이유**:
- 문단 단위 분리
- 기술 설명의 완전성
- 코드 예제 포함

#### 3. 장문 텍스트 (소설, 논문, 보고서)

```javascript
{
  whiteSpaceConfig: {
    maxTokensPerChunk: 400,
    maxOverlapTokens: 40
  }
}
```

**이유**:
- 섹션/챕터 단위 유지
- 서사/논리 흐름 보존
- 넓은 문맥 제공

#### 4. 대화/채팅 로그

```javascript
{
  whiteSpaceConfig: {
    maxTokensPerChunk: 200,
    maxOverlapTokens: 30
  }
}
```

**이유**:
- 대화 맥락 유지
- 메시지 그룹화
- 화자 간 관계 보존

#### 5. PDF 문서

```javascript
{
  whiteSpaceConfig: {
    maxTokensPerChunk: 300,
    maxOverlapTokens: 30
  }
}
```

**이유**:
- 페이지/섹션 경계 고려
- 표/그림 설명 포함
- 레이아웃 정보 유지

---

## 사용 방법

### 직접 업로드 방식

```javascript
const agent = new RAGAgent(process.env.GEMINI_API_KEY);
await agent.initialize('my-store');

await agent.uploadFile('document.pdf', {
  displayName: 'My Document',
  mimeType: 'application/pdf',
  chunkingConfig: {
    whiteSpaceConfig: {
      maxTokensPerChunk: 200,
      maxOverlapTokens: 20
    }
  }
});
```

### Files API Import 방식

```javascript
await agent.uploadAndImportFile('document.pdf', {
  displayName: 'My Document',
  mimeType: 'application/pdf',
  chunkingConfig: {
    whiteSpaceConfig: {
      maxTokensPerChunk: 300,
      maxOverlapTokens: 30
    }
  }
});
```

### 여러 파일 일괄 처리

```javascript
await agent.uploadFiles([
  {
    path: 'code.js',
    displayName: 'Code',
    chunkingConfig: {
      whiteSpaceConfig: {
        maxTokensPerChunk: 150,
        maxOverlapTokens: 15
      }
    }
  },
  {
    path: 'docs.md',
    displayName: 'Documentation',
    chunkingConfig: {
      whiteSpaceConfig: {
        maxTokensPerChunk: 250,
        maxOverlapTokens: 25
      }
    }
  }
]);
```

---

## 모범 사례

### 1. 문서 길이에 따른 조정

**짧은 문서 (<1000 토큰)**
```javascript
{
  whiteSpaceConfig: {
    maxTokensPerChunk: 500,  // 큰 청크
    maxOverlapTokens: 0      // 오버랩 불필요
  }
}
```

**중간 문서 (1000-10000 토큰)**
```javascript
{
  whiteSpaceConfig: {
    maxTokensPerChunk: 250,
    maxOverlapTokens: 25
  }
}
```

**긴 문서 (>10000 토큰)**
```javascript
{
  whiteSpaceConfig: {
    maxTokensPerChunk: 200,
    maxOverlapTokens: 20
  }
}
```

### 2. 질의 유형에 따른 조정

**정밀 검색 (특정 정보)**
- 작은 청크 (100-150)
- 적은 오버랩 (10-15)

**포괄 검색 (전체 맥락)**
- 큰 청크 (300-500)
- 많은 오버랩 (30-50)

**균형 검색 (일반적)**
- 중간 청크 (200-250)
- 중간 오버랩 (20-25)

### 3. 성능 vs 정확도 트레이드오프

| 설정 | 청크 크기 | 오버랩 | 검색 속도 | 정확도 | 비용 |
|------|-----------|--------|-----------|--------|------|
| 빠름 | 큼 (400+) | 작음 (10) | ⚡⚡⚡ | ⭐⭐ | 💰 |
| 균형 | 중간 (200-300) | 중간 (20-30) | ⚡⚡ | ⭐⭐⭐ | 💰💰 |
| 정밀 | 작음 (100-200) | 큼 (30-50) | ⚡ | ⭐⭐⭐⭐ | 💰💰💰 |

---

## 문제 해결

### 검색 결과가 부정확함

**원인**: 청크가 너무 작거나 오버랩 부족

**해결**:
```javascript
{
  whiteSpaceConfig: {
    maxTokensPerChunk: 300,      // 증가
    maxOverlapTokens: 40          // 증가
  }
}
```

### 검색 속도가 느림

**원인**: 청크가 너무 작거나 오버랩 과다

**해결**:
```javascript
{
  whiteSpaceConfig: {
    maxTokensPerChunk: 400,      // 증가
    maxOverlapTokens: 20         // 감소
  }
}
```

### 문맥이 끊김

**원인**: 오버랩 토큰 부족

**해결**:
```javascript
{
  whiteSpaceConfig: {
    maxTokensPerChunk: 250,
    maxOverlapTokens: 50         // 증가 (최대 청크의 20%)
  }
}
```

### 비용이 너무 높음

**원인**: 청크가 너무 작거나 오버랩 과다

**해결**:
```javascript
{
  whiteSpaceConfig: {
    maxTokensPerChunk: 400,      // 증가
    maxOverlapTokens: 20         // 감소
  }
}
```

---

## 청킹 설정 검증

자동 검증 기능이 포함되어 있습니다:

```javascript
// ✅ 유효한 설정
{
  whiteSpaceConfig: {
    maxTokensPerChunk: 200,
    maxOverlapTokens: 20
  }
}

// ❌ 오류: maxOverlapTokens >= maxTokensPerChunk
{
  whiteSpaceConfig: {
    maxTokensPerChunk: 100,
    maxOverlapTokens: 100  // 오류!
  }
}

// ❌ 오류: 음수 값
{
  whiteSpaceConfig: {
    maxTokensPerChunk: -100,  // 오류!
    maxOverlapTokens: 10
  }
}
```

---

## 실행 예제

```bash
# 기본 청킹 예제
node example-chunking.js 1

# 청킹 전략 비교
node example-chunking.js 2

# Files API Import + 청킹
node example-chunking.js 3

# 문서 타입별 최적 청킹
node example-chunking.js 4

# 청킹 설정 검증
node example-chunking.js 5
```

---

## Python 참조 코드와 비교

### Python
```python
config={
    'chunking_config': {
      'white_space_config': {
        'max_tokens_per_chunk': 200,
        'max_overlap_tokens': 20
      }
    }
}
```

### JavaScript
```javascript
chunkingConfig: {
  whiteSpaceConfig: {
    maxTokensPerChunk: 200,
    maxOverlapTokens: 20
  }
}
```

---

## 추가 리소스

- [Google Gemini Chunking 문서](https://ai.google.dev/gemini-api/docs/file-search)
- [토큰 계산 가이드](https://ai.google.dev/gemini-api/docs/tokens)
- [RAG 최적화 가이드](https://ai.google.dev/gemini-api/docs/rag-optimization)

---

**문서 버전**: 1.0.0
**최종 업데이트**: 2025
