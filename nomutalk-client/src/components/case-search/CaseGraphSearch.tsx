'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import styles from './CaseGraphSearch.module.css';
import GraphView from '../labor/GraphView';
import CaseAnalysisDetailPanel from './CaseAnalysisDetailPanel';
import {
    GraphNode, GraphLink, CaseAnalysisResult,
    analyzeCaseGraph, analyzeFileGraph,
    expandGraphNode, generateLegalDocument,
    DocumentType, GeneratedDocument
} from '@/lib/api';

const DOC_TYPES: { value: DocumentType; label: string; icon: string }[] = [
    { value: 'complaint', label: '진정서/고소장', icon: '📝' },
    { value: 'response', label: '답변서', icon: '📄' },
    { value: 'objection', label: '이의신청서', icon: '⚠️' },
    { value: 'appeal', label: '재심신청서', icon: '🔄' },
    { value: 'evidence', label: '증거목록', icon: '📋' },
];

export default function CaseGraphSearch() {
    const searchParams = useSearchParams();
    const [caseDescription, setCaseDescription] = useState('');
    const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'loading' | 'complete' | 'error'>('idle');
    const [result, setResult] = useState<CaseAnalysisResult | null>(null);
    const [error, setError] = useState('');
    const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
    const [graphWidth, setGraphWidth] = useState(800);
    const [autoTriggered, setAutoTriggered] = useState(false);

    // 파일 업로드 상태
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadLoading, setUploadLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 노드 확장 상태
    const [expandingNodeId, setExpandingNodeId] = useState<string | null>(null);

    // 서면 생성 상태
    const [showDocGen, setShowDocGen] = useState(false);
    const [selectedDocType, setSelectedDocType] = useState<DocumentType>('complaint');
    const [generatedDoc, setGeneratedDoc] = useState<GeneratedDocument | null>(null);
    const [docGenLoading, setDocGenLoading] = useState(false);

    // URL에서 사건 설명 읽기
    useEffect(() => {
        const desc = searchParams.get('desc');
        if (desc && !autoTriggered) {
            setCaseDescription(desc);
            setAutoTriggered(true);
            runAnalysis(desc);
        }
    }, [searchParams, autoTriggered]);

    // 반응형 그래프 너비
    useEffect(() => {
        const updateWidth = () => {
            const w = Math.min(window.innerWidth - 64, 900);
            setGraphWidth(w);
        };
        updateWidth();
        window.addEventListener('resize', updateWidth);
        return () => window.removeEventListener('resize', updateWidth);
    }, []);

    const runAnalysis = async (description: string) => {
        setAnalysisStatus('loading');
        setError('');
        setSelectedNode(null);
        setGeneratedDoc(null);
        setShowDocGen(false);

        try {
            const data = await analyzeCaseGraph(description.trim());
            setResult(data);
            setAnalysisStatus('complete');
        } catch (err: any) {
            console.error('분석 실패:', err);
            setError(err.message || '사건 분석에 실패했습니다.');
            setAnalysisStatus('error');
        }
    };

    const handleAnalyze = () => {
        if (!caseDescription.trim()) {
            setError('사건 내용을 입력해주세요.');
            return;
        }
        runAnalysis(caseDescription);
    };

    // 파일 분석
    const handleFileAnalyze = async () => {
        if (!uploadFile) return;
        setUploadLoading(true);
        setError('');
        try {
            const data = await analyzeFileGraph(uploadFile);
            setCaseDescription(data.extractedText || '');
            setResult(data);
            setAnalysisStatus('complete');
            setUploadFile(null);
        } catch (err: any) {
            setError(err.message || '파일 분석 실패');
        } finally {
            setUploadLoading(false);
        }
    };

    // 노드 확장
    const handleExpandNode = async (node: GraphNode) => {
        if (!result || expandingNodeId || node.type === 'case') return;
        setExpandingNodeId(node.id);

        try {
            const expanded = await expandGraphNode(node.id, node.label, node.type);

            // 기존 노드/링크에 새로운 것들을 추가
            const existingIds = new Set(result.nodes.map(n => n.id));
            const uniqueNewNodes = expanded.newNodes.filter(n => !existingIds.has(n.id));
            const uniqueNewLinks = expanded.newLinks.filter(l => {
                const targetExists = existingIds.has(typeof l.target === 'string' ? l.target : '') || uniqueNewNodes.some(n => n.id === l.target);
                return targetExists;
            });

            setResult({
                ...result,
                nodes: [...result.nodes, ...uniqueNewNodes],
                links: [...result.links, ...uniqueNewLinks],
            });

            // 상세 패널에 확장 결과 표시
            setSelectedNode({
                ...node,
                detail: expanded.detail?.substring(0, 500) || node.detail,
            });
        } catch (err: any) {
            console.error('노드 확장 실패:', err);
        } finally {
            setExpandingNodeId(null);
        }
    };

    // 서면 생성
    const handleGenerateDoc = async () => {
        if (!caseDescription.trim() && !result?.summary) return;
        setDocGenLoading(true);
        try {
            const desc = caseDescription || (result?.summary || '');
            const doc = await generateLegalDocument(desc, selectedDocType);
            setGeneratedDoc(doc);
        } catch (err: any) {
            setError(err.message || '서면 생성 실패');
        } finally {
            setDocGenLoading(false);
        }
    };

    const handleNodeClick = (node: GraphNode) => {
        setSelectedNode(node);
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1>🔎 사건 분석</h1>
                <p>사건 내용을 입력하거나 파일을 업로드하면 AI가 분석하여 법률 지식 그래프로 보여드립니다.</p>
            </div>

            <div className={styles.searchSection}>
                {/* 텍스트 입력 */}
                <textarea
                    className={styles.searchInput}
                    placeholder={"사건 내용을 상세히 입력해주세요.\n\n예시: 5인 미만 사업장에서 2년간 근무했는데, 사장이 갑자기 내일부터 나오지 말라고 합니다."}
                    value={caseDescription}
                    onChange={(e) => setCaseDescription(e.target.value)}
                    rows={5}
                />

                {/* 파일 업로드 */}
                <div className={styles.uploadRow}>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.txt,.doc,.docx,.hwp,.png,.jpg,.jpeg"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                            if (e.target.files?.[0]) setUploadFile(e.target.files[0]);
                        }}
                    />
                    <button
                        className={styles.uploadBtn}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadLoading}
                    >
                        📎 파일 첨부
                    </button>
                    {uploadFile && (
                        <div className={styles.uploadFileInfo}>
                            <span>📄 {uploadFile.name}</span>
                            <button
                                className={styles.uploadAnalyzeBtn}
                                onClick={handleFileAnalyze}
                                disabled={uploadLoading}
                            >
                                {uploadLoading ? '분석 중...' : '파일로 분석'}
                            </button>
                        </div>
                    )}
                </div>

                {error && <p className={styles.errorText}>{error}</p>}

                <button
                    className={styles.searchButton}
                    onClick={handleAnalyze}
                    disabled={analysisStatus === 'loading' || !caseDescription.trim()}
                >
                    {analysisStatus === 'loading' ? (
                        <>
                            <span className={styles.spinner} />
                            AI 분석 중... (약 10~20초 소요)
                        </>
                    ) : (
                        '📊 사건 분석 시작'
                    )}
                </button>
            </div>

            {analysisStatus === 'complete' && result && (
                <div className={styles.resultSection}>
                    {/* 그래프 */}
                    <div className={styles.graphSection}>
                        <h3>📊 법률 관계 그래프</h3>
                        <p className={styles.graphHint}>
                            노드를 클릭하면 상세 정보 확인 · 더블클릭하면 관련 문서 확장
                        </p>
                        <div className={styles.graphWrapper}>
                            <GraphView
                                nodes={result.nodes}
                                links={result.links}
                                width={graphWidth}
                                height={500}
                                onNodeClick={handleNodeClick}
                                onNodeDoubleClick={handleExpandNode}
                                expandingNodeId={expandingNodeId}
                            />
                        </div>
                    </div>

                    {/* AI 분석 요약 */}
                    <div className={styles.summarySection}>
                        <h3>🧠 AI 법률 분석</h3>
                        <div className={styles.summaryContent}>
                            {result.summary}
                        </div>
                    </div>

                    {/* 유사 판례 요약 */}
                    {result.similarCasesSummary && (
                        <div className={styles.summarySection}>
                            <h3>🏛️ 유사 판례 분석</h3>
                            <div className={styles.summaryContent}>
                                {result.similarCasesSummary}
                            </div>
                        </div>
                    )}

                    {/* 서면 자동생성 */}
                    <div className={styles.docGenSection}>
                        <div className={styles.docGenHeader}>
                            <h3>📝 법률 서면 자동생성</h3>
                            <button
                                className={styles.docGenToggle}
                                onClick={() => setShowDocGen(!showDocGen)}
                            >
                                {showDocGen ? '접기 ▲' : '열기 ▼'}
                            </button>
                        </div>

                        {showDocGen && (
                            <div className={styles.docGenBody}>
                                <p className={styles.docGenHint}>
                                    분석된 사건을 바탕으로 법률 서면 초안을 자동 생성합니다.
                                </p>
                                <div className={styles.docTypeGrid}>
                                    {DOC_TYPES.map((dt) => (
                                        <button
                                            key={dt.value}
                                            className={`${styles.docTypeBtn} ${selectedDocType === dt.value ? styles.docTypeActive : ''}`}
                                            onClick={() => setSelectedDocType(dt.value)}
                                        >
                                            <span>{dt.icon}</span> {dt.label}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    className={styles.generateBtn}
                                    onClick={handleGenerateDoc}
                                    disabled={docGenLoading}
                                >
                                    {docGenLoading ? (
                                        <><span className={styles.spinner} /> 서면 생성 중...</>
                                    ) : (
                                        `📄 ${DOC_TYPES.find(d => d.value === selectedDocType)?.label} 생성`
                                    )}
                                </button>

                                {generatedDoc && (
                                    <div className={styles.generatedDocArea}>
                                        <div className={styles.generatedDocHeader}>
                                            <h4>{generatedDoc.documentTypeName}</h4>
                                            <button
                                                className={styles.copyBtn}
                                                onClick={() => {
                                                    navigator.clipboard.writeText(generatedDoc.content);
                                                    alert('클립보드에 복사되었습니다.');
                                                }}
                                            >
                                                📋 복사
                                            </button>
                                        </div>
                                        <pre className={styles.generatedDocContent}>
                                            {generatedDoc.content}
                                        </pre>
                                        {generatedDoc.citations.length > 0 && (
                                            <div className={styles.docCitations}>
                                                <strong>참조 법령:</strong> {generatedDoc.citations.join(', ')}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 노드 목록 */}
                    <div className={styles.nodeListSection}>
                        <h3>📑 관련 문서 ({result.nodes.length - 1}건)</h3>
                        <div className={styles.nodeGrid}>
                            {result.nodes.filter(n => n.type !== 'case').map((node) => (
                                <button
                                    key={node.id}
                                    className={`${styles.nodeCard} ${styles[node.type]}`}
                                    onClick={() => setSelectedNode(node)}
                                >
                                    <span className={styles.nodeType}>
                                        {node.type === 'law' ? '⚖️ 법령' :
                                            node.type === 'precedent' ? '🏛️ 판례' :
                                                node.type === 'interpretation' ? '📝 행정해석' :
                                                    node.type === 'decision' ? '🔨 노동위' : '📄 문서'}
                                    </span>
                                    <span className={styles.nodeLabel}>{node.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 상세 패널 */}
            {selectedNode && result && (
                <CaseAnalysisDetailPanel
                    node={selectedNode}
                    links={result.links}
                    allNodes={result.nodes}
                    onClose={() => setSelectedNode(null)}
                    onExpand={handleExpandNode}
                    isExpanding={expandingNodeId === selectedNode.id}
                />
            )}
        </div>
    );
}
