'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Copy, Check, Download, RefreshCw, Mail, Save, X } from 'lucide-react';
import { MessageBubble, TypingIndicator } from './MessageBubble';
import { DualProgressBar } from './ProgressBar';
import { FileUpload } from './FileUpload';
import { RequiredDocumentsButton } from './RequiredDocumentsButton';
import { RequiredDocumentsPanel } from './RequiredDocumentsPanel';
import { getRelevantDocs } from '@/lib/document-checklist';
import type { CaseStatus, MessageData, DocumentData } from '@/types/kyc';
import Image from 'next/image';

interface ChatInterfaceProps {
  token: string;
  caseId: string;
  initialMessages: MessageData[];
  initialMandatoryPercent: number;
  initialDocsPercent: number;
  initialStatus: CaseStatus;
  initialCanSubmit: boolean;
  entityType: string | null;
  submittedToCompliance: boolean;
  initialDocuments: DocumentData[];
}

interface SSEEvent {
  type: 'status' | 'progress' | 'response_start' | 'delta' | 'done' | 'error';
  text?: string;
  message?: string;
  mandatoryPercent?: number;
  docsPercent?: number;
  completionPercent?: number;
  status?: CaseStatus;
  canSubmit?: boolean;
  enrichments?: unknown[];
}

export function ChatInterface({
  token,
  caseId,
  initialMessages,
  initialMandatoryPercent,
  initialDocsPercent,
  initialStatus,
  initialCanSubmit,
  entityType: initialEntityType,
  submittedToCompliance: initialSubmitted,
  initialDocuments,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<MessageData[]>(initialMessages);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mandatoryPercent, setMandatoryPercent] = useState(initialMandatoryPercent);
  const [docsPercent, setDocsPercent] = useState(initialDocsPercent);
  const [caseStatus, setCaseStatus] = useState<CaseStatus>(initialStatus);
  const [canSubmit, setCanSubmit] = useState(initialCanSubmit);
  const [streamingText, setStreamingText] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [submittedToCompliance, setSubmittedToCompliance] = useState(initialSubmitted);

  // UI state
  const [showCaseIdToast, setShowCaseIdToast] = useState(false);
  const [caseIdCopied, setCaseIdCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // Required Documents panel state
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [uploadedDocuments, setUploadedDocuments] = useState<DocumentData[]>(initialDocuments);
  const [entityType, setEntityType] = useState<string | null>(initialEntityType);

  // Pasted image state
  const [pastedImage, setPastedImage] = useState<{
    base64: string;
    mimeType: string;
    preview: string;
  } | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText, isLoading]);

  // Collaboration polling — refresh messages from other contributors every 30s
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      if (isLoading) return;
      try {
        const res = await fetch(`/api/cases/${token}`);
        if (!res.ok) return;
        const data = await res.json();
        const kycCase = data.case;
        if (!kycCase) return;

        // Update progress bars
        if (kycCase.mandatory_percent !== undefined) setMandatoryPercent(kycCase.mandatory_percent);
        if (kycCase.docs_percent !== undefined) setDocsPercent(kycCase.docs_percent);
        if (kycCase.status) setCaseStatus(kycCase.status as CaseStatus);
        if (kycCase.submitted_to_compliance) setSubmittedToCompliance(true);

        // Sync documents and entity type
        if (kycCase.documents) {
          setUploadedDocuments(kycCase.documents.map((d: DocumentData) => ({
            ...d,
            created_at: new Date(d.created_at),
          })));
        }
        if (kycCase.counterparty?.entity_type) {
          setEntityType(kycCase.counterparty.entity_type);
        }

        // Add any new messages from other contributors
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newMsgs: MessageData[] = (kycCase.messages ?? [])
            .filter((m: MessageData) => !existingIds.has(m.id))
            .map((m: MessageData) => ({ ...m, created_at: new Date(m.created_at) }));
          if (newMsgs.length === 0) return prev;
          return [...prev, ...newMsgs];
        });
      } catch {
        // ignore poll errors
      }
    }, 30000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [token, isLoading]);

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInputText(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? inputText).trim();
    const imageSnapshot = pastedImage;
    if ((!text && !imageSnapshot) || isLoading) return;

    setInputText('');
    setPastedImage(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const displayContent = imageSnapshot
      ? `${imageSnapshot.preview}\n${text || ''}`.trim()
      : text;

    const userMsg: MessageData = {
      id: `tmp-${Date.now()}`,
      role: 'user',
      content: displayContent,
      metadata: null,
      created_at: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setStreamingText('');
    setStatusMessage('');

    try {
      const response = await fetch(`/api/chat/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text || '📷 Image shared for review.',
          ...(imageSnapshot && { imageData: imageSnapshot.base64, imageMimeType: imageSnapshot.mimeType }),
        }),
      });

      if (!response.ok || !response.body) throw new Error('Failed to connect');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event: SSEEvent = JSON.parse(line.slice(6));

            switch (event.type) {
              case 'status':
                setStatusMessage(event.message ?? '');
                break;
              case 'progress':
                if (event.mandatoryPercent !== undefined) setMandatoryPercent(event.mandatoryPercent);
                if (event.docsPercent !== undefined) setDocsPercent(event.docsPercent);
                if (event.status) setCaseStatus(event.status);
                if (event.canSubmit !== undefined) setCanSubmit(event.canSubmit);
                break;
              case 'response_start':
                setStatusMessage('');
                break;
              case 'delta':
                if (event.text) {
                  accumulatedText += event.text;
                  setStreamingText(accumulatedText);
                }
                break;
              case 'done':
                if (event.mandatoryPercent !== undefined) setMandatoryPercent(event.mandatoryPercent);
                if (event.docsPercent !== undefined) setDocsPercent(event.docsPercent);
                if (event.status) setCaseStatus(event.status);
                if (event.canSubmit !== undefined) setCanSubmit(event.canSubmit);
                // Replace temp-ID messages with real DB messages so the collaboration
                // poll's ID-based deduplication doesn't create duplicates.
                try {
                  const syncRes = await fetch(`/api/cases/${token}`);
                  const syncData = await syncRes.json();
                  if (syncData.case?.messages) {
                    setMessages(
                      (syncData.case.messages as MessageData[]).map((m) => ({
                        ...m,
                        created_at: new Date(m.created_at),
                      }))
                    );
                    // Sync documents and entity type after each AI response
                    if (syncData.case.documents) {
                      setUploadedDocuments(syncData.case.documents.map((d: DocumentData) => ({
                        ...d,
                        created_at: new Date(d.created_at),
                      })));
                    }
                    if (syncData.case.counterparty?.entity_type) {
                      setEntityType(syncData.case.counterparty.entity_type);
                    }
                  } else {
                    setMessages((prev) => [
                      ...prev,
                      { id: `msg-${Date.now()}`, role: 'assistant', content: accumulatedText, metadata: null, created_at: new Date() },
                    ]);
                  }
                } catch {
                  setMessages((prev) => [
                    ...prev,
                    { id: `msg-${Date.now()}`, role: 'assistant', content: accumulatedText, metadata: null, created_at: new Date() },
                  ]);
                }
                setStreamingText('');
                setIsLoading(false);
                break;
              case 'error':
                setMessages((prev) => [
                  ...prev,
                  { id: `err-${Date.now()}`, role: 'assistant', content: `Sorry, something went wrong: ${event.message ?? 'Unknown error'}. Please try again.`, metadata: null, created_at: new Date() },
                ]);
                setStreamingText('');
                setIsLoading(false);
                break;
            }
          } catch { /* ignore partial JSON */ }
        }
      }
    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: 'assistant', content: 'Sorry, I had trouble connecting. Please check your connection and try again.', metadata: null, created_at: new Date() },
      ]);
      setStreamingText('');
      setIsLoading(false);
    }
  }, [inputText, isLoading, token, pastedImage]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find((i) => i.type.startsWith('image/'));
    if (!imageItem) return; // let normal text paste through
    e.preventDefault();
    const file = imageItem.getAsFile();
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const originalDataUrl = ev.target?.result as string;

      // Compress & normalise to JPEG — max 1280px wide, 85% quality
      // This ensures a consistent supported format and avoids large payload sizes.
      const img = new window.Image();
      img.onload = () => {
        const MAX = 1280;
        const scale = img.width > MAX ? MAX / img.width : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setPastedImage({ base64: originalDataUrl.split(',')[1], mimeType: 'image/png', preview: originalDataUrl });
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setPastedImage({ base64: compressedDataUrl.split(',')[1], mimeType: 'image/jpeg', preview: compressedDataUrl });
      };
      img.src = originalDataUrl;
    };
    reader.readAsDataURL(file);
  }

  function handleSaveProgress() {
    navigator.clipboard.writeText(token).then(() => {
      setCaseIdCopied(true);
      setShowCaseIdToast(true);
      setTimeout(() => { setCaseIdCopied(false); setShowCaseIdToast(false); }, 3000);
    });
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch(`/api/upload/${token}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.documents) {
        setUploadedDocuments(data.documents.map((d: DocumentData) => ({
          ...d,
          created_at: new Date(d.created_at),
        })));
      }
    } catch { /* ignore */ }
  }, [token]);

  function handleUploadComplete(_docType: string, filename: string, aiMessage?: string) {
    if (aiMessage) {
      setMessages((prev) => [
        ...prev,
        { id: `upload-${Date.now()}`, role: 'assistant', content: aiMessage, metadata: null, created_at: new Date() },
      ]);
    }
    fetchDocuments();
  }

  function handleProgressUpdate(mandatory: number, docs: number) {
    setMandatoryPercent(mandatory);
    setDocsPercent(docs);
  }

  async function handleSubmitToCompliance() {
    setIsSubmitting(true);
    setSubmitError('');
    setShowSubmitConfirm(false);

    try {
      const res = await fetch(`/api/submit/${token}`, { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        if (data.missingFields?.length) {
          setSubmitError(`Missing required fields: ${data.missingFields.join(', ')}`);
        } else {
          setSubmitError(data.error ?? 'Submission failed. Please try again.');
        }
        return;
      }

      setSubmittedToCompliance(true);
      setCaseStatus('submitted_to_compliance');
      setMessages((prev) => [
        ...prev,
        {
          id: `submit-${Date.now()}`,
          role: 'assistant',
          content: `✅ **Onboarding pack submitted to compliance!**\n\nYour application has been sent to the MetCon compliance team. They will review your information and be in touch within **2 business days**.\n\nIf you have questions, email **compliance@metcon.co.za** and quote Case ID: \`${caseId}\`.`,
          metadata: null,
          created_at: new Date(),
        },
      ]);
    } catch {
      setSubmitError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const isSubmittedStatus = caseStatus === 'submitted_to_compliance' || submittedToCompliance;

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* ── Header ─────────────────────────────── */}
      <header className="bg-white text-gray-900 px-4 py-3 shadow-sm border-b border-gray-200">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            {/* Logo + title */}
            <div className="flex items-center gap-3">
              <div className="h-8 w-[73px] rounded overflow-hidden bg-gray-100 shrink-0">
                <Image
                  src="/mc-logo.jpg"
                  alt="MetCon"
                  width={73}
                  height={32}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h1 className="text-sm font-bold leading-tight">MetCon KYC Onboarding</h1>
                <p className="text-xs text-gray-500">
                  Case ID: <code className="bg-gray-100 px-1 rounded">{caseId.slice(0, 12)}…</code>
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1.5">
              {/* Save Progress / Case ID */}
              <button
                onClick={handleSaveProgress}
                title="Save progress — copies your Case ID"
                className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
              >
                {caseIdCopied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Save className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{caseIdCopied ? 'Copied!' : 'Save'}</span>
              </button>

              {/* Share link */}
              <button
                onClick={handleCopyLink}
                title="Copy share link"
                className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
              >
                {linkCopied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{linkCopied ? 'Copied!' : 'Share'}</span>
              </button>

              {/* Download PDF */}
              <a
                href={`/api/pdf/${token}`}
                target="_blank"
                rel="noreferrer"
                title="Download completed KYC pack as PDF"
                className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">PDF</span>
              </a>

              {/* Submit to Compliance */}
              {!isSubmittedStatus && (
                <button
                  onClick={() => setShowSubmitConfirm(true)}
                  disabled={!canSubmit || isSubmitting}
                  title={canSubmit ? 'Send onboarding pack to compliance team' : 'Complete mandatory fields first'}
                  className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                    canSubmit
                      ? 'bg-green-500 hover:bg-green-400 text-white'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Sending…' : 'Submit'}</span>
                </button>
              )}

              {isSubmittedStatus && (
                <span className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-green-600 text-white font-medium">
                  <Check className="w-3.5 h-3.5" />
                  Submitted
                </span>
              )}
            </div>
          </div>

          {/* Dual progress bars */}
          <DualProgressBar
            mandatoryPercent={mandatoryPercent}
            docsPercent={docsPercent}
            canSubmit={canSubmit && !isSubmittedStatus}
          />
        </div>
      </header>

      {/* ── Case ID Toast ─────────────────────── */}
      {showCaseIdToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-4 py-2.5 rounded-xl shadow-lg text-sm flex items-center gap-2">
          <Check className="w-4 h-4 text-green-400" />
          <span>Case ID copied to clipboard!</span>
          <button onClick={() => setShowCaseIdToast(false)} className="ml-1 text-gray-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Submit confirmation dialog ─────────── */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Send to Compliance Team?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will send your onboarding pack to <strong>grant.crosse@metcon.co.za</strong> with all collected information
              and uploaded documents. You can still add more information after submitting.
            </p>
            <div className="bg-blue-50 rounded-xl p-3 mb-4 text-xs text-blue-700">
              📊 {mandatoryPercent}% mandatory info · 📄 {docsPercent}% documents supplied
            </div>
            {submitError && (
              <div className="bg-red-50 rounded-xl p-3 mb-4 text-xs text-red-700">{submitError}</div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowSubmitConfirm(false); setSubmitError(''); }}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitToCompliance}
                disabled={isSubmitting}
                className="flex-1 py-2.5 rounded-xl bg-[#1a1a2e] text-white text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-60"
              >
                {isSubmitting ? 'Sending…' : 'Send to Compliance'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Submit error banner ───────────────── */}
      {submitError && !showSubmitConfirm && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-xs text-red-700 flex items-center justify-between">
          <span>{submitError}</span>
          <button onClick={() => setSubmitError('')} className="ml-2 text-red-400 hover:text-red-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Messages ───────────────────────────── */}
      <main className="flex-1 overflow-y-auto py-4 px-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              role={msg.role}
              content={msg.content}
              timestamp={new Date(msg.created_at)}
            />
          ))}

          {isLoading && streamingText && (
            <MessageBubble role="assistant" content={streamingText} isStreaming />
          )}

          {isLoading && !streamingText && (
            <div>
              {statusMessage && (
                <p className="text-xs text-gray-400 mb-1 ml-10 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  {statusMessage}
                </p>
              )}
              <TypingIndicator />
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      {/* ── Required Documents FAB ──────────────── */}
      {(() => {
        const relevant = getRelevantDocs(entityType);
        const relevantTypes = new Set(relevant.map((d) => d.doc_type));
        const matched = uploadedDocuments.filter((d) => relevantTypes.has(d.doc_type)).length;
        return (
          <RequiredDocumentsButton
            uploadedCount={matched}
            totalCount={relevant.length}
            onClick={() => setIsPanelOpen(true)}
          />
        );
      })()}

      {/* ── Required Documents Panel ─────────────── */}
      <RequiredDocumentsPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        token={token}
        entityType={entityType}
        uploadedDocuments={uploadedDocuments}
        onUploadComplete={handleUploadComplete}
        onProgressUpdate={handleProgressUpdate}
        onDocumentsChange={fetchDocuments}
      />

      {/* ── Quick chips ────────────────────────── */}
      {!isLoading && messages.length <= 2 && (
        <div className="px-4 pb-2">
          <div className="max-w-3xl mx-auto flex flex-wrap gap-2">
            {[
              'I am a company',
              'I am an individual',
              'What is a UBO?',
              "I'll email the documents later",
              'Show my progress',
            ].map((chip) => (
              <button
                key={chip}
                onClick={() => sendMessage(chip)}
                className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-full text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Input bar ─────────────────────────── */}
      <footer className="bg-white border-t border-gray-200 px-4 py-3 shadow-up">
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          <FileUpload
            token={token}
            onUploadComplete={handleUploadComplete}
            onProgressUpdate={handleProgressUpdate}
          />

          <div className="flex-1 relative">
            {pastedImage && (
              <div className="relative w-20 h-20 mb-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pastedImage.preview} alt="Pasted image" className="w-20 h-20 object-cover rounded-lg border border-gray-300" />
                <button
                  onClick={() => setPastedImage(null)}
                  className="absolute -top-1.5 -right-1.5 bg-gray-700 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-gray-900 transition-colors"
                  title="Remove image"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={pastedImage ? 'Add a note (optional)… or press Enter to send' : 'Type your message or paste an image… (Enter to send, Shift+Enter for new line)'}
              disabled={isLoading}
              className="w-full resize-none rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent disabled:opacity-50 transition"
            />
          </div>

          <button
            onClick={() => sendMessage()}
            disabled={(!inputText.trim() && !pastedImage) || isLoading}
            className="shrink-0 w-10 h-10 bg-[#1a1a2e] rounded-xl flex items-center justify-center text-white hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow"
            title="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-center text-[10px] text-gray-400 mt-2">
          Your information is stored securely and used only for FICA compliance purposes. POPIA compliant.
        </p>
      </footer>
    </div>
  );
}
