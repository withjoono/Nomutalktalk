/**
 * 대용량 JSON 법령 데이터를 개별 텍스트 파일로 분할
 * JSON 파일을 스트리밍 방식으로 읽어서 각 법령을 별도 파일로 저장
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const INPUT_FILE = path.join(__dirname, '../data/labor_laws/elabor_all_laws_complete_20260126_034427.json');
const OUTPUT_DIR = path.join(__dirname, '../data/labor_laws/split');

// 출력 디렉토리 생성
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * 파일명으로 사용 가능한 문자열로 변환
 */
function sanitizeFileName(name) {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 100);
}

/**
 * 법령 데이터를 텍스트 파일로 저장
 */
function saveLawAsText(law, index) {
  try {
    const lawName = law.법령명칭 || law.name || law.title || `law_${index}`;
    const fileName = `${sanitizeFileName(lawName)}.txt`;
    const filePath = path.join(OUTPUT_DIR, fileName);

    let content = '';
    
    // 법령 기본 정보
    content += `==============================================\n`;
    content += `법령명: ${law.법령명칭 || law.name || ''}\n`;
    content += `법령종류: ${law.법령종류 || law.type || ''}\n`;
    content += `공포일자: ${law.공포일자 || law.promulgationDate || ''}\n`;
    content += `시행일자: ${law.시행일자 || law.enforcementDate || ''}\n`;
    content += `소관부처: ${law.소관부처명 || law.ministry || '고용노동부'}\n`;
    content += `==============================================\n\n`;

    // 법령 내용 (조문)
    if (law.조문 || law.articles || law.content) {
      const articles = law.조문 || law.articles || law.content;
      
      if (Array.isArray(articles)) {
        articles.forEach(article => {
          if (typeof article === 'object') {
            content += `\n【${article.조문번호 || article.number || ''}】\n`;
            content += `${article.조문내용 || article.content || ''}\n`;
          } else {
            content += `${article}\n`;
          }
        });
      } else if (typeof articles === 'string') {
        content += articles + '\n';
      } else {
        content += JSON.stringify(articles, null, 2) + '\n';
      }
    }

    // 전체 내용이 있으면 추가
    if (law.전문 || law.fullText) {
      content += `\n\n전문:\n${law.전문 || law.fullText}\n`;
    }

    // 기타 모든 필드 추가
    content += `\n\n원본 데이터:\n`;
    content += JSON.stringify(law, null, 2);

    fs.writeFileSync(filePath, content, 'utf-8');
    return fileName;
  } catch (error) {
    console.error(`법령 ${index} 저장 오류:`, error.message);
    return null;
  }
}

/**
 * 간단한 방식: 파일 전체를 청크 단위로 읽기
 */
async function processJsonFile() {
  console.log('📚 법령 데이터 분할 시작...');
  console.log(`입력: ${INPUT_FILE}`);
  console.log(`출력: ${OUTPUT_DIR}`);
  console.log('');

  try {
    // 파일 크기 확인
    const stats = fs.statSync(INPUT_FILE);
    const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`파일 크기: ${fileSizeMB} MB`);
    console.log('');

    // 스트리밍으로 읽기 시도
    console.log('스트리밍 방식으로 처리 중...');
    
    let buffer = '';
    let depth = 0;
    let currentObject = '';
    let objectCount = 0;
    let savedCount = 0;
    let inArray = false;

    const stream = fs.createReadStream(INPUT_FILE, { 
      encoding: 'utf-8',
      highWaterMark: 1024 * 1024 // 1MB 청크
    });

    for await (const chunk of stream) {
      buffer += chunk;
      
      // JSON 파싱 시도
      for (let i = 0; i < buffer.length; i++) {
        const char = buffer[i];
        
        if (char === '[') {
          depth++;
          inArray = true;
        } else if (char === ']') {
          depth--;
        } else if (char === '{') {
          depth++;
          if (depth === 2 && inArray) {
            currentObject = char;
          } else if (depth > 0) {
            currentObject += char;
          }
        } else if (char === '}') {
          currentObject += char;
          depth--;
          
          if (depth === 1 && inArray) {
            // 객체 완성
            try {
              const law = JSON.parse(currentObject);
              objectCount++;
              
              const fileName = saveLawAsText(law, objectCount);
              if (fileName) {
                savedCount++;
                if (savedCount % 10 === 0) {
                  console.log(`진행: ${savedCount}개 저장됨...`);
                }
              }
            } catch (parseError) {
              console.error(`객체 ${objectCount} 파싱 오류:`, parseError.message.substring(0, 100));
            }
            currentObject = '';
          }
        } else if (depth > 1) {
          currentObject += char;
        }
      }
      
      buffer = ''; // 버퍼 초기화
    }

    console.log('');
    console.log(`✅ 완료: ${savedCount}개 법령 파일 생성`);
    console.log(`📁 저장 위치: ${OUTPUT_DIR}`);
    
    return savedCount;

  } catch (error) {
    console.error('❌ 처리 중 오류:', error.message);
    console.error('');
    console.error('대안: Python으로 JSON을 분할하거나, 원본 크롤러에서 개별 파일로 저장하세요.');
    throw error;
  }
}

/**
 * CLI 실행
 */
async function main() {
  try {
    if (!fs.existsSync(INPUT_FILE)) {
      console.error(`❌ 입력 파일을 찾을 수 없습니다: ${INPUT_FILE}`);
      process.exit(1);
    }

    const count = await processJsonFile();
    
    console.log('');
    console.log('다음 단계:');
    console.log('  node scripts/import_labor_data.js laws');
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('실행 중 오류:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { processJsonFile, saveLawAsText };
