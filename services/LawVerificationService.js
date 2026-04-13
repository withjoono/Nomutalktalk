/**
 * 국가법령정보센터 Open API 종합 서비스
 * 
 * Lv.1: 판례 사후 검증 (hallucination check)
 * Lv.2: 사전 근거 주입 (pre-fetch RAG) — 법령 조문, 판례 본문, 행정해석, 노동위 결정문
 * 
 * API 문서: https://open.law.go.kr/LSO/openApi/guideList.do
 */
class LawOpenAPIService {
  constructor() {
    this.apiKey = process.env.LAW_OPEN_API_KEY;
    this.baseUrl = 'https://www.law.go.kr/DRF/lawSearch.do';
    this.timeout = 8000; // 8초
  }

  // ==================== 공통 유틸 ====================

  /**
   * Open API 호출 공통 메서드
   * @param {Object} params - URL 쿼리 파라미터
   * @returns {Promise<string|null>} XML 응답 텍스트 또는 null
   */
  async _callAPI(params) {
    if (!this.apiKey) {
      console.warn('[LawOpenAPI] API 키 미설정. 건너뜀.');
      return null;
    }

    const query = new URLSearchParams({ OC: this.apiKey, ...params }).toString();
    const url = `${this.baseUrl}?${query}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        headers: { 'User-Agent': 'NomuTalk/1.0' },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const xmlText = await response.text();

      // API 에러 응답 감지
      if (xmlText.includes('<result>') && xmlText.includes('실패')) {
        console.warn('[LawOpenAPI] API 에러:', xmlText.substring(0, 200));
        return null;
      }

      return xmlText;
    } catch (error) {
      console.error(`[LawOpenAPI] 호출 실패 (${params.target}):`, error.message);
      return null;
    }
  }

  /**
   * XML에서 특정 태그 값 추출 (단일)
   */
  _extractTag(xml, tagName) {
    const regex = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`);
    const match = xml.match(regex);
    return match ? match[1].trim() : null;
  }

  /**
   * XML에서 반복되는 항목 추출 (목록)
   */
  _extractItems(xml, wrapperTag) {
    const items = [];
    const regex = new RegExp(`<${wrapperTag}>([\\s\\S]*?)<\\/${wrapperTag}>`, 'g');
    let match;
    while ((match = regex.exec(xml)) !== null) {
      items.push(match[1]);
    }
    return items;
  }

  // ==================== Lv.2: 사전 근거 수집 ====================

  /**
   * 법령 조문 검색 — 법률명(예: "근로기준법")으로 검색하여 조문 목록 반환
   * @param {string} lawName - 법률명 (예: "근로기준법", "근로자퇴직급여 보장법")
   * @returns {Promise<Object|null>} { lawName, articles: [...] }
   */
  async searchLaw(lawName) {
    console.log(`[LawOpenAPI] 법령 검색: "${lawName}"`);
    const xml = await this._callAPI({
      target: 'law',
      type: 'XML',
      query: lawName,
      display: '3'  // 상위 3건
    });

    if (!xml) return null;

    const totalCnt = parseInt(this._extractTag(xml, 'totalCnt') || '0', 10);
    if (totalCnt === 0) return null;

    const items = this._extractItems(xml, 'law');
    const results = items.slice(0, 3).map(item => ({
      lawId: this._extractTag(item, '법령일련번호') || this._extractTag(item, 'lawId'),
      lawName: this._extractTag(item, '법령명한글') || this._extractTag(item, 'lawNm') || lawName,
      lawType: this._extractTag(item, '법령구분명') || this._extractTag(item, 'lawType'),
      promulgationDate: this._extractTag(item, '공포일자') || this._extractTag(item, 'promDt'),
      enforcementDate: this._extractTag(item, '시행일자') || this._extractTag(item, 'enfcDt'),
    }));

    return { lawName, totalCnt, results };
  }

  /**
   * 법령 본문 (조항) 조회 — 법령 ID 기반으로 전체 조문 텍스트 가져오기
   * @param {string} lawId - 법령일련번호
   * @returns {Promise<string|null>} 조문 텍스트
   */
  async getLawText(lawId) {
    console.log(`[LawOpenAPI] 법령 본문 조회: ID=${lawId}`);
    const xml = await this._callAPI({
      target: 'law',
      type: 'XML',
      ID: lawId
    });

    if (!xml) return null;

    // 조문 추출
    const articles = this._extractItems(xml, '조문단위');
    if (articles.length === 0) return null;

    const articleTexts = articles.map(article => {
      const num = this._extractTag(article, '조문번호') || '';
      const title = this._extractTag(article, '조문제목') || '';
      const content = this._extractTag(article, '조문내용') || '';
      return `제${num}조 ${title}\n${content}`;
    });

    return articleTexts.join('\n\n');
  }

  /**
   * 판례 키워드 검색 — 키워드로 관련 판례 요지 목록 반환
   * @param {string} keyword - 검색 키워드 (예: "부당해고", "통상임금")
   * @param {number} limit - 최대 결과 수
   * @returns {Promise<Array>} [{ caseNo, caseName, courtName, judgementDate, summary }]
   */
  async searchPrecedents(keyword, limit = 3) {
    console.log(`[LawOpenAPI] 판례 검색: "${keyword}"`);
    const xml = await this._callAPI({
      target: 'prec',
      type: 'XML',
      query: keyword,
      display: String(limit)
    });

    if (!xml) return [];

    const totalCnt = parseInt(this._extractTag(xml, 'totalCnt') || '0', 10);
    if (totalCnt === 0) return [];

    const items = this._extractItems(xml, 'prec');
    return items.slice(0, limit).map(item => ({
      caseSerialNo: this._extractTag(item, '판례일련번호') || this._extractTag(item, 'precSeq'),
      caseNo: this._extractTag(item, '사건번호') || this._extractTag(item, 'caseNo'),
      caseName: this._extractTag(item, '사건명') || this._extractTag(item, 'caseNm'),
      courtName: this._extractTag(item, '법원명') || this._extractTag(item, 'courtNm'),
      judgementDate: this._extractTag(item, '선고일자') || this._extractTag(item, 'judgeDt'),
      caseType: this._extractTag(item, '사건종류명') || this._extractTag(item, 'caseType'),
    }));
  }

  /**
   * 판례 본문 조회 — 판례 일련번호로 판시사항/판결요지 가져오기
   * @param {string} precSeq - 판례일련번호
   * @returns {Promise<Object|null>} { caseNo, caseName, judgement, summary, refArticles }
   */
  async getPrecedentText(precSeq) {
    console.log(`[LawOpenAPI] 판례 본문 조회: ID=${precSeq}`);
    const xml = await this._callAPI({
      target: 'prec',
      type: 'XML',
      ID: precSeq
    });

    if (!xml) return null;

    return {
      caseNo: this._extractTag(xml, '사건번호') || this._extractTag(xml, 'caseNo'),
      caseName: this._extractTag(xml, '사건명') || this._extractTag(xml, 'caseNm'),
      courtName: this._extractTag(xml, '법원명') || this._extractTag(xml, 'courtNm'),
      judgementDate: this._extractTag(xml, '선고일자') || this._extractTag(xml, 'judgeDt'),
      judgementType: this._extractTag(xml, '선고') || this._extractTag(xml, 'judgeType'),
      judgement: this._extractTag(xml, '판시사항') || this._extractTag(xml, 'courtDc'),
      summary: this._extractTag(xml, '판결요지') || this._extractTag(xml, 'detlContents'),
      refArticles: this._extractTag(xml, '참조조문') || this._extractTag(xml, 'refArticle'),
      refCases: this._extractTag(xml, '참조판례') || this._extractTag(xml, 'refCase'),
    };
  }

  /**
   * 고용노동부 법령해석(행정해석) 검색
   * @param {string} keyword - 검색 키워드
   * @param {number} limit - 최대 결과 수
   * @returns {Promise<Array>}
   */
  async searchLaborInterpretations(keyword, limit = 3) {
    console.log(`[LawOpenAPI] 고용노동부 행정해석 검색: "${keyword}"`);
    const xml = await this._callAPI({
      target: 'expc',
      type: 'XML',
      query: keyword,
      display: String(limit),
      org: '고용노동부'
    });

    if (!xml) return [];

    const totalCnt = parseInt(this._extractTag(xml, 'totalCnt') || '0', 10);
    if (totalCnt === 0) {
      // org 파라미터 없이 재시도 (일반 법령해석)
      const xml2 = await this._callAPI({
        target: 'expc',
        type: 'XML',
        query: keyword,
        display: String(limit)
      });
      if (!xml2) return [];

      const cnt2 = parseInt(this._extractTag(xml2, 'totalCnt') || '0', 10);
      if (cnt2 === 0) return [];

      return this._parseInterpretations(xml2, limit);
    }

    return this._parseInterpretations(xml, limit);
  }

  _parseInterpretations(xml, limit) {
    const items = this._extractItems(xml, 'expc');
    return items.slice(0, limit).map(item => ({
      serialNo: this._extractTag(item, '법령해석례일련번호') || this._extractTag(item, 'expcSeq'),
      title: this._extractTag(item, '제목') || this._extractTag(item, 'expcTtl'),
      org: this._extractTag(item, '안건처리기관명') || this._extractTag(item, 'orgNm'),
      date: this._extractTag(item, '안건처리일자') || this._extractTag(item, 'expcDt'),
    }));
  }

  /**
   * 노동위원회 결정문 검색
   * @param {string} keyword - 검색 키워드
   * @param {number} limit - 최대 결과 수
   * @returns {Promise<Array>}
   */
  async searchLaborCommissionDecisions(keyword, limit = 3) {
    console.log(`[LawOpenAPI] 노동위원회 결정문 검색: "${keyword}"`);
    const xml = await this._callAPI({
      target: 'nwcdc',
      type: 'XML',
      query: keyword,
      display: String(limit)
    });

    if (!xml) return [];

    const totalCnt = parseInt(this._extractTag(xml, 'totalCnt') || '0', 10);
    if (totalCnt === 0) return [];

    const items = this._extractItems(xml, 'nwcdc');
    return items.slice(0, limit).map(item => ({
      serialNo: this._extractTag(item, '노동위원회결정문일련번호') || this._extractTag(item, 'nwcdcSeq'),
      title: this._extractTag(item, '사건명') || this._extractTag(item, 'caseNm'),
      decisionDate: this._extractTag(item, '재결일자') || this._extractTag(item, 'nwcdcDt'),
      committee: this._extractTag(item, '재결기관명') || this._extractTag(item, 'nwcdcOrg'),
      result: this._extractTag(item, '재결결과') || this._extractTag(item, 'nwcdcResult'),
    }));
  }

  // ==================== 핵심: 종합 근거자료 수집 ====================

  /**
   * 사용자 질문에서 법률 키워드 추출
   * @param {string} query - 사용자 질문
   * @returns {Object} { lawNames: [], keywords: [] }
   */
  extractLegalKeywords(query) {
    // 1. 명시적 법률명 추출 (예: "근로기준법", "최저임금법")
    const lawNameRegex = /([가-힣]+법)(?:\s|$|에|의|을|를|이|가|은|는|제|에서)/g;
    const rawLawNames = [];
    let match;
    while ((match = lawNameRegex.exec(query)) !== null) {
      rawLawNames.push(match[1]);
    }
    // 일반 단어 필터링 (1글자 법, "방법" 등 제외)
    const excludeWords = ['방법', '문법', '용법', '기법', '수법', '어법', '작법'];
    const lawNames = [...new Set(rawLawNames.filter(n => n.length >= 3 && !excludeWords.includes(n)))];

    // 2. 노무 관련 핵심 키워드 추출
    const laborTerms = [
      '부당해고', '해고', '정리해고', '권고사직', '부당노동행위',
      '통상임금', '퇴직금', '연차휴가', '연차수당', '야근수당', '초과근무',
      '임금체불', '체불임금', '최저임금', '주휴수당',
      '산업재해', '산재', '업무상재해', '출퇴근재해',
      '직장내괴롭힘', '직장내성희롱', '괴롭힘', '성희롱',
      '육아휴직', '출산휴가', '배우자출산휴가', '육아기근로시간단축',
      '비정규직', '파견근로', '기간제', '단시간근로',
      '근로계약', '취업규칙', '단체협약', '노동조합',
      '징계', '정직', '감봉', '전직', '전보',
      '노동위원회', '구제신청', '구제명령',
      '4대보험', '고용보험', '산재보험', '국민연금', '건강보험',
      '근로시간', '52시간', '유연근무', '재택근무', '선택근무',
    ];

    const keywords = laborTerms.filter(term => query.includes(term));

    // 3. 질문에서 일반 검색 키워드도 추출 (짧은 핵심어)
    if (keywords.length === 0) {
      // 노무 전문 키워드가 없으면, 명사 추출 시도
      const generalTerms = query
        .replace(/[?？!！.,。，、\s]+/g, ' ')
        .split(' ')
        .filter(w => w.length >= 2 && w.length <= 8);
      if (generalTerms.length > 0) {
        keywords.push(generalTerms.slice(0, 2).join(' '));
      }
    }

    return { lawNames, keywords };
  }

  /**
   * 종합 법적 근거자료 수집 (Pre-fetch RAG 핵심)
   * 사용자 질문에서 키워드를 추출하고, 병렬로 법령/판례/행정해석/노동위결정문을 가져옴
   * 
   * @param {string} query - 사용자 질문
   * @returns {Promise<Object>} { laws, precedents, interpretations, decisions, contextText }
   */
  async gatherLegalContext(query) {
    const startTime = Date.now();
    console.log(`\n📚 [LawOpenAPI] 공식 법적 근거 수집 시작...`);

    const { lawNames, keywords } = this.extractLegalKeywords(query);
    console.log(`   추출된 법률명: [${lawNames.join(', ')}]`);
    console.log(`   추출된 키워드: [${keywords.join(', ')}]`);

    // 검색할 키워드가 없으면 빈 결과 반환
    if (lawNames.length === 0 && keywords.length === 0) {
      console.log(`   ⏭️  검색 키워드 없음. 근거 수집 건너뜀.`);
      return { laws: [], precedents: [], interpretations: [], decisions: [], contextText: '' };
    }

    // 병렬 호출로 시간 단축
    const searchKeyword = keywords[0] || lawNames[0] || '';
    const promises = [];

    // 1) 법령 검색 (명시적 법률명이 있을 때)
    const lawPromises = lawNames.slice(0, 2).map(name => this.searchLaw(name));
    promises.push(Promise.allSettled(lawPromises));

    // 2) 판례 검색
    if (searchKeyword) {
      promises.push(this.searchPrecedents(searchKeyword, 3));
    } else {
      promises.push(Promise.resolve([]));
    }

    // 3) 행정해석 검색
    if (searchKeyword) {
      promises.push(this.searchLaborInterpretations(searchKeyword, 2));
    } else {
      promises.push(Promise.resolve([]));
    }

    // 4) 노동위원회 결정문 검색
    if (searchKeyword) {
      promises.push(this.searchLaborCommissionDecisions(searchKeyword, 2));
    } else {
      promises.push(Promise.resolve([]));
    }

    const [lawResults, precedents, interpretations, decisions] = await Promise.all(promises);

    // 법령 결과 정리
    const laws = [];
    if (Array.isArray(lawResults)) {
      for (const result of lawResults) {
        if (result.status === 'fulfilled' && result.value) {
          laws.push(result.value);
        }
      }
    }

    // 판례 본문 가져오기 (상위 2건만 — 응답 시간 제한)
    const precedentDetails = [];
    const precArray = Array.isArray(precedents) ? precedents : [];
    for (const prec of precArray.slice(0, 2)) {
      if (prec.caseSerialNo) {
        const detail = await this.getPrecedentText(prec.caseSerialNo);
        if (detail) {
          precedentDetails.push(detail);
        }
      }
    }

    // 컨텍스트 텍스트 생성
    const contextText = this._buildContextText(laws, precedentDetails, interpretations, decisions);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ [LawOpenAPI] 근거 수집 완료 (${elapsed}초)`);
    console.log(`   법령: ${laws.length}건, 판례: ${precedentDetails.length}건, 행정해석: ${(interpretations || []).length}건, 노동위: ${(decisions || []).length}건`);

    return {
      laws,
      precedents: precedentDetails,
      interpretations: interpretations || [],
      decisions: decisions || [],
      contextText,
      elapsedSec: parseFloat(elapsed)
    };
  }

  /**
   * 수집된 근거자료를 AI 프롬프트용 텍스트로 변환
   */
  _buildContextText(laws, precedents, interpretations, decisions) {
    const sections = [];

    // 법령 섹션
    if (laws.length > 0) {
      const lawTexts = laws.map(law => {
        const items = (law.results || []).map(r => 
          `  • ${r.lawName} (${r.lawType || '법률'}) — 시행일: ${r.enforcementDate || '미상'}`
        ).join('\n');
        return items;
      }).join('\n');

      sections.push(`■ 관련 법령 (국가법령정보센터 검색 결과)\n${lawTexts}`);
    }

    // 판례 섹션 (본문 포함)
    if (precedents.length > 0) {
      const precTexts = precedents.map(p => {
        let text = `  • ${p.courtName || '대법원'} ${p.caseNo || ''} (${p.judgementDate || ''})`;
        text += `\n    사건명: ${p.caseName || ''}`;
        if (p.judgement) {
          // HTML 태그 제거 및 길이 제한
          const cleanJudgement = p.judgement.replace(/<[^>]*>/g, '').substring(0, 500);
          text += `\n    [판시사항] ${cleanJudgement}`;
        }
        if (p.summary) {
          const cleanSummary = p.summary.replace(/<[^>]*>/g, '').substring(0, 500);
          text += `\n    [판결요지] ${cleanSummary}`;
        }
        if (p.refArticles) {
          text += `\n    [참조조문] ${p.refArticles.replace(/<[^>]*>/g, '')}`;
        }
        return text;
      }).join('\n\n');

      sections.push(`■ 관련 판례 (국가법령정보센터 제공)\n${precTexts}`);
    }

    // 행정해석 섹션
    if (interpretations && interpretations.length > 0) {
      const interpTexts = interpretations.map(i =>
        `  • ${i.title || '제목없음'} (${i.org || ''}, ${i.date || ''})`
      ).join('\n');

      sections.push(`■ 관련 행정해석\n${interpTexts}`);
    }

    // 노동위원회 결정문 섹션
    if (decisions && decisions.length > 0) {
      const decTexts = decisions.map(d =>
        `  • ${d.title || '제목없음'} — ${d.committee || ''} (${d.decisionDate || ''}) [${d.result || ''}]`
      ).join('\n');

      sections.push(`■ 노동위원회 결정문\n${decTexts}`);
    }

    if (sections.length === 0) return '';

    return `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[공식 법적 근거 — 국가법령정보센터 Open API 실시간 검색 결과]
아래 자료는 정부 공식 데이터입니다. 답변 시 반드시 아래 자료에 있는 
법령 조항과 판례만 인용하고, 여기에 없는 법조문이나 판례번호는 
절대 임의로 생성하지 마세요.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${sections.join('\n\n')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  }

  // ==================== Lv.1: 사후 검증 (기존 유지) ====================

  /**
   * 판례 번호 존재 여부 검증
   */
  async verifyPrecedent(caseNumber) {
    if (!this.apiKey) return true;

    try {
      const xml = await this._callAPI({
        target: 'prec',
        type: 'XML',
        query: caseNumber
      });

      if (!xml) return true; // API 에러 시 오탐지 방지

      const totalCnt = parseInt(this._extractTag(xml, 'totalCnt') || '0', 10);
      return totalCnt > 0;
    } catch (error) {
      console.error('[LawOpenAPI] 판례 검증 실패:', error.message);
      return true;
    }
  }

  /**
   * AI 답변에서 환각 판례 추출 및 검증
   */
  async checkHallucinations(text) {
    const caseRegex = /20[0-9]{2}[가-힣][0-9]+/g;
    const matches = [...new Set(text.match(caseRegex) || [])];

    const hallucinations = [];
    for (const caseNo of matches) {
      const isValid = await this.verifyPrecedent(caseNo);
      if (!isValid) {
        hallucinations.push(caseNo);
      }
    }

    return hallucinations;
  }
}

module.exports = new LawOpenAPIService();
