'use client';

import React, { useState } from 'react';
import styles from './page.module.css';

export default function CaseInputPage() {
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [uploadStatus, setUploadStatus] = useState<string>('');
    const [isUploading, setIsUploading] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setSelectedFiles(Array.from(e.target.files));
        }
    };

    const handleUpload = async () => {
        if (selectedFiles.length === 0) {
            alert('파일을 선택해주세요.');
            return;
        }

        setIsUploading(true);
        setUploadStatus('업로드 중...');

        try {
            // TODO: 실제 업로드 API 연동 필요
            // 현재는 2초 후 성공 처리
            await new Promise(resolve => setTimeout(resolve, 2000));
            setUploadStatus('업로드 완료!');
            setSelectedFiles([]);
        } catch (error) {
            console.error('Upload failed:', error);
            setUploadStatus('업로드 실패');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className={styles.container}>
            <h1>📁 사건 입력</h1>
            <p className={styles.description}>
                본인 사건과 관련된 자료를 업로드해주세요.<br />
                (근로계약서, 급여명세서, 녹취록, 카카오톡 대화 내용 등)
            </p>

            <div className={styles.uploadArea}>
                <input
                    type="file"
                    id="fileInput"
                    multiple
                    onChange={handleFileChange}
                    className={styles.fileInput}
                />
                <label htmlFor="fileInput" className={styles.uploadButton}>
                    파일 선택
                </label>

                {selectedFiles.length > 0 && (
                    <ul className={styles.fileList}>
                        {selectedFiles.map((file, index) => (
                            <li key={index}>{file.name} ({Math.round(file.size / 1024)}KB)</li>
                        ))}
                    </ul>
                )}
            </div>

            <button
                className={styles.submitButton}
                onClick={handleUpload}
                disabled={selectedFiles.length === 0 || isUploading}
            >
                {isUploading ? '업로드 중...' : '자료 제출하기'}
            </button>

            {uploadStatus && <p className={styles.status}>{uploadStatus}</p>}
        </div>
    );
}
