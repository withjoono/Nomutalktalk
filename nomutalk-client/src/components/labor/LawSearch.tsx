'use client';

import React, { useState, useEffect, useCallback } from 'react';
import styles from './LawSearch.module.css';
import { searchLaws, getCategories, checkHealth, SearchResultItem, Category } from '@/lib/api';

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

export default function LawSearch() {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchType, setSearchType] = useState<SearchType>('all');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [categories, setCategories] = useState<Category[]>([]);
    const [results, setResults] = useState<SearchResultItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOnline, setIsOnline] = useState(false);
    const [error, setError] = useState('');
    const [hasSearched, setHasSearched] = useState(false);
    const [selectedResult, setSelectedResult] = useState<SearchResultItem | null>(null);

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
        setSelectedResult(null);

        try {
            const searchResults = await searchLaws({
                query: searchTerm,
                type: searchType,
                category: selectedCategory || undefined
            });
            setResults(searchResults);
        } catch (err) {
            setError(err instanceof Error ? err.message : '검색 중 오류가 발생했습니다.');
            setResults([]);
        } finally {
            setIsLoading(false);
        }
    }, [searchQuery, searchType, selectedCategory]);

    const handleQuickSearch = (query: string) => {
        setSearchQuery(query);
        handleSearch(query);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'law': return '📜';
            case 'case': return '⚖️';
            case 'interpretation': return '📋';
            default: return '📄';
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'law': return '법령';
            case 'case': return '판례';
            case 'interpretation': return '행정해석';
            default: return '문서';
        }
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <h1>🔍 노무 법령·판례 검색</h1>
                <p>
                    법령, 판례, 행정해석을 통합 검색합니다
                    <span className={`${styles.status} ${isOnline ? styles.online : styles.offline}`}></span>
                </p>
            </div>

            {/* Search Section */}
            <div className={styles.searchSection}>
                {/* Search Bar */}
                <div className={styles.searchBar}>
                    <input
                        type="text"
                        className={styles.searchInput}
                        placeholder="법령명, 조문, 키워드로 검색하세요..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
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

                {/* Filters */}
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

            {/* Results */}
            {hasSearched && !isLoading && (
                <div className={styles.results}>
                    <div className={styles.resultsHeader}>
                        <h2>검색 결과</h2>
                        <span className={styles.resultCount}>{results.length}건</span>
                    </div>

                    {results.length === 0 ? (
                        <div className={styles.noResults}>
                            <span>😔</span>
                            <p>검색 결과가 없습니다.</p>
                            <p>다른 키워드로 검색해보세요.</p>
                        </div>
                    ) : (
                        <div className={styles.resultList}>
                            {results.map((result) => (
                                <div
                                    key={result.id}
                                    className={`${styles.resultCard} ${selectedResult?.id === result.id ? styles.selected : ''}`}
                                    onClick={() => setSelectedResult(result)}
                                >
                                    <div className={styles.resultHeader}>
                                        <span className={styles.resultIcon}>{getTypeIcon(result.type)}</span>
                                        <span className={styles.resultType}>{getTypeLabel(result.type)}</span>
                                        {result.category && (
                                            <span className={styles.resultCategory}>{result.category}</span>
                                        )}
                                    </div>
                                    <h3 className={styles.resultTitle}>{result.title}</h3>
                                    <p className={styles.resultSummary}>
                                        {result.summary.length > 300
                                            ? result.summary.substring(0, 300) + '...'
                                            : result.summary}
                                    </p>
                                    {result.date && (
                                        <span className={styles.resultDate}>{result.date}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Detail Modal */}
            {selectedResult && (
                <div className={styles.modalOverlay} onClick={() => setSelectedResult(null)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div className={styles.modalType}>
                                <span>{getTypeIcon(selectedResult.type)}</span>
                                <span>{getTypeLabel(selectedResult.type)}</span>
                            </div>
                            <button className={styles.closeButton} onClick={() => setSelectedResult(null)}>
                                ✕
                            </button>
                        </div>
                        <h2 className={styles.modalTitle}>{selectedResult.title}</h2>
                        <div className={styles.modalContent}>
                            {selectedResult.summary}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
