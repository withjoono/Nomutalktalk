'use client';

import React, { useState, useEffect } from 'react';
import styles from './LaborAITabs.module.css';
import {
    askQuestion,
    searchSimilarCases,
    searchLawArticle,
    consultWithTemplate,
    getCategories,
    checkHealth,
    Category
} from '@/lib/api';

type TabType = 'query' | 'cases' | 'law' | 'template' | 'categories';

const TEMPLATE_PARAMS: Record<string, { name: string; label: string; placeholder: string }[]> = {
    dismissal: [
        { name: 'employeeType', label: '근로자 유형', placeholder: '예: 정규직, 계약직' },
        { name: 'workPeriod', label: '근무 기간', placeholder: '예: 3년' },
        { name: 'dismissalReason', label: '해고 사유', placeholder: '예: 업무태만' },
        { name: 'procedure', label: '해고 절차', placeholder: '예: 구두 통보' }
    ],
    wages: [
        { name: 'wageType', label: '임금 유형', placeholder: '예: 기본급, 수당' },
        { name: 'issue', label: '쟁점 사항', placeholder: '예: 최저임금 미달' },
        { name: 'workType', label: '근로 형태', placeholder: '예: 정규직, 시간제' }
    ],
    worktime: [
        { name: 'workType', label: '근로 형태', placeholder: '예: 일반 근로, 교대제' },
        { name: 'workHours', label: '근로 시간', placeholder: '예: 주 50시간' },
        { name: 'issue', label: '쟁점 사항', placeholder: '예: 연장수당 미지급' }
    ],
    leave: [
        { name: 'leaveType', label: '휴가 유형', placeholder: '예: 연차, 출산휴가' },
        { name: 'workPeriod', label: '근무 기간', placeholder: '예: 2년' },
        { name: 'issue', label: '쟁점 사항', placeholder: '예: 연차 사용 거부' }
    ]
};

const CATEGORY_OPTIONS = [
    { value: '', label: '전체 카테고리' },
    { value: '근로계약', label: '근로계약' },
    { value: '임금', label: '임금' },
    { value: '근로시간', label: '근로시간' },
    { value: '휴가휴직', label: '휴가휴직' },
    { value: '해고징계', label: '해고징계' },
    { value: '산재보험', label: '산재보험' },
    { value: '고용보험', label: '고용보험' },
    { value: '차별', label: '차별' },
    { value: '노동조합', label: '노동조합' },
    { value: '안전보건', label: '안전보건' }
];

