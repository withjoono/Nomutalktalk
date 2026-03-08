import { Suspense } from "react";
import CaseGraphSearch from "@/components/case-search/CaseGraphSearch";

export default function CaseSearchPage() {
    return (
        <Suspense fallback={<div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>로딩 중...</div>}>
            <CaseGraphSearch />
        </Suspense>
    );
}
