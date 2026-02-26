'use client';

import { useState, useRef } from 'react';
import { Paperclip, Upload, X, CheckCircle, AlertCircle } from 'lucide-react';
import { DOC_TYPE_LABELS } from '@/lib/document-checklist';

interface FileUploadProps {
  token: string;
  onUploadComplete?: (docType: string, filename: string, aiMessage?: string) => void;
  onProgressUpdate?: (mandatory: number, docs: number) => void;
}

const DOC_TYPES = Object.entries(DOC_TYPE_LABELS).map(([value, label]) => ({ value, label }));

type UploadState = 'idle' | 'selecting' | 'uploading' | 'success' | 'error';

export function FileUpload({ token, onUploadComplete, onProgressUpdate }: FileUploadProps) {
  const [state, setState] = useState<UploadState>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docType, setDocType] = useState('other');
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      setErrorMessage('File too large (max 50 MB)');
      setState('error');
      return;
    }
    setSelectedFile(file);
    setState('selecting');
    setErrorMessage('');
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setState('uploading');

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('doc_type', docType);

    try {
      const res = await fetch(`/api/upload/${token}`, { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? 'Upload failed');

      setState('success');
      onUploadComplete?.(docType, selectedFile.name, data.aiMessage);
      if (data.mandatoryPercent !== undefined) {
        onProgressUpdate?.(data.mandatoryPercent, data.docsPercent);
      }

      setTimeout(() => {
        setState('idle');
        setSelectedFile(null);
        setDocType('other');
        if (fileInputRef.current) fileInputRef.current.value = '';
      }, 2500);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed');
      setState('error');
    }
  }

  function handleCancel() {
    setState('idle');
    setSelectedFile(null);
    setErrorMessage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        title="Upload document (click to attach)"
      >
        <Paperclip className="w-5 h-5" />
      </button>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"
        onChange={handleFileSelect}
      />

      {state !== 'idle' && (
        <div className="absolute bottom-full mb-2 right-0 w-80 bg-white rounded-xl shadow-lg border border-gray-200 p-4 z-10">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-800">Upload Document</span>
            <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          {state === 'success' ? (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-medium">Uploaded! AI is analysing…</span>
            </div>
          ) : state === 'error' ? (
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm">{errorMessage}</span>
            </div>
          ) : (
            <>
              {selectedFile && (
                <div className="bg-gray-50 rounded-lg px-3 py-2 mb-3">
                  <p className="text-xs font-medium text-gray-700 truncate">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                </div>
              )}

              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Document type</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {DOC_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <p className="text-xs text-gray-500 mb-2">
                AI will read this document and ask you to confirm any extracted information.
              </p>

              <button
                onClick={handleUpload}
                disabled={!selectedFile || state === 'uploading'}
                className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white text-sm font-medium py-2 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {state === 'uploading' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Uploading & analysing…
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload
                  </>
                )}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