export default function LaborAITabs() {
    const [activeTab, setActiveTab] = useState<TabType>('query');
    const [isOnline, setIsOnline] = useState(false);
    const [categories, setCategories] = useState<Category[]>([]);

    // Query tab state
    const [queryInput, setQueryInput] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [includeCases, setIncludeCases] = useState(true);
    const [includeInterpretations, setIncludeInterpretations] = useState(true);
    const [queryResult, setQueryResult] = useState('');
    const [queryLoading, setQueryLoading] = useState(false);
    const [queryError, setQueryError] = useState('');

    // Cases tab state
    const [caseDescription, setCaseDescription] = useState('');
    const [casesResult, setCasesResult] = useState('');
    const [casesLoading, setCasesLoading] = useState(false);
    const [casesError, setCasesError] = useState('');

    // Law tab state
    const [lawName, setLawName] = useState('');
    const [lawArticle, setLawArticle] = useState('');
    const [lawResult, setLawResult] = useState('');
    const [lawLoading, setLawLoading] = useState(false);
    const [lawError, setLawError] = useState('');

    // Template tab state
    const [templateType, setTemplateType] = useState('dismissal');
    const [templateParams, setTemplateParams] = useState<Record<string, string>>({});
    const [templateResult, setTemplateResult] = useState('');
    const [templateLoading, setTemplateLoading] = useState(false);
    const [templateError, setTemplateError] = useState('');

    useEffect(() => {
        checkHealth().then(setIsOnline);
        getCategories().then(setCategories).catch(console.error);
    }, []);

    // Query handlers
    const handleAskQuestion = async () => {
        if (!queryInput.trim()) {
            setQueryError('질문을 입력해주세요.');
            return;
        }

        setQueryLoading(true);
        setQueryError('');
        setQueryResult('');

        try {
            const answer = await askQuestion({
                query: queryInput,
                category: selectedCategory || undefined,
                includeCases,
                includeInterpretations
            });
            setQueryResult(answer);
        } catch (error) {
            setQueryError(error instanceof Error ? error.message : '답변 생성에 실패했습니다.');
        } finally {
            setQueryLoading(false);
        }
    };

    // Cases handlers
    const handleSearchCases = async () => {
        if (!caseDescription.trim()) {
            setCasesError('사건 설명을 입력해주세요.');
            return;
        }

        setCasesLoading(true);
        setCasesError('');
        setCasesResult('');

        try {
            const result = await searchSimilarCases(caseDescription);
            setCasesResult(result);
        } catch (error) {
            setCasesError(error instanceof Error ? error.message : '판례 검색에 실패했습니다.');
        } finally {
            setCasesLoading(false);
        }
    };

    // Law handlers
    const handleSearchLaw = async () => {
        if (!lawName.trim() || !lawArticle.trim()) {
            setLawError('법령명과 조문을 모두 입력해주세요.');
            return;
        }

        setLawLoading(true);
        setLawError('');
        setLawResult('');

        try {
            const result = await searchLawArticle(lawName, lawArticle);
            setLawResult(result);
        } catch (error) {
            setLawError(error instanceof Error ? error.message : '법령 조회에 실패했습니다.');
        } finally {
            setLawLoading(false);
        }
    };

    // Template handlers
    const handleTemplateConsult = async () => {
        setTemplateLoading(true);
        setTemplateError('');
        setTemplateResult('');

        try {
            const result = await consultWithTemplate(templateType, templateParams);
            setTemplateResult(result);
        } catch (error) {
            setTemplateError(error instanceof Error ? error.message : '템플릿 상담에 실패했습니다.');
        } finally {
            setTemplateLoading(false);
        }
    };

    const handleCategorySelect = (categoryName: string) => {
        setSelectedCategory(categoryName);
        setActiveTab('query');
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1>⚖️ 노무 AI</h1>
                <p>
                    법령·판례 기반 노무 상담 시스템
                    <span className={`${styles.statusIndicator} ${isOnline ? styles.online : styles.offline}`}></span>
                </p>
            </div>

            <div className={styles.mainContent}>
                <div className={styles.tabs}>
                    <button
                        className={`${styles.tab} ${activeTab === 'query' ? styles.active : ''}`}
                        onClick={() => setActiveTab('query')}
                    >
                        질의응답
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'cases' ? styles.active : ''}`}
                        onClick={() => setActiveTab('cases')}
                    >
                        판례 검색
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'law' ? styles.active : ''}`}
                        onClick={() => setActiveTab('law')}
                    >
                        법령 조회
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'template' ? styles.active : ''}`}
                        onClick={() => setActiveTab('template')}
                    >
                        템플릿 상담
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'categories' ? styles.active : ''}`}
                        onClick={() => setActiveTab('categories')}
                    >
                        카테고리
                    </button>
                </div>

                {/* 질의응답 탭 */}
                {activeTab === 'query' && (
                    <div className={styles.tabContent}>
                        <div className={styles.infoBox}>
                            <strong>💡 사용 방법:</strong> 노무 관련 질문을 입력하세요. AI가 관련 법령과 판례를 찾아 답변합니다.
                        </div>

                        <div className={styles.inputGroup}>
                            <label>질문 입력</label>
                            <textarea
                                value={queryInput}
                                onChange={(e) => setQueryInput(e.target.value)}
                                placeholder="예: 직원을 해고하려면 어떤 절차를 거쳐야 하나요?"
                            />
                        </div>

                        <div className={styles.filters}>
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                            >
                                {CATEGORY_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>

                            <label className={styles.checkbox}>
                                <input
                                    type="checkbox"
                                    checked={includeCases}
                                    onChange={(e) => setIncludeCases(e.target.checked)}
                                />
                                판례 포함
                            </label>

                            <label className={styles.checkbox}>
                                <input
                                    type="checkbox"
                                    checked={includeInterpretations}
                                    onChange={(e) => setIncludeInterpretations(e.target.checked)}
                                />
                                행정해석 포함
                            </label>
                        </div>

                        <button className={styles.btn} onClick={handleAskQuestion} disabled={queryLoading}>
                            {queryLoading ? '답변 생성 중...' : '질문하기'}
                        </button>

                        {queryLoading && <div className={styles.loading}><div className={styles.spinner}></div></div>}
                        {queryError && <div className={styles.error}>{queryError}</div>}
                        {queryResult && (
                            <div className={styles.resultSection}>
                                <h3>답변</h3>
                                <div className={styles.resultBox}>{queryResult}</div>
                            </div>
                        )}
                    </div>
                )}

                {/* 판례 검색 탭 */}
                {activeTab === 'cases' && (
                    <div className={styles.tabContent}>
                        <div className={styles.infoBox}>
                            <strong>⚖️ 판례 검색:</strong> 사건 내용을 설명하면 유사한 판례를 찾아드립니다.
                        </div>

                        <div className={styles.inputGroup}>
                            <label>사건 설명</label>
                            <textarea
                                value={caseDescription}
                                onChange={(e) => setCaseDescription(e.target.value)}
                                placeholder="예: 근무 중 안전수칙을 위반하여 해고된 사안..."
                            />
                        </div>

                        <button className={styles.btn} onClick={handleSearchCases} disabled={casesLoading}>
                            {casesLoading ? '검색 중...' : '유사 판례 검색'}
                        </button>

                        {casesLoading && <div className={styles.loading}><div className={styles.spinner}></div></div>}
                        {casesError && <div className={styles.error}>{casesError}</div>}
                        {casesResult && (
                            <div className={styles.resultSection}>
                                <h3>유사 판례</h3>
                                <div className={styles.resultBox}>{casesResult}</div>
                            </div>
                        )}
                    </div>
                )}

                {/* 법령 조회 탭 */}
                {activeTab === 'law' && (
                    <div className={styles.tabContent}>
                        <div className={styles.infoBox}>
                            <strong>📜 법령 조회:</strong> 특정 법령 조항의 상세 내용을 조회합니다.
                        </div>

                        <div className={styles.filters}>
                            <input
                                type="text"
                                value={lawName}
                                onChange={(e) => setLawName(e.target.value)}
                                placeholder="법령명 (예: 근로기준법)"
                            />
                            <input
                                type="text"
                                value={lawArticle}
                                onChange={(e) => setLawArticle(e.target.value)}
                                placeholder="조문 (예: 제23조)"
                            />
                        </div>

                        <button className={styles.btn} onClick={handleSearchLaw} disabled={lawLoading}>
                            {lawLoading ? '조회 중...' : '법령 조회'}
                        </button>

                        {lawLoading && <div className={styles.loading}><div className={styles.spinner}></div></div>}
                        {lawError && <div className={styles.error}>{lawError}</div>}
                        {lawResult && (
                            <div className={styles.resultSection}>
                                <h3>법령 상세</h3>
                                <div className={styles.resultBox}>{lawResult}</div>
                            </div>
                        )}
                    </div>
                )}

                {/* 템플릿 상담 탭 */}
                {activeTab === 'template' && (
                    <div className={styles.tabContent}>
                        <div className={styles.infoBox}>
                            <strong>📋 템플릿 상담:</strong> 상황별 구조화된 상담을 제공합니다.
                        </div>

                        <div className={styles.inputGroup}>
                            <label>상담 유형</label>
                            <select
                                value={templateType}
                                onChange={(e) => {
                                    setTemplateType(e.target.value);
                                    setTemplateParams({});
                                }}
                            >
                                <option value="dismissal">부당해고</option>
                                <option value="wages">임금 관련</option>
                                <option value="worktime">근로시간</option>
                                <option value="leave">휴가/휴직</option>
                            </select>
                        </div>

                        {TEMPLATE_PARAMS[templateType]?.map(field => (
                            <div key={field.name} className={styles.inputGroup}>
                                <label>{field.label}</label>
                                <input
                                    type="text"
                                    value={templateParams[field.name] || ''}
                                    onChange={(e) => setTemplateParams(prev => ({
                                        ...prev,
                                        [field.name]: e.target.value
                                    }))}
                                    placeholder={field.placeholder}
                                />
                            </div>
                        ))}

                        <button className={styles.btn} onClick={handleTemplateConsult} disabled={templateLoading}>
                            {templateLoading ? '상담 생성 중...' : '상담 시작'}
                        </button>

                        {templateLoading && <div className={styles.loading}><div className={styles.spinner}></div></div>}
                        {templateError && <div className={styles.error}>{templateError}</div>}
                        {templateResult && (
                            <div className={styles.resultSection}>
                                <h3>상담 결과</h3>
                                <div className={styles.resultBox}>{templateResult}</div>
                            </div>
                        )}
                    </div>
                )}

                {/* 카테고리 탭 */}
                {activeTab === 'categories' && (
                    <div className={styles.tabContent}>
                        <div className={styles.infoBox}>
                            <strong>📚 카테고리:</strong> 노무 질의 카테고리 및 키워드 목록
                        </div>

                        <div className={styles.categoriesGrid}>
                            {categories.map(cat => (
                                <div
                                    key={cat.name}
                                    className={styles.categoryCard}
                                    onClick={() => handleCategorySelect(cat.name)}
                                >
                                    <h3>{cat.name}</h3>
                                    <div className={styles.keywords}>
                                        {cat.keywords.slice(0, 5).join(', ')}
                                        {cat.keywords.length > 5 && '...'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
