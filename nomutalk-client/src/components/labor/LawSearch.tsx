'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styles from './LawSearch.module.css';
import {
    searchLawsStructured,
    getCategories,
    checkHealth,
    Category,
    LawResult,
    CaseResult,
    InterpretationResult,
    StructuredSearchResult
} from '@/lib/api';

type SearchType = 'all' | 'law' | 'case' | 'interpretation';

const SEARCH_TYPES: { value: SearchType; label: string; icon: string }[] = [
    { value: 'all', label: '전체', icon: '🔍' },
    { value: 'law', label: '법령', icon: '📜' },
    { value: 'case', label: '판례', icon: '⚖️' },
    { value: 'interpretation', label: '행정해석', icon: '📋' }
];

const QUICK_SEARCHES = [
    { label: '근로계약', icon: '📝', query: '근로계약' },
    { label: '임금', icon: '💰', query: '임금' },
    { label: '해고', icon: '🚫', query: '해고' },
    { label: '산재보험', icon: '🏥', query: '산재보험' },
    { label: '근로시간', icon: '⏰', query: '근로시간' },
    { label: '휴가', icon: '🌴', query: '휴가' },
    { label: '퇴직금', icon: '💵', query: '퇴직금' },
    { label: '최저임금', icon: '📊', query: '최저임금' }
];

type DetailItem = (LawResult | CaseResult | InterpretationResult) & { _type: string };

