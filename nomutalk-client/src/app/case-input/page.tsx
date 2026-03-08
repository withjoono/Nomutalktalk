'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

const CASE_TYPES = [
    { value: '', label: '사건 유형 선택 (선택사항)' },
    { value: '부당해고', label: '⚠️ 부당해고' },
    { value: '임금체불', label: '💰 임금체불' },
    { value: '산업재해', label: '🏥 산업재해' },
    { value: '근로시간', label: '⏰ 근로시간/초과근무' },
    { value: '직장내괴롭힘', label: '😤 직장 내 괴롭힘' },
    { value: '퇴직금', label: '📋 퇴직금' },
    { value: '차별', label: '🚫 차별/성희롱' },
    { value: '기타', label: '📌 기타' },
];

export default function CaseInputPage() {
    const router = useRouter();
    const [caseType, setCaseType] = useState('');
    const [caseDescription, setCaseDescription] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setSelectedFiles(Array.from(e.target.files));
        }
    };

    const handleAnalyze = () => {
        if (!caseDescription.trim()) {
            alert('사건 내용을 입력해주세요.');
            return;
        }
        // 사건 분석 페이지로 이동하면서 description을 query param으로 전달
        const params = new URLSearchParams();
        params.set('desc', caseDescription.trim());
        if (caseType) params.set('type', caseType);
        router.push(`/case-search?${params.toString()}`);
    };

    return (
        <div className={styles.container}>
            <h1>📁 사건 입력</h1>
            <p className={styles.description}>
                사건 내용을 입력하면 AI가 관련 법령, 판례, 행정해석을 분석하여<br />
                법률 지식 그래프로 보여드립니다.
            </p>

            {/* 사건 유형 선택 */}
            <div className={styles.formGroup}>
                <label className={styles.formLabel}>사건 유형</label>
                <select
                    className={styles.select}
                    value={caseType}
                    onChange={(e) => setCaseType(e.target.value)}
                >
                    {CASE_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                </select>
            </div>

            {/* 사건 내용 입력 */}
            <div className={styles.formGroup}>
                <label className={styles.formLabel}>사건 내용 <span className={styles.required}>*</span></label>
                <textarea
                    className={styles.textarea}
                    value={caseDescription}
                    onChange={(e) => setCaseDescription(e.target.value)}
                    placeholder={"사건 내용을 상세히 작성해주세요.\n\n예시:\n- 근무 기간, 사업장 규모\n- 어떤 일이 발생했는지\n- 현재 상황 및 원하는 결과"}
                    rows={8}
                />
                <span className={styles.charCount}>{caseDescription.length}자</span>
            </div>

            {/* 파일 첨부 (선택사항) */}
            <div className={styles.formGroup}>
                <label className={styles.formLabel}>관련 자료 첨부 <span className={styles.optional}>(선택)</span></label>
                <div className={styles.uploadArea}>
                    <input
                        type="file"
                        id="fileInput"
                        multiple
                        onChange={handleFileChange}
                        className={styles.fileInput}
                    />
                    <label htmlFor="fileInput" className={styles.uploadButton}>
                        📎 파일 선택
                    </label>
                    <span className={styles.uploadHint}>
                        근로계약서, 급여명세서, 녹취록 등
                    </span>
                </div>

                {selectedFiles.length > 0 && (
                    <ul className={styles.fileList}>
                        {selectedFiles.map((file, index) => (
                            <li key={index}>📄 {file.name} ({Math.round(file.size / 1024)}KB)</li>
                        ))}
                    </ul>
                )}
            </div>

            {/* 분석 시작 버튼 */}
            <button
                className={styles.submitButton}
                onClick={handleAnalyze}
                disabled={!caseDescription.trim()}
            >
                📊 AI 사건 분석 시작
            </button>
        </div>
    );
}
