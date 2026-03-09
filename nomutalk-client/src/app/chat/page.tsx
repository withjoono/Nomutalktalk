'use client';

import ChatInterface from "@/components/chat/ChatInterface";
import StepNav from "@/components/layout/StepNav";

export default function ChatPage() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flex: 1, minHeight: 0 }}>
                <ChatInterface />
            </div>
            <div style={{ padding: '0 16px 16px', maxWidth: 960, margin: '0 auto', width: '100%' }}>
                <StepNav currentStep={3} />
            </div>
        </div>
    );
}
