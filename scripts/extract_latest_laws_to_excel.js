/**
 * 최신 노동법령 추출 및 엑셀 변환 스크립트 (스트림 방식)
 * 
 * 변경사항:
 * - fs.readFileSync 대신 createReadStream 사용
 * - 메모리 효율적인 JSON 파싱 구현
 */

const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// 파일 경로 설정
const INPUT_FILE = path.join(__dirname, '../data/labor_laws/elabor_all_laws_complete_20260126_034427.json');
const OUTPUT_EXCEL = path.join(__dirname, '../latest_labor_laws.xlsx');
const OUTPUT_JSON = path.join(__dirname, '../data/labor_laws/latest_labor_laws.json');

// 오늘 날짜 (YYYY-MM-DD)
const today = new Date().toISOString().split('T')[0];

console.log('='.repeat(60));
console.log('📜 최신 노동법령 추출 및 엑셀 변환 (스트림 모드)');
console.log('='.repeat(60));
console.log(`기준일: ${today}`);
console.log(`입력 파일: ${INPUT_FILE}`);
console.log('');

async function processFile() {
    console.log('데이터 처리 시작 (스트림 방식)...');

    if (!fs.existsSync(INPUT_FILE)) {
        throw new Error(`입력 파일을 찾을 수 없습니다: ${INPUT_FILE}`);
    }

    const lawMap = new Map(); // Title -> Latest Law Object
    let futureCount = 0;
    let oldVersionCount = 0;
    let processedCount = 0;

    // 스트림 파서 상태
    let buffer = '';
    let depth = 0;
    let inString = false;
    let escape = false;

    const stream = fs.createReadStream(INPUT_FILE, { encoding: 'utf-8', highWaterMark: 64 * 1024 });

    for await (const chunk of stream) {
        for (let i = 0; i < chunk.length; i++) {
            const char = chunk[i];

            // 문자열 처리
            if (char === '"' && !escape) {
                inString = !inString;
            }
            if (char === '\\' && !escape) {
                escape = true;
            } else {
                escape = false; // escape is only valid for the immediately following character
            }

            if (!inString) {
                if (char === '{') {
                    if (depth === 0) {
                        buffer = '{'; // 객체 시작
                    } else {
                        buffer += char;
                    }
                    depth++;
                } else if (char === '}') {
                    depth--;
                    if (depth === 0) {
                        buffer += '}'; // 객체 끝
                        processObject(buffer);
                        buffer = '';
                    } else {
                        buffer += char;
                    }
                } else if (depth > 0) {
                    buffer += char;
                }
            } else if (depth > 0) {
                // 문자열 내부이면서 객체 내부인 경우
                buffer += char;
            }
        }
    }

    function processObject(jsonStr) {
        try {
            const law = JSON.parse(jsonStr);
            processedCount++;

            if (processedCount % 1000 === 0) {
                process.stdout.write(`\r처리 중... ${processedCount}개`);
            }

            const title = law.title || law.법령명칭;
            const dateStr = law.date || law.시행일자;

            if (!title || !dateStr) return;

            // 미래 시행 법령 제외
            if (dateStr > today) {
                futureCount++;
                return;
            }

            // 최신 버전 체크
            if (lawMap.has(title)) {
                const existingLaw = lawMap.get(title);
                const existingDate = existingLaw.date || existingLaw.시행일자;

                if (dateStr > existingDate) {
                    lawMap.set(title, law);
                    oldVersionCount++;
                } else {
                    oldVersionCount++;
                }
            } else {
                lawMap.set(title, law);
            }
        } catch (e) {
            // 파싱 실패는 무시 (대용량 스트림 처리 시 발생 가능)
            // console.warn('JSON parsing error:', e.message);
        }
    }

    console.log('\n');
    console.log(`📊 분석 결과:`);
    console.log(`   - 처리된 총 항목: ${processedCount}개`);
    console.log(`   - 미래 시행일 제외: ${futureCount}개`);
    console.log(`   - 구버전 제외: ${oldVersionCount}개`);
    console.log(`   - 최종 선별된 최신 법령: ${lawMap.size}개`);
    console.log('');

    // 3. 결과 저장 (Excel)
    console.log(`엑셀 파일 생성 중: ${OUTPUT_EXCEL}`);

    const latestLaws = Array.from(lawMap.values());

    if (latestLaws.length === 0) {
        console.log('⚠️ 선별된 데이터가 없습니다. 파서 로직이나 입력 데이터를 확인하세요.');
        // 빈 파일이라도 생성하여 오해 방지? 아니면 에러?
        // 빈 파일 생성은 의미 없으므로 skip
    } else {
        // 엑셀용 데이터 변환 (필요한 필드만 선택)
        const excelData = latestLaws.map(law => {
            // Excel 셀 글자수 제한 (32,767) 고려하여 내용 자르기
            let content = law.content || law.조문 || law.articles || '';
            if (content.length > 32000) {
                content = content.substring(0, 32000) + '... (Too long, check JSON for full content)';
            }

            return {
                '법령명': law.title || law.법령명칭,
                '시행일자': law.date || law.시행일자,
                '법령종류': law.type || law.법령종류 || '',
                '카테고리': law.category || '',
                '공포번호': law.pub_no || law.공포번호 || '',
                '법령내용': content // 내용 추가
            };
        });

        excelData.sort((a, b) => b.시행일자.localeCompare(a.시행일자));

        const workbook = xlsx.utils.book_new();
        const worksheet = xlsx.utils.json_to_sheet(excelData);
        xlsx.utils.book_append_sheet(workbook, worksheet, '최신법령목록');
        xlsx.writeFile(workbook, OUTPUT_EXCEL);

        console.log(`✅ 엑셀 저장 완료.`);

        // 4. 결과 저장 (JSON)
        console.log(`JSON 파일 생성 중: ${OUTPUT_JSON}`);
        fs.writeFileSync(OUTPUT_JSON, JSON.stringify(latestLaws, null, 2), 'utf-8');
        console.log(`✅ JSON 저장 완료.`);
    }
}

processFile().catch(err => console.error('Error:', err));
