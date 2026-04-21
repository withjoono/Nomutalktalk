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

  /**
   * 행정심판례 검색 (admcase)
   * @param {string} keyword
   * @param {number} limit
   */
  async searchAdminAppeal(keyword, limit = 3) {
    console.log(`[LawOpenAPI] 행정심판례 검색: "${keyword}"`);
    const xml = await this._callAPI({
      target: 'admcase',
      type: 'XML',
      query: keyword,
      display: String(limit)
    });
    if (!xml) return [];
    const totalCnt = parseInt(this._extractTag(xml, 'totalCnt') || '0', 10);
    if (totalCnt === 0) return [];
    const items = this._extractItems(xml, 'admcase');
    return items.slice(0, limit).map(item => ({
      serialNo: this._extractTag(item, '행정심판례일련번호') || this._extractTag(item, 'admcaseSeq'),
      title: this._extractTag(item, '사건명') || this._extractTag(item, 'caseNm'),
      decisionDate: this._extractTag(item, '재결일자') || this._extractTag(item, 'decDt'),
      org: this._extractTag(item, '위원회명') || this._extractTag(item, 'orgNm'),
      result: this._extractTag(item, '재결결과') || this._extractTag(item, 'decResult'),
    }));
  }

  /**
   * 행정기관별 심판 결정 검색 (dcsn) — org 파라미터로 기관 필터
   * @param {string} keyword
   * @param {string} org  예: '고용보험심사위원회', '산업재해보상보험재심사위원회', '국가인권위원회'
   * @param {number} limit
   */
  async searchCommitteeDecision(keyword, org, limit = 3) {
    console.log(`[LawOpenAPI] ${org} 결정 검색: "${keyword}"`);
    const xml = await this._callAPI({
      target: 'dcsn',
      type: 'XML',
      query: keyword,
      display: String(limit),
      org
    });
    if (!xml) return [];
    const totalCnt = parseInt(this._extractTag(xml, 'totalCnt') || '0', 10);
    if (totalCnt === 0) return [];
    const items = this._extractItems(xml, 'dcsn');
    return items.slice(0, limit).map(item => ({
      serialNo: this._extractTag(item, '결정례일련번호') || this._extractTag(item, 'dcsnSeq'),
      title: this._extractTag(item, '사건명') || this._extractTag(item, 'caseNm'),
      decisionDate: this._extractTag(item, '결정일자') || this._extractTag(item, 'dcsnDt'),
      org: this._extractTag(item, '결정기관명') || org,
      result: this._extractTag(item, '결정결과') || this._extractTag(item, 'dcsnResult'),
    }));
  }

  /**
   * 지능형 법령검색 API — 키워드 → 연관 법령 목록 반환
   * @param {string} keyword
   * @returns {Promise<Array>} [{ lawName, lawId, relevance }]
   */
  async searchRelatedLaws(keyword) {
    console.log(`[LawOpenAPI] 지능형 법령검색: "${keyword}"`);
    // 지능형 검색은 별도 엔드포인트 사용
    const baseUrl = 'https://www.law.go.kr/DRF/lawSearch.do';
    const query = new URLSearchParams({
      OC: this.apiKey,
      target: 'law',
      type: 'XML',
      query: keyword,
      display: '5',
      search: '2'  // 전문 검색 모드
    }).toString();
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), this.timeout);
      const resp = await fetch(`${baseUrl}?${query}`, {
        headers: { 'User-Agent': 'NomuTalk/1.0' },
        signal: controller.signal
      });
      clearTimeout(tid);
      const xml = await resp.text();
      const items = this._extractItems(xml, 'law');
      return items.slice(0, 5).map(item => ({
        lawId: this._extractTag(item, '법령일련번호'),
        lawName: this._extractTag(item, '법령명한글') || '',
        lawType: this._extractTag(item, '법령구분명') || '',
        enforcementDate: this._extractTag(item, '시행일자') || '',
      })).filter(i => i.lawName);
    } catch (e) {
      console.warn('[LawOpenAPI] 지능형 법령검색 실패:', e.message);
      return [];
    }
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

  // ==================== Lv.3: AI 키워드 + Open API + AI 재평가 ====================

  /**
   * AI 키워드 추출 + Open API 대량 검색 + AI 관련성·중요도·기간 재평가
   * 
   * 1단계: AI가 사건에서 8~12개의 풍부한 법률 키워드 생성
   * 2단계: Open API에서 키워드당 최대 8건씩 대량 검색 (법령, 판례, 해석)
   * 3단계: AI가 전체 결과를 관련성·중요도·기간 3가지 기준으로 재평가 및 정렬
   * 
   * @param {string} description - 사건 설명
   * @returns {Promise<Object>} { allNodes, laws, precedents, interpretations, elapsedSec }
   */
  async hybridLegalSearch(description) {
    const startTime = Date.now();
    console.log('\n🔎 [AI+API Search] 시작');

    const { GoogleGenAI } = require('@google/genai');
    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // ═══════════════════════════════════════════════
    // 1단계: AI가 풍부한 키워드 생성
    // ═══════════════════════════════════════════════
    console.log('\n📝 [1단계] AI 키워드 생성...');
    let searchPlan;
    try {
      const planResp = await genai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: `당신은 한국 노동법 전문가입니다. 아래 사건을 분석하여 국가법령정보센터에서 검색할 키워드를 생성하세요.

사건: ${description.substring(0, 2000)}

규칙:
- lawNames: 관련 법률명 (예: "근로기준법", "근로자퇴직급여 보장법") 최대 5개
- precKeywords: 판례 검색용 구체적 법률 용어. 일반 용어와 전문 용어를 모두 포함.
  (예: "부당해고", "해고무효확인", "해고예고수당청구", "부당해고구제재심판정취소")
  최소 6개, 최대 12개
- interpKeywords: 행정해석 및 법령해석례 검색용 키워드 최대 4개
- decisionKeywords: 노동위원회/심사위원회 결정 검색용 키워드 최대 4개 (예: "부당해고 구제신청", "산재 업무상재해")
- eventDate: 사건 발생 추정 시점 (있으면 "2024" 등, 모르면 null)
- issues: 핵심 쟁점 요약 (사건의 법적 쟁점을 2~3개 문장으로)

JSON: {
  "lawNames": ["근로기준법"],
  "precKeywords": ["부당해고", "해고무효확인"],
  "interpKeywords": ["해고예고"],
  "decisionKeywords": ["부당해고 구제신청"],
  "eventDate": null,
  "issues": "본 사건은 부당해고와 퇴직금 미지급이 핵심 쟁점이다."
}` }] }],
        config: { responseMimeType: 'application/json' }
      });
      searchPlan = JSON.parse(planResp.text || '{}');
    } catch (err) {
      console.warn('[1단계] AI 키워드 생성 실패, 기본 추출 사용:', err.message);
      const extracted = this.extractLegalKeywords(description);
      searchPlan = {
        lawNames: extracted.lawNames || [],
        precKeywords: extracted.keywords || [],
        interpKeywords: extracted.keywords?.slice(0, 3) || [],
        decisionKeywords: extracted.keywords?.slice(0, 2) || [],
        eventDate: null,
        issues: ''
      };
    }

    const lawNames = (searchPlan.lawNames || []).slice(0, 5);
    const precKeywords = (searchPlan.precKeywords || []).slice(0, 12);
    const interpKeywords = (searchPlan.interpKeywords || []).slice(0, 4);
    const decisionKeywords = (searchPlan.decisionKeywords || []).slice(0, 4);
    const eventDate = searchPlan.eventDate || null;
    const issuesSummary = searchPlan.issues || '';

    console.log(`  법률: [${lawNames.join(', ')}]`);
    console.log(`  판례 키워드 (${precKeywords.length}개): [${precKeywords.join(', ')}]`);
    console.log(`  해석 키워드: [${interpKeywords.join(', ')}]`);
    console.log(`  결정 키워드: [${decisionKeywords.join(', ')}]`);
    if (eventDate) console.log(`  사건 시점: ${eventDate}`);

    // ═══════════════════════════════════════════════
    // 2단계: Open API 대량 검색 (7개 소스 병렬)
    // ═══════════════════════════════════════════════
    console.log('\n🔍 [2단계] Open API 멀티소스 병렬 검색 (7개 소스)...');
    const rawResults = { laws: [], precedents: [], interpretations: [], decisions: [] };
    const seenIds = new Set();

    // 1) 법령 검색 + 지능형 법령 검색
    const lawPromises = [
      ...lawNames.map(name =>
        this.searchLaw(name).then(r => ({ type: 'law', data: r })).catch(() => null)
      ),
      // 지능형 법령검색 (첫 번째 precKeyword로)
      ...(precKeywords.slice(0, 2).map(kw =>
        this.searchRelatedLaws(kw).then(r => ({ type: 'law_related', data: r })).catch(() => null)
      ))
    ];

    // 2) 판례 검색 — 키워드당 8건
    const precPromises = precKeywords.map(kw =>
      this.searchPrecedents(kw, 8).then(r => ({ type: 'prec', data: r, kw })).catch(() => null)
    );

    // 3) 행정해석 + 고용노동부 법령해석례 검색
    const interpPromises = interpKeywords.map(kw =>
      this.searchLaborInterpretations(kw, 5).then(r => ({ type: 'interp', data: r })).catch(() => null)
    );

    // 4) 노무 관련 결정문 검색 (5개 기관 병렬)
    const decisionOrgs = [
      { org: '노동위원회', useMethod: 'nwcm' },
      { org: '고용보험심사위원회', useMethod: 'dcsn' },
      { org: '산업재해보상보험재심사위원회', useMethod: 'dcsn' },
      { org: '국가인권위원회', useMethod: 'dcsn' },
    ];
    const decisionPromises = decisionKeywords.flatMap(kw =>
      [
        // 노동위원회는 전용 메서드
        this.searchLaborCommissionDecisions(kw, 4).then(r => ({ type: 'decision', data: r, org: '노동위원회' })).catch(() => null),
        // 나머지 3개 기관은 dcsn
        ...decisionOrgs.slice(1).map(o =>
          this.searchCommitteeDecision(kw, o.org, 3).then(r => ({ type: 'decision', data: r, org: o.org })).catch(() => null)
        ),
        // 행정심판례
        this.searchAdminAppeal(kw, 3).then(r => ({ type: 'admcase', data: r })).catch(() => null),
      ]
    );

    const allPromises = [...lawPromises, ...precPromises, ...interpPromises, ...decisionPromises];
    const results = await Promise.allSettled(allPromises);

    for (const result of results) {
      if (result.status !== 'fulfilled' || !result.value) continue;
      const { type, data, org } = result.value;

      if ((type === 'law' || type === 'law_related') && data) {
        const lawList = type === 'law' ? (data.results || []) : (Array.isArray(data) ? data : []);
        for (const law of lawList) {
          const key = law.lawName;
          if (!key || seenIds.has(`law:${key}`)) continue;
          seenIds.add(`law:${key}`);
          rawResults.laws.push({
            title: key,
            lawType: law.lawType || '',
            enforcementDate: law.enforcementDate || '',
            lawId: law.lawId || ''
          });
        }
      }

      if (type === 'prec' && Array.isArray(data)) {
        for (const prec of data) {
          const key = prec.caseSerialNo || prec.caseNo;
          if (!key || seenIds.has(`prec:${key}`)) continue;
          seenIds.add(`prec:${key}`);
          rawResults.precedents.push({
            caseNo: prec.caseNo || '',
            caseName: prec.caseName || '',
            courtName: prec.courtName || '',
            judgementDate: prec.judgementDate || '',
            caseSerialNo: prec.caseSerialNo || '',
            caseType: prec.caseType || ''
          });
        }
      }

      if (type === 'interp' && Array.isArray(data)) {
        for (const interp of data) {
          const key = interp.serialNo || interp.title;
          if (!key || seenIds.has(`interp:${key}`)) continue;
          seenIds.add(`interp:${key}`);
          rawResults.interpretations.push(interp);
        }
      }

      // ★ 새로 추가: 결정문 (노동위원회, 고용보험심사위, 산재재심사위, 국가인권위)
      if ((type === 'decision' || type === 'admcase') && Array.isArray(data)) {
        for (const dec of data) {
          const key = dec.serialNo || dec.title;
          if (!key || seenIds.has(`dec:${key}`)) continue;
          seenIds.add(`dec:${key}`);
          rawResults.decisions.push({
            ...dec,
            org: org || dec.org || (type === 'admcase' ? '행정심판위원회' : '위원회'),
            sourceType: type
          });
        }
      }
    }

    console.log(`  수집 완료: 법령 ${rawResults.laws.length}, 판례 ${rawResults.precedents.length}, 해석 ${rawResults.interpretations.length}, 결정문 ${rawResults.decisions.length}`);

    // 판례 본문 조회 (상위 10건만, 병렬 처리)
    const precWithText = [];
    const topPrecs = rawResults.precedents.slice(0, 10);
    const textPromises = topPrecs.map(async (prec) => {
      if (!prec.caseSerialNo) return { ...prec, judgement: '', summary: '' };
      try {
        const detail = await this.getPrecedentText(prec.caseSerialNo);
        if (detail) {
          return {
            ...prec,
            judgement: (detail.judgement || '').replace(/<[^>]*>/g, '').substring(0, 300),
            summary: (detail.summary || '').replace(/<[^>]*>/g, '').substring(0, 300),
            refArticles: (detail.refArticles || '').replace(/<[^>]*>/g, '')
          };
        }
      } catch {}
      return { ...prec, judgement: '', summary: '' };
    });
    const precTexts = await Promise.allSettled(textPromises);
    for (const r of precTexts) {
      if (r.status === 'fulfilled') precWithText.push(r.value);
    }

    // ═══════════════════════════════════════════════
    // 3단계: AI가 관련성·중요도·기간 3가지로 재평가
    // ═══════════════════════════════════════════════
    console.log('\n🧠 [3단계] AI 관련성·중요도·기간 재평가...');
    let rankedNodes = [];
    try {
      const rankPrompt = `당신은 한국 노동법 전문가입니다. 아래 사건에 대해, 검색된 법적 자료를 3가지 기준으로 평가하세요.

【사건 내용】
${description.substring(0, 1500)}

【핵심 쟁점】
${issuesSummary}
${eventDate ? `【사건 추정 시점】 ${eventDate}` : ''}

【검색된 법령 (${rawResults.laws.length}건)】
${rawResults.laws.map((l, i) => `${i+1}. ${l.title} (${l.lawType}, 시행일: ${l.enforcementDate})`).join('\n') || '없음'}

【검색된 판례 (${precWithText.length}건)】
${precWithText.map((p, i) => `${i+1}. ${p.courtName} ${p.caseNo} (${p.judgementDate})
   사건명: ${p.caseName}
   ${p.judgement ? `판시: ${p.judgement.substring(0, 150)}...` : ''}
   ${p.summary ? `요지: ${p.summary.substring(0, 150)}...` : ''}`).join('\n') || '없음'}

【검색된 행정해석 (${rawResults.interpretations.length}건)】
${rawResults.interpretations.map((it, i) => `${i+1}. ${it.title} (${it.org || ''}, ${it.date || ''})`).join('\n') || '없음'}

【검색된 결정문 (${rawResults.decisions.length}건) — 노동위원회/심사위원회/행정심판】
${rawResults.decisions.map((d, i) => `${i+1}. [${d.org}] ${d.title} (${d.decisionDate || ''}) — ${d.result || ''}`).join('\n') || '없음'}

【평가 기준】
각 항목을 아래 3가지 기준으로 1~10점 평가:
1. relevance (관련성): 이 사건의 쟁점과 얼마나 직접적으로 관련되는가
2. importance (중요도): 법적으로 얼마나 중요한 자료인가 (대법원 전원합의체 > 하급심, 노동위원회결정/심사위결정 > 행정심판)
3. recency (최신성): 최근 판례일수록, 현행 법령일수록 높은 점수${eventDate ? ` (특히 ${eventDate}년 전후의 판례 우선)` : ''}

총점 = relevance×0.5 + importance×0.3 + recency×0.2

🚨【절대 규칙】🚨
- 반드시 위에서 제시된 【검색된 법령】, 【검색된 판례】, 【검색된 행정해석】, 【검색된 결정문】 목록에 있는 항목만 선택하세요!
- 목록에 없는 번호나 사건(예: 92다33319)을 임의로 지어내면(환각) 절대 안 됩니다!!
- "title" 값은 위에서 제공된 텍스트의 제목 양식과 동일해야 합니다. (예: "대법원 2011다42324", "[노동위원회] 중앙2020부해123")

응답: 총점 6.0 이상인 것만 포함. 최대 20건. 총점 내림차순 정렬.

JSON:
{
  "ranked": [
    {
      "title": "법령·판례·해석·결정 제목",
      "type": "law|precedent|interpretation|decision",
      "detail": "이 사건과의 관련성 설명 (2~3문장)",
      "relevance": 9,
      "importance": 8,
      "recency": 7,
      "totalScore": 8.5
    }
  ]
}`;

      const rankResp = await genai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: [{ role: 'user', parts: [{ text: rankPrompt }] }],
        config: { responseMimeType: 'application/json' }
      });

      const rankData = JSON.parse(rankResp.text || '{}');

      // ──────────────────────────────────────────
      // 환각(Hallucination) 필터링: 원본에 없는 건 무조건 버림
      const validTitles = [
        ...rawResults.laws.map(l => l.title),
        ...precWithText.map(p => `${p.courtName || '대법원'} ${p.caseNo}`.trim()),
        ...rawResults.interpretations.map(it => it.title),
        ...rawResults.decisions.map(d => `[${d.org}] ${d.title}`)
      ];

      const validTitlesNoSpace = validTitles.map(t => t.replace(/\s+/g, ''));

      rankedNodes = (rankData.ranked || [])
        .filter(item => {
          if (!item.title) return false;
          const cleanTitle = item.title.replace(/\s+/g, '');
          // 유효한 원본 제목과 느슨하게 일치하는지 확인
          const isValid = validTitlesNoSpace.some(vt => 
            vt === cleanTitle || cleanTitle.includes(vt) || vt.includes(cleanTitle)
          );
          if (!isValid) {
            console.warn(`[AI 재평가] ❌ 환각 데이터 제거됨 (원본에 없음): ${item.title}`);
          }
          return isValid;
        })
        .map(item => ({
          title: item.title,
          type: item.type || 'law',
          detail: item.detail || '',
          source: 'api_ranked',
          val: Math.round(item.totalScore * 1.5 + 2), // 6~15 → 11~24
          relevance: item.relevance,
          importance: item.importance,
          recency: item.recency,
          totalScore: item.totalScore
        }));

      console.log(`  평가 완료: ${rankedNodes.length}건 유효 (총점 6.0 이상, 환각 필터 통과)`);
      for (const n of rankedNodes.slice(0, 5)) {
        console.log(`    ${n.totalScore.toFixed(1)}점 | ${n.type} | ${n.title}`);
      }
    } catch (err) {
      console.warn('[3단계] AI 재평가 실패, 원본 결과 사용:', err.message);
      // fallback: 재평가 실패 시 원본 결과 그대로 사용
      for (const law of rawResults.laws) {
        rankedNodes.push({ title: law.title, type: 'law', detail: `시행일: ${law.enforcementDate}`, source: 'api_raw', val: 13 });
      }
      for (const prec of precWithText.slice(0, 8)) {
        const title = `${prec.courtName || '대법원'} ${prec.caseNo} 판결`;
        const detail = [
          prec.judgement ? `[판시] ${prec.judgement.substring(0, 200)}` : '',
          prec.summary ? `[요지] ${prec.summary.substring(0, 200)}` : ''
        ].filter(Boolean).join('\n');
        rankedNodes.push({ title, type: 'precedent', detail, source: 'api_raw', val: 12 });
      }
      for (const interp of rawResults.interpretations.slice(0, 5)) {
        rankedNodes.push({ title: interp.title, type: 'interpretation', detail: `${interp.org || ''} (${interp.date || ''})`, source: 'api_raw', val: 10 });
      }
    }

    // ──── 결과 종합 ────
    const allNodes = rankedNodes;
    const laws = allNodes.filter(n => n.type === 'law');
    const precedents = allNodes.filter(n => n.type === 'precedent');
    const interpretations = allNodes.filter(n => n.type === 'interpretation');
    const decisions = allNodes.filter(n => n.type === 'decision');

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ [AI+API Search 7소스] 완료 (${elapsed}초)`);
    console.log(`   법령 ${laws.length}, 판례 ${precedents.length}, 해석 ${interpretations.length}, 결정문 ${decisions.length}건`);
    console.log(`   총 ${allNodes.length}건 (원본: 법령 ${rawResults.laws.length} + 판례 ${rawResults.precedents.length} + 해석 ${rawResults.interpretations.length} + 결정문 ${rawResults.decisions.length})`);

    return {
      allNodes,
      laws,
      precedents,
      interpretations,
      decisions,
      rawCounts: {
        laws: rawResults.laws.length,
        precedents: rawResults.precedents.length,
        interpretations: rawResults.interpretations.length,
        decisions: rawResults.decisions.length
      },
      elapsedSec: parseFloat(elapsed)
    };
  }



  // ==================== Lv.1: 사후 검증 ====================

  /**
   * 판례 번호 존재 여부 검증 (정확한 사건번호 매칭 — nb 파라미터 사용)
   * @param {string} caseNumber - 사건번호 (예: '2009다62558')
   * @returns {Promise<boolean>} 존재 여부
   */
  async verifyPrecedent(caseNumber) {
    if (!this.apiKey) return true;

    try {
      // nb 파라미터로 정확한 사건번호 검색 (keyword search가 아닌 exact match)
      const xml = await this._callAPI({
        target: 'prec',
        type: 'XML',
        nb: caseNumber
      });

      if (!xml) return true; // API 에러 시 오탐지 방지 (benefit of doubt)

      const totalCnt = parseInt(this._extractTag(xml, 'totalCnt') || '0', 10);
      if (totalCnt > 0) {
        console.log(`  ✅ [검증] 판례 확인됨: ${caseNumber}`);
        return true;
      }

      // nb로 못 찾으면 keyword fallback 한 번 더 시도
      const xml2 = await this._callAPI({
        target: 'prec',
        type: 'XML',
        search: '2',
        query: caseNumber
      });

      if (!xml2) return true;

      const totalCnt2 = parseInt(this._extractTag(xml2, 'totalCnt') || '0', 10);
      if (totalCnt2 > 0) {
        console.log(`  ✅ [검증] 판례 확인됨 (keyword fallback): ${caseNumber}`);
        return true;
      }

      console.warn(`  ❌ [검증] 존재하지 않는 판례: ${caseNumber}`);
      return false;
    } catch (error) {
      console.error('[LawOpenAPI] 판례 검증 실패:', error.message);
      return true; // 에러 시 benefit of doubt
    }
  }

  /**
   * 법령 조문 존재 여부 검증
   * 법령명으로 검색하여 해당 법령이 실제 존재하는지 확인
   * @param {string} title - 법령 인용 제목 (예: '근로기준법 제23조 제1항')
   * @returns {Promise<boolean>} 존재 여부
   */
  async verifyLawArticle(title) {
    if (!this.apiKey) return true;

    try {
      // 법령명 추출 (예: "근로기준법 제23조 제1항" → "근로기준법")
      const lawNameMatch = title.match(/([가-힣]+(?:법|령|규칙|규정|조례))/); 
      if (!lawNameMatch) return true; // 법령명 패턴이 없으면 skip

      const lawName = lawNameMatch[1];

      const xml = await this._callAPI({
        target: 'law',
        type: 'XML',
        query: lawName,
        display: '1'
      });

      if (!xml) return true;

      const totalCnt = parseInt(this._extractTag(xml, 'totalCnt') || '0', 10);
      if (totalCnt > 0) {
        console.log(`  ✅ [검증] 법령 확인됨: ${lawName}`);
        return true;
      }

      console.warn(`  ❌ [검증] 존재하지 않는 법령: ${lawName} (원문: ${title})`);
      return false;
    } catch (error) {
      console.error('[LawOpenAPI] 법령 검증 실패:', error.message);
      return true;
    }
  }

  /**
   * 인용 목록 일괄 검증 + 미검증 항목 제거
   * Gemini fallback 경로에서 생성된 법령/판례를 그래프에 추가하기 전에 호출
   * 
   * @param {Array<{title: string, type: string}>} citations - 검증할 인용 목록 
   * @returns {Promise<{verified: Array, removed: Array}>} 검증된 것과 제거된 것
   */
  async verifyAndFilterCitations(citations) {
    if (!this.apiKey || !Array.isArray(citations) || citations.length === 0) {
      return { verified: citations || [], removed: [] };
    }

    console.log(`\n🔍 [LawOpenAPI] 인용 검증 시작: ${citations.length}건`);
    const verified = [];
    const removed = [];

    // 병렬 처리 (최대 4건 동시 — API rate limit 고려)
    const BATCH_SIZE = 4;
    for (let i = 0; i < citations.length; i += BATCH_SIZE) {
      const batch = citations.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(batch.map(async (cit) => {
        const type = cit.type || this._inferCitationType(cit.title);

        if (type === 'precedent') {
          // 판례: 사건번호 추출 후 검증
          const caseNoMatch = cit.title.match(/(\d{4}[가-힣]+\d+)/);
          if (!caseNoMatch) return { cit, valid: true }; // 패턴 없으면 skip
          const isValid = await this.verifyPrecedent(caseNoMatch[1]);
          return { cit, valid: isValid };

        } else if (type === 'law') {
          // 법령: 법령명 존재 여부 검증
          const isValid = await this.verifyLawArticle(cit.title);
          return { cit, valid: isValid };

        } else {
          // 행정해석, 노동위 결정 등은 검증 skip (API 제한)
          return { cit, valid: true };
        }
      }));

      for (const result of results) {
        if (result.status === 'fulfilled') {
          if (result.value.valid) {
            verified.push(result.value.cit);
          } else {
            removed.push(result.value.cit);
          }
        } else {
          // Promise rejected → benefit of doubt
          verified.push(batch[results.indexOf(result)]);
        }
      }
    }

    console.log(`✅ [LawOpenAPI] 인용 검증 완료: ${verified.length}건 통과, ${removed.length}건 제거`);
    if (removed.length > 0) {
      console.log(`   제거된 인용:`);
      removed.forEach(r => console.log(`     ❌ ${r.title}`));
    }

    return { verified, removed };
  }

  /**
   * 제목으로 인용 유형 추론
   */
  _inferCitationType(title) {
    if (!title) return 'unknown';
    if (/판결|선고|대법|\d{4}[가-힣]+\d+/.test(title)) return 'precedent';
    if (/법|령|규칙|규정|조례/.test(title) && /제\d+조/.test(title)) return 'law';
    if (/해석|지침|회시|고용노동부/.test(title)) return 'interpretation';
    if (/노동위|결정/.test(title)) return 'decision';
    return 'unknown';
  }

  /**
   * AI 답변에서 환각 판례 추출 및 검증
   */
  async checkHallucinations(text) {
    const caseRegex = /\d{4}[가-힣]+\d+/g;
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
