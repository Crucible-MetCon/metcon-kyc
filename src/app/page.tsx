'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, MessageCircle, ArrowRight, Lock, FileText, Users } from 'lucide-react';
import Image from 'next/image';

export default function LandingPage() {
  const router = useRouter();
  const [resumeToken, setResumeToken] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  async function startNewOnboarding() {
    setIsCreating(true);
    setError('');
    try {
      const res = await fetch('/api/cases', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to create case');
      const { token } = await res.json();
      router.push(`/chat/${token}`);
    } catch {
      setError('Could not start onboarding. Please try again.');
      setIsCreating(false);
    }
  }

  function resumeExisting() {
    const t = resumeToken.trim();
    if (!t) return;
    // Accept full token or partial case ID
    router.push(`/chat/${t}`);
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 border-b border-gray-200">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-[91px] rounded-xl overflow-hidden bg-gray-100 shrink-0">
              <Image
                src="/mc-logo.jpg"
                alt="MetCon logo"
                width={91}
                height={40}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">Metal Concentrators SA</h1>
              <p className="text-xs text-gray-500">FICA-Compliant KYC Onboarding</p>
            </div>
          </div>
          <a
            href="/admin/login"
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Compliance Login
          </a>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-gray-100 text-gray-600 text-sm font-medium px-4 py-1.5 rounded-full mb-4">
              <Shield className="w-4 h-4" />
              FICA Compliant · South Africa · KYC DOC 011
            </div>
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              KYC Onboarding,{' '}
              <span className="text-green-600">the human way</span>
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              Complete your Know Your Customer verification through a friendly AI conversation — no endless forms.
              Upload documents for instant extraction. Collaborate with colleagues via a shared link.
            </p>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
            {[
              {
                icon: <MessageCircle className="w-5 h-5 text-green-600" />,
                title: 'Conversational',
                desc: 'Chat naturally — share details in your own words. Upload docs and the AI extracts them automatically.',
              },
              {
                icon: <Users className="w-5 h-5 text-blue-600" />,
                title: 'Collaborative',
                desc: 'Share the link with colleagues. Multiple people can contribute to the same onboarding simultaneously.',
              },
              {
                icon: <Lock className="w-5 h-5 text-purple-600" />,
                title: 'Secure & POPIA Compliant',
                desc: 'Your data is stored securely and used only for FICA compliance. Auto-saves so you can resume anytime.',
              },
            ].map((f) => (
              <div key={f.title} className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
                <div className="mb-3">{f.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
                <p className="text-sm text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Action cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Start new */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-green-50 border border-green-200 rounded-xl flex items-center justify-center">
                  <FileText className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Start Onboarding</h3>
              </div>
              <p className="text-sm text-gray-500 mb-5">
                New to MetCon? Begin your KYC/FICA onboarding. Takes 10–20 minutes. You can stop and resume anytime.
              </p>
              {error && (
                <p className="text-sm text-red-600 mb-3 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}
              <button
                onClick={startNewOnboarding}
                disabled={isCreating}
                className="w-full flex items-center justify-center gap-2 bg-green-600 text-white font-semibold py-3 rounded-xl hover:bg-green-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
              >
                {isCreating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Starting…
                  </>
                ) : (
                  <>
                    Start KYC <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            {/* Resume existing */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-center">
                  <ArrowRight className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Resume Onboarding</h3>
              </div>
              <p className="text-sm text-gray-500 mb-5">
                Have a case link or token? Paste it below to continue. Anyone with the link can contribute.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={resumeToken}
                  onChange={(e) => setResumeToken(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && resumeExisting()}
                  placeholder="Paste your case token…"
                  className="flex-1 text-sm bg-white border border-gray-300 text-gray-900 placeholder-gray-400 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={resumeExisting}
                  disabled={!resumeToken.trim()}
                  className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-colors disabled:opacity-50 font-semibold text-sm"
                >
                  Go
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-gray-400 border-t border-gray-200">
        © {new Date().getFullYear()} Metal Concentrators SA (MetCon) · FICA KYC DOC 011 · POPIA Compliant · Powered by Claude AI
      </footer>
    </div>
  );
}
