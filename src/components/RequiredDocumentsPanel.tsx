'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, CheckCircle, FileText, Upload, RefreshCw, AlertCircle, Info } from 'lucide-react';
import { getRelevantDocs, type ChecklistItem } from '@/lib/document-checklist';

interface UploadedDoc {
  id: string;
  doc_type: string;
  original_name: string;
  file_size: number;
  created_at: Date | string;
}

interface RequiredDocumentsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  entityType: string | null;
  uploadedDocuments: UploadedDoc[];
  onUploadComplete: (docType: string, filename: string, aiMessage?: string) => void;
  onProgressUpdate: (mandatory: number, docs: number) => void;
  onDocumentsChange: () => void;
}

type TileUploadState = 'idle' | 'uploading' | 'success' | 'error';

interface TileData extends ChecklistItem {
  isUploaded: boolean;
  uploadedFile?: UploadedDoc;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function RequiredDocumentsPanel({
  isOpen,
  onClose,
  token,
  entityType,
  uploadedDocuments,
  onUploadComplete,
  onProgressUpdate,
  onDocumentsChange,
}: RequiredDocumentsPanelProps) {
  const [activeDocType, setActiveDocType] = useState<string | null>(null);
  const [tileState, setTileState] = useState<TileUploadState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Build tile list
  const relevantDocs = getRelevantDocs(entityType);
  const uploadedTypes = new Set(uploadedDocuments.map((d) => d.doc_type));

  const tiles: TileData[] = relevantDocs.map((item) => ({
    ...item,
    isUploaded: uploadedTypes.has(item.doc_type),
    uploadedFile: uploadedDocuments.find((d) => d.doc_type === item.doc_type),
  }));

  // Sort: pending first (so user sees what's needed), then uploaded
  const sortedTiles = [
    ...tiles.filter((t) => !t.isUploaded),
    ...tiles.filter((t) => t.isUploaded),
  ];

  const handleTileClick = useCallback((docType: string) => {
    setActiveDocType(docType);
    setTileState('idle');
    setErrorMessage('');
    // Small delay to ensure state is set before click
    setTimeout(() => fileInputRef.current?.click(), 50);
  }, []);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activeDocType) return;

    if (file.size > 50 * 1024 * 1024) {
      setErrorMessage('File too large (max 50 MB)');
      setTileState('error');
      return;
    }

    setTileState('uploading');
    setErrorMessage('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('doc_type', activeDocType);

    try {
      const res = await fetch(`/api/upload/${token}`, { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? 'Upload failed');

      setTileState('success');
      onUploadComplete(activeDocType, file.name, data.aiMessage);
      if (data.mandatoryPercent !== undefined) {
        onProgressUpdate(data.mandatoryPercent, data.docsPercent);
      }
      onDocumentsChange();

      setTimeout(() => {
        setTileState('idle');
        setActiveDocType(null);
      }, 1500);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed');
      setTileState('error');
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  if (!isOpen) return null;

  const uploadedCount = tiles.filter((t) => t.isUploaded).length;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Panel — bottom sheet on mobile, right panel on desktop */}
      <div
        ref={panelRef}
        className="fixed z-40 bg-white shadow-2xl flex flex-col animate-slide-up md:animate-slide-in-right
          inset-x-0 bottom-0 max-h-[75vh] rounded-t-2xl
          md:inset-x-auto md:right-0 md:top-0 md:bottom-0 md:max-h-none md:w-[400px] md:rounded-t-none md:rounded-l-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">Required Documents</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {uploadedCount} of {tiles.length} uploaded
              {entityType && <span className="text-gray-400"> &middot; {entityType}</span>}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Entity type hint */}
        {!entityType && (
          <div className="mx-5 mt-3 flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2.5 text-xs text-blue-700">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>Tell the AI your entity type (Company or Individual) to see a tailored checklist.</span>
          </div>
        )}

        {/* Progress bar */}
        <div className="px-5 pt-3 pb-2 shrink-0">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{
                width: `${tiles.length > 0 ? (uploadedCount / tiles.length) * 100 : 0}%`,
                backgroundColor: uploadedCount >= tiles.length ? '#16a34a' : '#2563eb',
              }}
            />
          </div>
        </div>

        {/* Tiles list */}
        <div className="flex-1 overflow-y-auto px-5 py-2 space-y-2">
          {sortedTiles.map((tile) => {
            const isActiveUploading = activeDocType === tile.doc_type && tileState === 'uploading';
            const isActiveSuccess = activeDocType === tile.doc_type && tileState === 'success';
            const isActiveError = activeDocType === tile.doc_type && tileState === 'error';

            return (
              <div
                key={tile.doc_type}
                className={`rounded-xl border px-4 py-3 transition-all ${
                  tile.isUploaded || isActiveSuccess
                    ? 'border-green-200 bg-green-50'
                    : isActiveError
                    ? 'border-red-200 bg-red-50'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={`mt-0.5 shrink-0 ${
                    tile.isUploaded || isActiveSuccess ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    {tile.isUploaded || isActiveSuccess
                      ? <CheckCircle className="w-5 h-5" />
                      : isActiveUploading
                      ? <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
                      : isActiveError
                      ? <AlertCircle className="w-5 h-5 text-red-500" />
                      : <FileText className="w-5 h-5" />
                    }
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium leading-tight ${
                      tile.isUploaded ? 'text-green-800' : 'text-gray-800'
                    }`}>
                      {tile.label}
                    </p>

                    {tile.isUploaded && tile.uploadedFile && (
                      <p className="text-xs text-green-600 mt-0.5 truncate">
                        {tile.uploadedFile.original_name} &middot; {formatFileSize(tile.uploadedFile.file_size)} &middot; {timeAgo(tile.uploadedFile.created_at)}
                      </p>
                    )}

                    {isActiveUploading && (
                      <p className="text-xs text-blue-600 mt-0.5">Uploading & analysing...</p>
                    )}

                    {isActiveError && errorMessage && (
                      <p className="text-xs text-red-600 mt-0.5">{errorMessage}</p>
                    )}

                    {isActiveSuccess && (
                      <p className="text-xs text-green-600 mt-0.5">Uploaded successfully!</p>
                    )}
                  </div>

                  {/* Upload / Re-upload button */}
                  {!isActiveUploading && !isActiveSuccess && (
                    <button
                      onClick={() => handleTileClick(tile.doc_type)}
                      className={`shrink-0 flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
                        tile.isUploaded
                          ? 'text-green-700 hover:bg-green-100'
                          : 'bg-gray-900 text-white hover:bg-gray-800'
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {tile.isUploaded ? 'Replace' : 'Upload'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer hint */}
        <div className="px-5 py-3 border-t border-gray-100 shrink-0">
          <p className="text-[10px] text-gray-400 text-center">
            Accepted: PDF, JPEG, PNG, WebP (max 50 MB). AI will extract information automatically.
          </p>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"
        onChange={handleFileSelected}
      />
    </>
  );
}
