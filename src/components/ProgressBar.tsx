'use client';

interface DualProgressBarProps {
  mandatoryPercent: number;
  docsPercent: number;
  canSubmit: boolean;
  className?: string;
}

export function DualProgressBar({ mandatoryPercent, docsPercent, canSubmit, className = '' }: DualProgressBarProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {/* Bar A: Mandatory Information */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-600">Mandatory Information</span>
          <span className={`text-xs font-bold ${mandatoryPercent === 100 ? 'text-green-700' : 'text-blue-700'}`}>
            {mandatoryPercent}%
          </span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${mandatoryPercent === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
            style={{ width: `${Math.min(100, Math.max(0, mandatoryPercent))}%` }}
          />
        </div>
      </div>

      {/* Bar B: Documents */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-600">Documents Supplied</span>
          <span className={`text-xs font-bold ${docsPercent >= 70 ? 'text-green-700' : 'text-amber-700'}`}>
            {docsPercent}%
          </span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${docsPercent >= 70 ? 'bg-green-500' : docsPercent >= 30 ? 'bg-amber-500' : 'bg-orange-400'}`}
            style={{ width: `${Math.min(100, Math.max(0, docsPercent))}%` }}
          />
        </div>
      </div>

      {/* Can-submit indicator */}
      {canSubmit && (
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span className="text-xs text-green-700 font-medium">Ready to submit to compliance</span>
        </div>
      )}
    </div>
  );
}

// Legacy single bar for backwards compat
interface ProgressBarProps {
  percent: number;
  status: string;
  className?: string;
}

export function ProgressBar({ percent, status, className = '' }: ProgressBarProps) {
  const isComplete = status === 'complete' || status === 'submitted_to_compliance';
  const color = isComplete ? 'bg-green-500' : status === 'needs_review' ? 'bg-amber-500' : 'bg-blue-500';
  const textColor = isComplete ? 'text-green-700' : status === 'needs_review' ? 'text-amber-700' : 'text-blue-700';

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-600">Overall Progress</span>
          <span className={`text-xs font-bold ${textColor}`}>{percent}%</span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${color}`}
            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          />
        </div>
      </div>
    </div>
  );
}
