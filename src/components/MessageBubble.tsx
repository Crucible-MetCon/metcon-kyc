'use client';

import ReactMarkdown from 'react-markdown';
import Image from 'next/image';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  isStreaming?: boolean;
}

export function MessageBubble({ role, content, timestamp, isStreaming }: MessageBubbleProps) {
  const isAgent = role === 'assistant';

  return (
    <div className={`flex items-end gap-2 animate-slide-up ${isAgent ? 'justify-start' : 'justify-end'}`}>
      {/* Agent avatar — MC logo */}
      {isAgent && (
        <div className="shrink-0 h-7 w-16 rounded-lg bg-[#1a1a2e] flex items-center justify-center shadow overflow-hidden">
          <Image
            src="/mc-logo.jpg"
            alt="MetCon"
            width={64}
            height={28}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback if logo not found
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
          {/* Fallback text in case image fails */}
          <span className="text-white text-xs font-bold hidden">MC</span>
        </div>
      )}

      {/* Bubble */}
      <div
        className={`max-w-[80%] px-4 py-3 rounded-2xl shadow-sm ${
          isAgent
            ? 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
            : 'bg-[#1a1a2e] text-white rounded-br-sm'
        }`}
      >
        {isAgent ? (
          <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-strong:text-gray-900 prose-code:text-xs prose-code:bg-gray-100 prose-code:px-1 prose-code:rounded">
            <ReactMarkdown>{content}</ReactMarkdown>
            {isStreaming && (
              <span className="inline-flex items-center gap-0.5 ml-1">
                <span className="w-1 h-1 rounded-full bg-gray-400 animate-pulse-dot" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 rounded-full bg-gray-400 animate-pulse-dot" style={{ animationDelay: '160ms' }} />
                <span className="w-1 h-1 rounded-full bg-gray-400 animate-pulse-dot" style={{ animationDelay: '320ms' }} />
              </span>
            )}
          </div>
        ) : (
          (() => {
            // Detect embedded pasted image: content may start with a data URL followed by optional text
            if (content.startsWith('data:image/')) {
              const newlineIdx = content.indexOf('\n');
              const imgSrc = newlineIdx === -1 ? content : content.slice(0, newlineIdx);
              const caption = newlineIdx === -1 ? '' : content.slice(newlineIdx + 1).trim();
              return (
                <div className="flex flex-col gap-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imgSrc} alt="Pasted image" className="max-w-[220px] rounded-lg border border-white/20 object-contain" />
                  {caption && <p className="text-sm whitespace-pre-wrap break-words">{caption}</p>}
                </div>
              );
            }
            return <p className="text-sm whitespace-pre-wrap break-words">{content}</p>;
          })()
        )}

        {timestamp && (
          <p className={`text-[10px] mt-1 ${isAgent ? 'text-gray-400' : 'text-gray-400'}`}>
            {timestamp.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>

      {/* User avatar */}
      {!isAgent && (
        <div className="shrink-0 w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-white text-sm font-bold shadow">
          Y
        </div>
      )}
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div className="shrink-0 h-7 w-16 rounded-lg bg-[#1a1a2e] flex items-center justify-center shadow overflow-hidden">
        <Image src="/mc-logo.jpg" alt="MetCon" width={64} height={28} className="w-full h-full object-cover" />
      </div>
      <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-gray-300 animate-pulse-dot" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full bg-gray-300 animate-pulse-dot" style={{ animationDelay: '200ms' }} />
          <span className="w-2 h-2 rounded-full bg-gray-300 animate-pulse-dot" style={{ animationDelay: '400ms' }} />
        </div>
      </div>
    </div>
  );
}
