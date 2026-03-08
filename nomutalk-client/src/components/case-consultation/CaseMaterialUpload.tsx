'use client';

import React, { useState, useRef, useCallback } from 'react';
import styles from './CaseMaterialUpload.module.css';

interface Props {
    onSubmit: (description: string, files: File[]) => void;
    isLoading: boolean;
    error?: string;
}

const FILE_ICONS: Record<string, string> = {
    pdf: '📕', txt: '📄', doc: '📝', docx: '📝', hwp: '📃',
    png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', webp: '🖼️',
};

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export default function CaseMaterialUpload({ onSubmit, isLoading, error }: Props) {
    const [description, setDescription] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const addFiles = useCallback((newFiles: FileList | File[]) => {
        const arr = Array.from(newFiles);
        setFiles(prev => {
            const existing = new Set(prev.map(f => f.name + f.size));
            const unique = arr.filter(f => !existing.has(f.name + f.size));
            return [...prev, ...unique];
        });
    }, []);

    const removeFile = (idx: number) => {
        setFiles(prev => prev.filter((_, i) => i !== idx));
    };

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
    const handleDragLeave = () => setIsDragOver(false);
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
    };

    const canSubmit = (description.trim().length > 0 || files.length > 0) && !isLoading;

    return (
        <div className={styles.container}>
            <h2 className={styles.title}>📁 사건 자료 입력</h2>
            <p className={styles.subtitle}>
                사건 내용을 설명하고, 관련 파일(근로계약서, 급여명세서, 해고통지서 등)을 첨부해주세요.
            </p>

            {/* 텍스트 입력 */}
            <div className={styles.textSection}>
                <label className={styles.sectionLabel}>✏️ 사건 내용 설명</label>
                <textarea
                    className={styles.textarea}
                    placeholder={"사건의 경위와 상황을 상세하게 설명해주세요.\n\n예시: 5인 미만 사업장에서 2년간 근무했습니다. 사장이 갑자기 내일부터 나오지 말라고 했고, 마지막 3개월치 월급도 받지 못했습니다. 근로계약서는 작성했으나 사본은 받지 못했습니다."}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isLoading}
                />
            </div>

            {/* 파일 업로드 */}
            <div className={styles.fileSection}>
                <label className={styles.sectionLabel}>📎 관련 파일 첨부 (선택)</label>
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.txt,.doc,.docx,.hwp,.png,.jpg,.jpeg,.gif,.webp"
                    style={{ display: 'none' }}
                    onChange={(e) => { if (e.target.files) addFiles(e.target.files); }}
                />
                <div
                    className={`${styles.dropZone} ${isDragOver ? styles.dropZoneActive : ''}`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <div className={styles.dropIcon}>📂</div>
                    <div className={styles.dropText}>클릭하거나 파일을 여기에 드래그하세요</div>
                    <div className={styles.dropHint}>PDF, 이미지, HWP, DOC 등 (최대 10개, 각 50MB)</div>
                </div>

                {files.length > 0 && (
                    <div className={styles.fileList}>
                        {files.map((file, idx) => {
                            const ext = file.name.split('.').pop()?.toLowerCase() || '';
                            return (
                                <div key={idx} className={styles.fileItem}>
                                    <span className={styles.fileIcon}>{FILE_ICONS[ext] || '📄'}</span>
                                    <span className={styles.fileName}>{file.name}</span>
                                    <span className={styles.fileSize}>{formatSize(file.size)}</span>
                                    <button className={styles.fileRemoveBtn} onClick={() => removeFile(idx)} disabled={isLoading}>✕</button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 에러 */}
            {error && <p className={styles.errorText}>{error}</p>}

            {/* 제출 */}
            <button
                className={styles.submitBtn}
                onClick={() => onSubmit(description, files)}
                disabled={!canSubmit}
            >
                {isLoading ? (
                    <><span className={styles.spinner} /> AI 분석 중... (약 15~30초 소요)</>
                ) : (
                    '🔍 사건 분석 시작'
                )}
            </button>
        </div>
    );
}