export default function LawSearch() {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchType, setSearchType] = useState<SearchType>('all');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [categories, setCategories] = useState<Category[]>([]);
    const [searchResult, setSearchResult] = useState<StructuredSearchResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isOnline, setIsOnline] = useState(false);
    const [error, setError] = useState('');
    const [hasSearched, setHasSearched] = useState(false);
    const [selectedDetail, setSelectedDetail] = useState<DetailItem | null>(null);
    const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['laws', 'cases', 'interpretations']));

    useEffect(() => {
        checkHealth().then(setIsOnline);
        getCategories().then(setCategories).catch(console.error);
    }, []);

    const handleSearch = useCallback(async (query?: string) => {
        const searchTerm = query || searchQuery;
        if (!searchTerm.trim()) {
            setError('검색어를 입력해주세요.');
            return;
        }

        setIsLoading(true);
        setError('');
        setHasSearched(true);
        setSelectedDetail(null);
        setHighlightedIds(new Set());

        try {
            const result = await searchLawsStructured({
                query: searchTerm,
                type: searchType,
                category: selectedCategory || undefined
            });
            setSearchResult(result);
            setExpandedSections(new Set(['laws', 'cases', 'interpretations']));
        } catch (err) {
            setError(err instanceof Error ? err.message : '검색 중 오류가 발생했습니다.');
            setSearchResult(null);
        } finally {
            setIsLoading(false);
        }
    }, [searchQuery, searchType, selectedCategory]);

    const handleQuickSearch = (query: string) => {
        setSearchQuery(query);
        handleSearch(query);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSearch();
    };

    const toggleSection = (section: string) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(section)) next.delete(section);
            else next.add(section);
            return next;
        });
    };

    // 법령-판례 매칭 하이라이트
    const handleShowRelated = useCallback((id: string) => {
        if (!searchResult?.matchMap) return;
        const related = searchResult.matchMap[id] || [];
        setHighlightedIds(new Set(related));
        // 관련 섹션 열기
        setExpandedSections(new Set(['laws', 'cases', 'interpretations']));
    }, [searchResult]);

    const clearHighlights = useCallback(() => {
        setHighlightedIds(new Set());
    }, []);

    const totalResults = useMemo(() => {
        if (!searchResult) return 0;
        return (searchResult.laws?.length || 0) +
            (searchResult.cases?.length || 0) +
            (searchResult.interpretations?.length || 0);
    }, [searchResult]);

    const openDetail = (item: LawResult | CaseResult | InterpretationResult, type: string) => {
        setSelectedDetail({ ...item, _type: type } as DetailItem);
    };

    // 법령 카드용 관련 판례 찾기
    const getRelatedCases = useCallback((lawId: string): CaseResult[] => {
        if (!searchResult) return [];
        const caseIds = searchResult.matchMap?.[lawId] || [];
        return searchResult.cases.filter(c => caseIds.includes(c.id));
    }, [searchResult]);

    // 판례 카드용 관련 법령 찾기
    const getRelatedLaws = useCallback((caseId: string): LawResult[] => {
        if (!searchResult) return [];
        const lawIds = searchResult.matchMap?.[caseId] || [];
        return searchResult.laws.filter(l => lawIds.includes(l.id));
    }, [searchResult]);

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <h1>법령·판례 검색</h1>
                <p>
                    법령, 판례, 행정해석을 통합 검색하고 관련 판례를 자동 매칭합니다
                    <span className={`${styles.status} ${isOnline ? styles.online : styles.offline}`}></span>
                </p>
            </div>

            {/* Search Section */}
            <div className={styles.searchSection}>
                <div className={styles.searchBar}>
                    <div className={styles.searchInputWrap}>
                        <svg className={styles.searchIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8" />
                            <path d="m21 21-4.3-4.3" />
                        </svg>
                        <input
                            type="text"
                            className={styles.searchInput}
                            placeholder="법령명, 조문, 키워드로 검색하세요..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                    </div>
                    <button
                        className={styles.searchButton}
                        onClick={() => handleSearch()}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <span className={styles.spinner}></span>
                        ) : (
                            '검색'
                        )}
                    </button>
                </div>

                <div className={styles.filters}>
                    <div className={styles.typeFilters}>
                        {SEARCH_TYPES.map((type) => (
                            <button
                                key={type.value}
                                className={`${styles.typeButton} ${searchType === type.value ? styles.active : ''}`}
                                onClick={() => setSearchType(type.value)}
                            >
                                <span>{type.icon}</span>
                                <span>{type.label}</span>
                            </button>
                        ))}
                    </div>

                    <select
                        className={styles.categorySelect}
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                    >
                        <option value="">전체 카테고리</option>
                        {categories.map((cat) => (
                            <option key={cat.name} value={cat.name}>{cat.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Quick Search */}
            {!hasSearched && (
                <div className={styles.quickSearch}>
                    <h2>📚 빠른 검색</h2>
                    <div className={styles.quickGrid}>
                        {QUICK_SEARCHES.map((item) => (
                            <button
                                key={item.query}
                                className={styles.quickButton}
                                onClick={() => handleQuickSearch(item.query)}
                            >
                                <span className={styles.quickIcon}>{item.icon}</span>
                                <span>{item.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className={styles.error}>
                    ⚠️ {error}
                </div>
            )}

            {/* Loading skeleton */}
            {isLoading && (
                <div className={styles.loadingArea}>
                    <div className={styles.loadingSkeleton}>
                        <div className={styles.skeletonBar} style={{ width: '60%' }} />
                        <div className={styles.skeletonBar} style={{ width: '90%' }} />
                        <div className={styles.skeletonBar} style={{ width: '75%' }} />
                    </div>
                    <p className={styles.loadingText}>법령과 판례를 분석하고 매칭 중입니다...</p>
                </div>
            )}

            {/* Highlight bar */}
            {highlightedIds.size > 0 && (
                <div className={styles.highlightBar}>
                    <span>🔗 관련 항목 {highlightedIds.size}건이 하이라이트되었습니다</span>
                    <button onClick={clearHighlights}>✕ 해제</button>
                </div>
            )}

            {/* Structured Results */}
            {hasSearched && !isLoading && searchResult && (
                <div className={styles.results}>
                    <div className={styles.resultsHeader}>
                        <h2>검색 결과</h2>
                        <div className={styles.resultCounts}>
                            <span className={styles.resultCount}>{totalResults}건</span>
                            {searchResult.laws.length > 0 && (
                                <span className={styles.countBadgeLaw}>📜 {searchResult.laws.length}</span>
                            )}
                            {searchResult.cases.length > 0 && (
                                <span className={styles.countBadgeCase}>⚖️ {searchResult.cases.length}</span>
                            )}
                            {searchResult.interpretations.length > 0 && (
                                <span className={styles.countBadgeInterp}>📋 {searchResult.interpretations.length}</span>
                            )}
                        </div>
                    </div>

                    {totalResults === 0 ? (
                        <div className={styles.noResults}>
                            <span>😔</span>
                            <p>검색 결과가 없습니다.</p>
                            <p>다른 키워드로 검색해보세요.</p>
                        </div>
                    ) : (
                        <div className={styles.sectionsWrap}>
                            {/* === 법령 섹션 === */}
                            {searchResult.laws.length > 0 && (
                                <div className={styles.section}>
                                    <button
                                        className={styles.sectionHeader}
                                        onClick={() => toggleSection('laws')}
                                    >
                                        <div className={styles.sectionTitle}>
                                            <span className={styles.sectionIcon}>📜</span>
                                            <span>법령</span>
                                            <span className={styles.sectionBadge}>{searchResult.laws.length}건</span>
                                        </div>
                                        <span className={`${styles.chevron} ${expandedSections.has('laws') ? styles.chevronOpen : ''}`}>▾</span>
                                    </button>
                                    {expandedSections.has('laws') && (
                                        <div className={styles.sectionBody}>
                                            {searchResult.laws.map((law) => {
                                                const relatedCases = getRelatedCases(law.id);
                                                return (
                                                    <div
                                                        key={law.id}
                                                        className={`${styles.resultCard} ${styles.lawCard} ${highlightedIds.has(law.id) ? styles.highlighted : ''}`}
                                                    >
                                                        <div className={styles.cardMain} onClick={() => openDetail(law, 'law')}>
                                                            <div className={styles.cardBadges}>
                                                                <span className={styles.lawBadge}>
                                                                    {law.lawType === 'decree' ? '시행령' : law.lawType === 'rule' ? '시행규칙' : '법률'}
                                                                </span>
                                                                {law.article && <span className={styles.articleBadge}>{law.article}</span>}
                                                            </div>
                                                            <h3 className={styles.cardTitle}>{law.title}</h3>
                                                            <p className={styles.cardSummary}>
                                                                {law.summary.length > 200 ? law.summary.substring(0, 200) + '...' : law.summary}
                                                            </p>
                                                        </div>
                                                        {relatedCases.length > 0 && (
                                                            <button
                                                                className={styles.matchButton}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleShowRelated(law.id);
                                                                }}
                                                            >
                                                                <span>⚖️</span>
                                                                <span>관련 판례 {relatedCases.length}건</span>
                                                                <span className={styles.matchArrow}>→</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* === 판례 섹션 === */}
                            {searchResult.cases.length > 0 && (
                                <div className={styles.section}>
                                    <button
                                        className={styles.sectionHeader}
                                        onClick={() => toggleSection('cases')}
                                    >
                                        <div className={styles.sectionTitle}>
                                            <span className={styles.sectionIcon}>⚖️</span>
                                            <span>판례</span>
                                            <span className={styles.sectionBadge}>{searchResult.cases.length}건</span>
                                        </div>
                                        <span className={`${styles.chevron} ${expandedSections.has('cases') ? styles.chevronOpen : ''}`}>▾</span>
                                    </button>
                                    {expandedSections.has('cases') && (
                                        <div className={styles.sectionBody}>
                                            {searchResult.cases.map((caseItem) => {
                                                const relatedLaws = getRelatedLaws(caseItem.id);
                                                return (
                                                    <div
                                                        key={caseItem.id}
                                                        className={`${styles.resultCard} ${styles.caseCard} ${highlightedIds.has(caseItem.id) ? styles.highlighted : ''}`}
                                                    >
                                                        <div className={styles.cardMain} onClick={() => openDetail(caseItem, 'case')}>
                                                            <div className={styles.cardBadges}>
                                                                {caseItem.court && <span className={styles.courtBadge}>{caseItem.court}</span>}
                                                                {caseItem.verdict && (
                                                                    <span className={`${styles.verdictBadge} ${caseItem.verdict.includes('승') || caseItem.verdict.includes('인용') ? styles.verdictWin : styles.verdictLose}`}>
                                                                        {caseItem.verdict}
                                                                    </span>
                                                                )}
                                                                {caseItem.date && <span className={styles.dateBadge}>{caseItem.date}</span>}
                                                            </div>
                                                            <h3 className={styles.cardTitle}>{caseItem.title}</h3>
                                                            <p className={styles.cardSummary}>
                                                                {caseItem.summary.length > 200 ? caseItem.summary.substring(0, 200) + '...' : caseItem.summary}
                                                            </p>
                                                        </div>
                                                        {relatedLaws.length > 0 && (
                                                            <div className={styles.relatedLawTags}>
                                                                <span className={styles.relatedLabel}>📜 관련 법령:</span>
                                                                {relatedLaws.map(l => (
                                                                    <button
                                                                        key={l.id}
                                                                        className={styles.relatedTag}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleShowRelated(caseItem.id);
                                                                        }}
                                                                    >
                                                                        {l.title.length > 25 ? l.title.substring(0, 25) + '...' : l.title}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* === 행정해석 섹션 === */}
                            {searchResult.interpretations.length > 0 && (
                                <div className={styles.section}>
                                    <button
                                        className={styles.sectionHeader}
                                        onClick={() => toggleSection('interpretations')}
                                    >
                                        <div className={styles.sectionTitle}>
                                            <span className={styles.sectionIcon}>📋</span>
                                            <span>행정해석</span>
                                            <span className={styles.sectionBadge}>{searchResult.interpretations.length}건</span>
                                        </div>
                                        <span className={`${styles.chevron} ${expandedSections.has('interpretations') ? styles.chevronOpen : ''}`}>▾</span>
                                    </button>
                                    {expandedSections.has('interpretations') && (
                                        <div className={styles.sectionBody}>
                                            {searchResult.interpretations.map((interp) => (
                                                <div
                                                    key={interp.id}
                                                    className={`${styles.resultCard} ${styles.interpCard} ${highlightedIds.has(interp.id) ? styles.highlighted : ''}`}
                                                    onClick={() => openDetail(interp, 'interpretation')}
                                                >
                                                    <div className={styles.cardMain}>
                                                        <div className={styles.cardBadges}>
                                                            {interp.agency && <span className={styles.agencyBadge}>{interp.agency}</span>}
                                                            {interp.date && <span className={styles.dateBadge}>{interp.date}</span>}
                                                        </div>
                                                        <h3 className={styles.cardTitle}>{interp.title}</h3>
                                                        <p className={styles.cardSummary}>
                                                            {interp.summary.length > 200 ? interp.summary.substring(0, 200) + '...' : interp.summary}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Detail Modal */}
            {selectedDetail && (
                <div className={styles.modalOverlay} onClick={() => setSelectedDetail(null)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div className={styles.modalType}>
                                <span>{selectedDetail._type === 'law' ? '📜' : selectedDetail._type === 'case' ? '⚖️' : '📋'}</span>
                                <span>{selectedDetail._type === 'law' ? '법령' : selectedDetail._type === 'case' ? '판례' : '행정해석'}</span>
                            </div>
                            <button className={styles.closeButton} onClick={() => setSelectedDetail(null)}>
                                ✕
                            </button>
                        </div>

                        <div className={styles.modalBody}>
                            {/* Modal badges */}
                            <div className={styles.modalBadges}>
                                {'lawType' in selectedDetail && (
                                    <span className={styles.lawBadge}>
                                        {selectedDetail.lawType === 'decree' ? '시행령' : selectedDetail.lawType === 'rule' ? '시행규칙' : '법률'}
                                    </span>
                                )}
                                {'court' in selectedDetail && selectedDetail.court && (
                                    <span className={styles.courtBadge}>{selectedDetail.court}</span>
                                )}
                                {'verdict' in selectedDetail && selectedDetail.verdict && (
                                    <span className={`${styles.verdictBadge} ${String(selectedDetail.verdict).includes('승') || String(selectedDetail.verdict).includes('인용') ? styles.verdictWin : styles.verdictLose}`}>
                                        {selectedDetail.verdict}
                                    </span>
                                )}
                                {'agency' in selectedDetail && selectedDetail.agency && (
                                    <span className={styles.agencyBadge}>{selectedDetail.agency}</span>
                                )}
                                {'date' in selectedDetail && selectedDetail.date && (
                                    <span className={styles.dateBadge}>{selectedDetail.date}</span>
                                )}
                            </div>

                            <h2 className={styles.modalTitle}>{selectedDetail.title}</h2>
                            <div className={styles.modalContent}>
                                {selectedDetail.summary}
                            </div>

                            {/* Related items in modal */}
                            {selectedDetail._type === 'law' && searchResult && (
                                (() => {
                                    const related = getRelatedCases(selectedDetail.id);
                                    if (related.length === 0) return null;
                                    return (
                                        <div className={styles.modalRelated}>
                                            <h3>⚖️ 관련 판례 ({related.length}건)</h3>
                                            {related.map(c => (
                                                <div key={c.id} className={styles.modalRelatedItem} onClick={() => openDetail(c, 'case')}>
                                                    <span className={styles.modalRelatedIcon}>⚖️</span>
                                                    <div>
                                                        <strong>{c.title}</strong>
                                                        <p>{c.summary.substring(0, 100)}...</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()
                            )}

                            {selectedDetail._type === 'case' && searchResult && (
                                (() => {
                                    const related = getRelatedLaws(selectedDetail.id);
                                    if (related.length === 0) return null;
                                    return (
                                        <div className={styles.modalRelated}>
                                            <h3>📜 관련 법령 ({related.length}건)</h3>
                                            {related.map(l => (
                                                <div key={l.id} className={styles.modalRelatedItem} onClick={() => openDetail(l, 'law')}>
                                                    <span className={styles.modalRelatedIcon}>📜</span>
                                                    <div>
                                                        <strong>{l.title}</strong>
                                                        <p>{l.summary.substring(0, 100)}...</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
