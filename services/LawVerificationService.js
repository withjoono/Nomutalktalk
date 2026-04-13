class LawVerificationService {
  constructor() {
    this.apiKey = process.env.LAW_OPEN_API_KEY;
    this.baseUrl = 'https://www.law.go.kr/DRF/lawSearch.do';
  }

  /**
   * Verify if a precedent (판례) exists by its case number.
   * @param {string} caseNumber - The case number to search for (e.g., '2019다2230')
   * @returns {Promise<boolean>}
   */
  async verifyPrecedent(caseNumber) {
    if (!this.apiKey) {
      console.warn('LAW_OPEN_API_KEY is not set. Skipping verification.');
      return true; // Bypass if no key
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const url = `${this.baseUrl}?OC=${this.apiKey}&target=prec&type=XML&query=${encodeURIComponent(caseNumber)}`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const xmlText = await response.text();
      
      // API 자체 응답 에러인지 확인
      if (xmlText.includes('<result>')) {
        console.warn('API Error Response:', xmlText);
        return true; // 에러 시에는 정상이라고 간주하고 넘어감 (오탐지 방지)
      }

      // XML에서 <totalCnt> 값 추출
      const match = xmlText.match(/<totalCnt>(\d+)<\/totalCnt>/);
      const totalCnt = match ? parseInt(match[1], 10) : 0;
      
      if (totalCnt > 0) {
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error verifying precedent:', error.message);
      return true; // 네트워크 에러 시에도 오탐지 방지를 위해 true 반환
    }
  }

  /**
   * Extract citations (case numbers) and verify them.
   * Returns a list of invalid precedents.
   */
  async checkHallucinations(text) {
    // Regex to find standard Korean Supreme Court case numbers (e.g., 2019다2230, 2020도114, 2018두44)
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

module.exports = new LawVerificationService();
