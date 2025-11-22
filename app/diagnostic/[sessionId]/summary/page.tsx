"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { usePostHog } from "posthog-js/react";
import { trackEvent, ANALYTICS_EVENTS } from "@/lib/analytics/analytics";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrialConversionModal } from "@/components/billing/TrialConversionModal";
import { UpsellModal } from "@/components/diagnostic/UpsellModal";
import { useUpsell } from "@/hooks/useUpsell";
import { useTriggerDetection } from "@/hooks/useTriggerDetection";
import { QuestionSummary, DomainBreakdown, SessionSummary } from "@/components/diagnostic/types";
import { getExamReadinessTier, getDomainTier, getDomainTierColors } from "@/lib/readiness";
import { PMLE_BLUEPRINT } from "@/lib/constants/pmle-blueprint";
import { useToastQueue, Toast } from "@/components/ui/toast";

// Extended types for UI-specific fields
interface ExtendedQuestionSummary extends QuestionSummary {
  timeSpent?: number;
  isFlagged?: boolean;
  confidence?: 'low' | 'medium' | 'high';
}

interface ExtendedSessionSummary extends SessionSummary {
  totalTimeSpent?: number;
  averageTimePerQuestion?: number;
  flaggedCount?: number;
}

// Helper function to get complete stroke color class name for SVG
// This ensures Tailwind can detect the classes at build time
const getStrokeColorClass = (tierId: string): string => {
  if (tierId === 'low') return 'text-red-600';
  if (tierId === 'building') return 'text-orange-600';
  if (tierId === 'ready') return 'text-blue-600';
  return 'text-emerald-600'; // strong
};

const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

// Helper to map display name back to domain code
const getDomainCodeFromDisplayName = (displayName: string): string | null => {
  const config = PMLE_BLUEPRINT.find(d => d.displayName === displayName);
  return config?.domainCode || null;
};

// Minimum attempts required for a domain to be eligible for practice
const MIN_DOMAIN_ATTEMPTS_FOR_PRACTICE = 1;

// Select weakest 2-3 domains with sufficient attempts
const selectWeakestDomains = (domainBreakdown: DomainBreakdown[]): string[] => {
  // Filter domains with sufficient attempts and sort by percentage (lowest first)
  const eligibleDomains = domainBreakdown
    .filter(d => d.total >= MIN_DOMAIN_ATTEMPTS_FOR_PRACTICE)
    .sort((a, b) => a.percentage - b.percentage);
  
  // Select top 2-3 weakest domains
  const selectedDomains = eligibleDomains.slice(0, 3);
  
  // Convert display names to domain codes
  const domainCodes = selectedDomains
    .map(d => getDomainCodeFromDisplayName(d.domain))
    .filter((code): code is string => code !== null);
  
  return domainCodes;
};

// Components
const StatusChip = ({ 
  type, 
  className = "" 
}: { 
  type: 'correct' | 'incorrect' | 'flagged';
  className?: string;
}) => {
  const configs = {
    correct: {
      icon: "✓",
      text: "Correct",
      classes: "text-emerald-700 border border-emerald-200 bg-emerald-50"
    },
    incorrect: {
      icon: "✗",
      text: "Incorrect", 
      classes: "text-rose-700 border border-rose-200 bg-rose-50"
    },
    flagged: {
      icon: "🚩",
      text: "Flagged",
      classes: "text-amber-700 border border-amber-200 bg-amber-50"
    }
  };

  const config = configs[type];
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.classes} ${className}`}>
      <span>{config.icon}</span>
      {config.text}
    </span>
  );
};

const VerdictBlock = ({ 
  summary, 
  onStartPractice,
  onRetakeDiagnostic,
  isLoading 
}: {
  summary: ExtendedSessionSummary;
  onStartPractice: () => void;
  onRetakeDiagnostic: () => void;
  isLoading?: boolean;
}) => {
  const readinessTier = getExamReadinessTier(summary.score);
  const strokeColorClass = getStrokeColorClass(readinessTier.id);
  const duration = summary.totalTimeSpent ? 
    formatTime(summary.totalTimeSpent) : 
    Math.round((new Date(summary.completedAt).getTime() - new Date(summary.startedAt).getTime()) / 60000) + "m";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm mb-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Gauge and Readiness */}
        <div className="flex items-center gap-6">
          <div className="relative w-24 h-24">
            <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-slate-100"
                stroke="currentColor"
                strokeWidth="3"
                fill="transparent"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className={strokeColorClass}
                stroke="currentColor"
                strokeWidth="3"
                fill="transparent"
                strokeDasharray={`${summary.score}, 100`}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-bold text-slate-900">{summary.score}%</span>
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 mb-1">
              Readiness: {readinessTier.label}
            </div>
            <div className="text-sm text-slate-500">
              Pass typically ≥70%
            </div>
          </div>
        </div>

        {/* Right: Key Facts */}
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Exam:</span>
            <span className="font-medium text-slate-900">{summary.examType} — Oct &apos;24</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Score:</span>
            <span className="font-medium text-slate-900">{summary.score}% ({summary.totalQuestions} Qs)</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Time taken:</span>
            <span className="font-medium text-slate-900">{duration}</span>
          </div>
          {summary.flaggedCount !== undefined && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Flagged:</span>
              <span className="font-medium text-slate-900">{summary.flaggedCount}</span>
            </div>
          )}
        </div>
      </div>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-3 mt-6">
        <Button onClick={onStartPractice} tone="accent" size="md" disabled={isLoading}>
          {isLoading ? "Creating practice session..." : "Start 10-min practice on your weakest topics"}
        </Button>
        <Button
          onClick={onRetakeDiagnostic}
          variant="outline"
          tone="accent"
          size="md"
          disabled={isLoading}
        >
          Retake diagnostic (20 Q)
        </Button>
      </div>
    </div>
  );
};

const DomainPerformance = ({ 
  domains, 
  onDomainClick 
}: { 
  domains: DomainBreakdown[];
  onDomainClick: (domain: string) => void;
}) => {
  // Sort domains by percentage (ascending - worst first)
  const sortedDomains = [...domains].sort((a, b) => a.percentage - b.percentage);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm mb-8">
      <h2 className="text-xl font-semibold tracking-tight text-slate-900 mb-4">Domain Performance</h2>
      <div className="space-y-3">
        {sortedDomains.map((domain) => (
          <div 
            key={domain.domain}
            onClick={() => onDomainClick(domain.domain)}
            className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors"
          >
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-slate-900">{domain.domain}</span>
                <span className="text-sm font-medium text-slate-900">{domain.percentage}%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-100 h-2 rounded">
                  <div 
                    className="bg-indigo-600 h-2 rounded transition-all duration-300"
                    style={{ width: `${domain.percentage}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500">{domain.correct}/{domain.total}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const StudyPlan = ({ 
  domains, 
  onStartPractice,
  isLoading 
}: { 
  domains: DomainBreakdown[];
  onStartPractice: (domainCodes: string[]) => void;
  isLoading?: boolean;
}) => {
  const foundation = domains.filter(d => d.percentage < 40);
  const core = domains.filter(d => d.percentage >= 40 && d.percentage < 70);
  const stretch = domains.filter(d => d.percentage >= 70);


  const StudyGroup = ({ 
    title, 
    description, 
    domains, 
    timeEstimate 
  }: { 
    title: string;
    description: string;
    domains: DomainBreakdown[];
    timeEstimate: string;
  }) => (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <span className="text-sm text-slate-500">{timeEstimate}</span>
      </div>
      <p className="text-sm text-slate-600 mb-4">{description}</p>
      <div className="space-y-2">
        {domains.map((domain) => {
          const tier = getDomainTier(domain.percentage);
          const colors = getDomainTierColors(tier.id);
          return (
            <div key={domain.domain} className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
              <div className="flex items-center gap-3">
                <span className="font-medium text-slate-900">{domain.domain}</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${colors.bg} ${colors.text}`}>
                  {tier.label}
                </span>
              </div>
              <Button
                onClick={() => onStartPractice([domain.domain])}
                size="sm"
                variant="outline"
                tone="accent"
                className="text-xs"
                disabled={isLoading}
              >
                {isLoading ? "Creating..." : "Start practice (10)"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm mb-8">
      <h2 className="text-xl font-semibold tracking-tight text-slate-900 mb-6">Study Plan</h2>
      
      {foundation.length > 0 && (
        <StudyGroup 
          title="Foundation First"
          description="Critical gaps that need immediate attention. Master these before moving on."
          domains={foundation}
          timeEstimate="35-45 min"
        />
      )}
      
      {core.length > 0 && (
        <StudyGroup 
          title="Core"
          description="Important topics that need strengthening to reach passing level."
          domains={core}
          timeEstimate="60-90 min"
        />
      )}
      
      {stretch.length > 0 && (
        <StudyGroup 
          title="Stretch"
          description="Areas where you're already strong. Practice to maintain and perfect."
          domains={stretch}
          timeEstimate="30-45 min"
        />
      )}

      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-sm text-blue-700">
          <strong>Tip:</strong> Knock out &apos;Foundation&apos; first (~35–45 min), then &apos;Core&apos; (~60–90 min). 
          Retake when your weakest three domains ≥60%.
        </p>
      </div>
    </div>
  );
};

const QuestionReview = ({ 
  questions, 
  activeFilter, 
  onFilterChange,
  selectedDomain,
  onDomainChange,
  onTrackReviewEntry,
  onTrackReviewExit,
  onTrackExpansion,
  onExplanationViewed,
}: {
  questions: ExtendedQuestionSummary[];
  activeFilter: 'all' | 'incorrect' | 'flagged' | 'low-confidence';
  onFilterChange: (filter: 'all' | 'incorrect' | 'flagged' | 'low-confidence') => void;
  selectedDomain: string | null;
  onDomainChange: (domain: string | null) => void;
  onTrackReviewEntry?: () => void;
  onTrackReviewExit?: () => void;
  onTrackExpansion?: () => void;
  onExplanationViewed?: (question: ExtendedQuestionSummary) => void;
}) => {
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const reviewSectionRef = useRef<HTMLDivElement>(null);

  // Track review section visibility for engagement trigger
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            onTrackReviewEntry?.();
          } else {
            onTrackReviewExit?.();
          }
        });
      },
      { threshold: 0.3 }
    );

    if (reviewSectionRef.current) {
      observer.observe(reviewSectionRef.current);
    }

    return () => observer.disconnect();
  }, [onTrackReviewEntry, onTrackReviewExit]);

  const toggleExpanded = useCallback((question: ExtendedQuestionSummary) => {
    setExpandedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(question.id)) {
        newSet.delete(question.id);
      } else {
        newSet.add(question.id);
        // Track expansion for upsell trigger
        onTrackExpansion?.();
        // Track explanation viewed for analytics
        onExplanationViewed?.(question);
      }
      return newSet;
    });
  }, [onTrackExpansion, onExplanationViewed]);

  // Filter questions
  const filteredQuestions = questions.filter(q => {
    // Apply filter
    if (activeFilter === 'incorrect' && q.isCorrect) return false;
    if (activeFilter === 'flagged' && !q.isFlagged) return false;
    if (activeFilter === 'low-confidence' && q.confidence !== 'low') return false;
    
    // Apply domain filter
    if (selectedDomain && q.domain !== selectedDomain) return false;
    
    // Apply search
    if (searchQuery && !q.stem.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    
    return true;
  });

  const domains = Array.from(new Set(questions.map(q => q.domain).filter(Boolean)));

  return (
    <div ref={reviewSectionRef} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm mb-8">
      <h2 className="text-xl font-semibold tracking-tight text-slate-900 mb-6">Question Review</h2>
      
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'All' },
            { key: 'incorrect', label: 'Incorrect' },
            { key: 'flagged', label: 'Flagged' },
            { key: 'low-confidence', label: 'Low Confidence' }
          ].map(filter => (
            <button
              key={filter.key}
              onClick={() => onFilterChange(filter.key as 'all' | 'incorrect' | 'flagged' | 'low-confidence')}
              className={`rounded-full px-3 py-1 text-sm border transition-colors ${
                activeFilter === filter.key
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Domain Dropdown */}
        <select
          value={selectedDomain || ''}
          onChange={(e) => onDomainChange(e.target.value || null)}
          className="px-3 py-2.5 min-h-[44px] border border-slate-300 rounded-lg text-base md:text-sm"
        >
          <option value="">All Domains</option>
          {domains.map(domain => (
            <option key={domain} value={domain}>{domain}</option>
          ))}
        </select>

        {/* Search */}
        <input
          type="text"
          placeholder="Search questions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-3 py-2.5 min-h-[44px] border border-slate-300 rounded-lg text-base md:text-sm flex-1 min-w-0"
        />
      </div>

      {/* Question Cards */}
      <div className="space-y-3">
        {filteredQuestions.map((question) => {
          const isExpanded = expandedQuestions.has(question.id);
          
          return (
            <div key={question.id} className="border border-slate-200 rounded-xl">
              {/* Collapsed Summary */}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <StatusChip type={question.isCorrect ? 'correct' : 'incorrect'} />
                  {question.isFlagged && <StatusChip type="flagged" />}
                  {question.domain && (
                    <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-medium">
                      {question.domain}
                    </span>
                  )}
                  {question.timeSpent && (
                    <span className="text-xs text-slate-500">
                      {formatTime(question.timeSpent)}
                    </span>
                  )}
                </div>
                
                <div className="text-sm text-slate-700 mb-3" style={{ 
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}>
                  {question.stem}
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleExpanded(question)}
                    className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    {isExpanded ? 'Hide' : 'View'} explanation
                  </button>
                  <button className="text-sm text-slate-500 hover:text-slate-700">
                    Practice similar
                  </button>
                  <button className="text-sm text-slate-500 hover:text-slate-700">
                    Bookmark
                  </button>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="border-t border-slate-200 p-4 bg-slate-50">
                  <div className="space-y-4">
                    {/* Full Question */}
                    <div>
                      <h4 className="font-medium text-slate-900 mb-2">Question:</h4>
                      <p className="text-slate-700">{question.stem}</p>
                    </div>

                    {/* Options */}
                    <div>
                      <h4 className="font-medium text-slate-900 mb-2">Answer Choices:</h4>
                      <div className="space-y-2">
                        {question.options.map((option) => (
                          <div 
                            key={option.label}
                            className={`p-2 rounded border ${
                              option.label === question.correctAnswer ? 'bg-green-50 border-green-200' :
                              option.label === question.userAnswer ? 'bg-red-50 border-red-200' :
                              'bg-white border-slate-200'
                            }`}
                          >
                            <span className="font-medium">{option.label}:</span> {option.text}
                            {option.label === question.correctAnswer && (
                              <span className="ml-2 text-green-600 text-sm">✓ Correct</span>
                            )}
                            {option.label === question.userAnswer && option.label !== question.correctAnswer && (
                              <span className="ml-2 text-red-600 text-sm">✗ Your answer</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Explanation */}
                    {question.explanation && (
                      <div>
                        <h4 className="font-medium text-slate-900 mb-2">Explanation:</h4>
                        <p className="text-slate-700">{question.explanation}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredQuestions.length === 0 && (
        <div className="text-center py-8 text-slate-500">
          No questions match your current filters.
        </div>
      )}
    </div>
  );
};

const QuickActions = ({ 
  onRetake, 
  onPractice, 
  onExport, 
  onShare,
  isLoading 
}: {
  onRetake: () => void;
  onPractice: () => void;
  onExport: () => void;
  onShare: () => void;
  isLoading?: boolean;
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm">
    <h3 className="font-semibold text-slate-900 mb-4">Quick Actions</h3>
    <div className="space-y-3">
      <Button
        onClick={onRetake}
        variant="outline"
        tone="accent"
        size="sm"
        fullWidth
        className="justify-start text-sm"
      >
        🔄 Retake diagnostic
      </Button>
      <Button
        onClick={onPractice}
        variant="outline"
        tone="accent"
        size="sm"
        fullWidth
        className="justify-start text-sm"
        disabled={isLoading}
      >
        {isLoading ? "Creating..." : "📚 Start 10-min practice"}
      </Button>
      <Button
        onClick={onExport}
        variant="outline"
        tone="accent"
        size="sm"
        fullWidth
        className="justify-start text-sm"
      >
        📄 Export PDF
      </Button>
      <Button
        onClick={onShare}
        variant="outline"
        tone="accent"
        size="sm"
        fullWidth
        className="justify-start text-sm"
      >
        🔗 Share results
      </Button>
    </div>

    <div className="mt-4 pt-4 border-t border-slate-200">
      <h4 className="text-sm font-medium text-slate-900 mb-2">Schedule Study</h4>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" tone="accent" className="flex-1 text-xs">
          15m
        </Button>
        <Button size="sm" variant="outline" tone="accent" className="flex-1 text-xs">
          30m
        </Button>
        <Button size="sm" variant="outline" tone="accent" className="flex-1 text-xs">
          45m
        </Button>
      </div>
    </div>
  </div>
);

const DiagnosticSummaryPage = () => {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const posthog = usePostHog();
  const sessionId = params?.sessionId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ExtendedSessionSummary | null>(null);
  const [domainBreakdown, setDomainBreakdown] = useState<DomainBreakdown[]>([]);
  const [showTrialModal, setShowTrialModal] = useState(false);
  const [creatingPracticeSession, setCreatingPracticeSession] = useState(false);
  
  // UI State
  const [activeFilter, setActiveFilter] = useState<'all' | 'incorrect' | 'flagged' | 'low-confidence'>('all');
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  
  // Toast queue for error messages
  const { toasts, addToast, dismissToast } = useToastQueue();

  // Calculate critical domains for upsell triggers (using shared tier helper)
  const criticalDomainCount = domainBreakdown.filter(d => getDomainTier(d.percentage).id === "critical").length;
  const weakDomains = domainBreakdown.filter(d => d.percentage < 60).map(d => d.domain);
  
  // Initialize upsell hook
  const upsell = useUpsell({
    score: summary?.score || 0,
    enableExitIntent: process.env.NODE_ENV !== 'production' || false, // Feature flag
    enableDeepScroll: process.env.NODE_ENV !== 'production' || false, // Feature flag
    weakDomains,
  });

  // Initialize trigger detection
  const triggers = useTriggerDetection({
    onTrigger: upsell.maybeOpen,
    score: summary?.score || 0,
    criticalDomainCount,
    enableExitIntent: process.env.NODE_ENV !== 'production' || false,
    enableDeepScroll: process.env.NODE_ENV !== 'production' || false,
  });

  useEffect(() => {
    const fetchSummary = async () => {
      if (!sessionId) {
        setError("Session ID not found");
        setLoading(false);
        return;
      }

      if (isAuthLoading) {
        return; // Wait for auth state
      }

      try {
        let apiUrl = `/api/diagnostic/summary/${sessionId}`;

        // Include anonymous session ID if user is not logged in
        if (!user) {
          const anonymousSessionId = localStorage.getItem("anonymousSessionId");
          if (anonymousSessionId) {
            apiUrl += `?anonymousSessionId=${anonymousSessionId}`;
          }
        }

        const response = await fetch(apiUrl);
        const data = (await response.json()) as {
          error?: string;
          summary?: ExtendedSessionSummary;
          domainBreakdown?: DomainBreakdown[];
        };

        if (!response.ok) {
          if (response.status === 404) {
            setError("session_not_found");
          } else if (response.status === 403) {
            setError("access_denied");
          } else if (response.status === 400) {
            setError("session_not_completed");
          } else {
            setError(data.error || "Failed to load summary");
          }
          return;
        }

        if (data.summary) {
          setSummary(data.summary);
        }
        setDomainBreakdown(data.domainBreakdown || []);

        // Track summary view
        if (data.summary) {
          trackEvent(posthog, ANALYTICS_EVENTS.DIAGNOSTIC_SUMMARY_VIEWED, {
            sessionId: data.summary.sessionId,
            examType: data.summary.examType,
            examKey: "pmle",
            score: data.summary.score,
            totalQuestions: data.summary.totalQuestions,
            correctAnswers: data.summary.correctAnswers,
            domainCount: data.domainBreakdown?.length || 0,
            readinessTier: getExamReadinessTier(data.summary.score).id,
          });
        }

        // Clean up localStorage since session is completed
        localStorage.removeItem("testero_diagnostic_session_id");

        // Show trial modal after 5 seconds if user isn't subscribed
        if (!user?.user_metadata?.has_subscription) {
          setTimeout(() => {
            setShowTrialModal(true);
            posthog?.capture("trial_modal_shown", {
              source: "diagnostic_summary",
              delay_seconds: 5,
              diagnostic_score: data.summary?.score,
            });
          }, 5000);
        }
      } catch (err) {
        console.error("Error fetching summary:", err);
        setError("Failed to load diagnostic summary");
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [sessionId, user, isAuthLoading, posthog]);

  // Event handlers
  const handleStartPractice = useCallback(async (domainCodes?: string[]) => {
    // Check if should trigger paywall modal
    if (!user?.user_metadata?.has_subscription) {
      const triggered = triggers.checkPaywallTrigger('practice');
      if (triggered) return; // Modal opened, don't proceed
    }
    
    if (!summary) {
      addToast({
        tone: "danger",
        title: "Couldn't start practice",
        description: "Diagnostic summary not loaded. Please refresh the page.",
      });
      return;
    }
    
    // Determine domain codes to use
    let codesToUse: string[];
    if (domainCodes && domainCodes.length > 0) {
      // If domain codes provided (from Study Plan), convert display names to codes if needed
      codesToUse = domainCodes
        .map(domain => {
          // Check if it's already a domain code (contains underscore) or if it's a display name
          if (domain.includes('_')) {
            return domain; // Already a code
          }
          return getDomainCodeFromDisplayName(domain) || domain;
        })
        .filter((code): code is string => code !== null);
    } else {
      // Compute weakest domains for top CTA
      codesToUse = selectWeakestDomains(domainBreakdown);
    }
    
    if (codesToUse.length === 0) {
      addToast({
        tone: "danger",
        title: "Couldn't start practice",
        description: "No eligible domains found for practice. Please try again later.",
      });
      return;
    }
    
    // Track study plan start practice clicked
    trackEvent(posthog, ANALYTICS_EVENTS.STUDY_PLAN_START_PRACTICE_CLICKED, {
      sessionId: summary.sessionId,
      examKey: "pmle",
      domainCodes: codesToUse,
      questionCount: 10,
      source: domainCodes && domainCodes.length > 0 ? "domain_row" : "weakest",
    });
    
    setCreatingPracticeSession(true);
    
    try {
      const response = await fetch('/api/practice/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          examKey: 'pmle',
          domainCodes: codesToUse,
          questionCount: 10,
          source: 'diagnostic_summary',
          sourceSessionId: summary.sessionId,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        const errorMessage = errorData.error || 'Failed to create practice session';
        
        // Track error
        trackEvent(posthog, ANALYTICS_EVENTS.PRACTICE_SESSION_CREATION_FAILED_FROM_DIAGNOSTIC, {
          diagnosticSessionId: summary.sessionId,
          domainCodes: codesToUse,
          statusCode: response.status,
          error: errorMessage,
        });
        
        addToast({
          tone: "danger",
          title: "Couldn't start practice",
          description: errorMessage || "Something went wrong. Please try again.",
        });
        return;
      }
      
      const data = await response.json() as {
        sessionId: string;
        route: string;
        questionCount: number;
      };
      
      // Track success
      trackEvent(posthog, ANALYTICS_EVENTS.PRACTICE_SESSION_CREATED_FROM_DIAGNOSTIC, {
        diagnosticSessionId: summary.sessionId,
        practiceSessionId: data.sessionId,
        examKey: "pmle",
        domainCodes: codesToUse,
        questionCount: data.questionCount,
      });
      
      // Navigate to practice session
      router.push(data.route || `/practice?sessionId=${data.sessionId}`);
    } catch (err) {
      console.error('Error creating practice session:', err);
      
      // Track error
      trackEvent(posthog, ANALYTICS_EVENTS.PRACTICE_SESSION_CREATION_FAILED_FROM_DIAGNOSTIC, {
        diagnosticSessionId: summary.sessionId,
        domainCodes: codesToUse,
        errorType: 'network_error',
        error: err instanceof Error ? err.message : 'Network error',
      });
      
      addToast({
        tone: "danger",
        title: "Couldn't start practice",
        description: "Network error. Please check your connection and try again.",
      });
    } finally {
      setCreatingPracticeSession(false);
    }
  }, [posthog, triggers, user, router, summary, domainBreakdown, addToast]);

  const handleRetakeDiagnostic = useCallback(() => {
    router.push("/diagnostic");
  }, [router]);

  const handleDomainClick = useCallback((domain: string) => {
    // Track domain click analytics
    if (summary && posthog) {
      const domainCode = getDomainCodeFromDisplayName(domain) || domain;
      const domainData = domainBreakdown.find(d => d.domain === domain);
      const domainTier = domainData ? getDomainTier(domainData.percentage).id : null;
      
      trackEvent(posthog, ANALYTICS_EVENTS.DIAGNOSTIC_DOMAIN_CLICKED, {
        sessionId: summary.sessionId,
        examKey: "pmle",
        domainCode,
        domainTier,
      });
    }
    
    setSelectedDomain(selectedDomain === domain ? null : domain);
    setActiveFilter('all');
  }, [selectedDomain, summary, posthog, domainBreakdown]);

  const handleExport = useCallback(() => {
    // Implementation for PDF export
    posthog?.capture("summary_exported", { format: "pdf" });
  }, [posthog]);

  const handleShare = useCallback(() => {
    // Implementation for sharing
    posthog?.capture("summary_shared");
  }, [posthog]);

  const handleExplanationViewed = useCallback((question: ExtendedQuestionSummary) => {
    if (summary && posthog) {
      trackEvent(posthog, ANALYTICS_EVENTS.QUESTION_EXPLANATION_VIEWED, {
        sessionId: summary.sessionId,
        examKey: "pmle",
        questionId: question.id,
        domain: question.domain,
        isCorrect: question.isCorrect,
      });
    }
  }, [summary, posthog]);

  // Handle study plan generation with upsell check - currently not used but ready for implementation
  // const handleGenerateStudyPlan = useCallback(() => {
  //   // Check if should trigger paywall modal
  //   if (!user?.user_metadata?.has_subscription) {
  //     const triggered = triggers.checkPaywallTrigger('study_plan');
  //     if (triggered) return; // Modal opened, don't proceed
  //   }
  //   
  //   // Implementation for generating study plan
  //   posthog?.capture("study_plan_generated", { 
  //     source: "diagnostic_summary",
  //     score: summary?.score,
  //   });
  //   
  //   // Navigate to study path
  //   router.push('/study-path');
  // }, [triggers, user, posthog, summary, router]);

  // Upsell modal handlers
  const handleUpsellCTA = useCallback(() => {
    upsell.handleCTAClick();
    // Navigate to billing/signup
    router.push('/signup');
  }, [upsell, router]);

  const handleContinueWithoutTrial = useCallback(() => {
    upsell.dismiss();
  }, [upsell]);

  // Error states (keeping existing error handling)
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-slate-600">Loading diagnostic summary...</div>
      </div>
    );
  }

  if (error === "session_not_found") {
    return (
      <main className="max-w-2xl mx-auto px-6 py-8">
        <Card>
          <CardContent className="text-center py-8">
            <h1 className="text-2xl font-bold mb-4">Summary Not Found</h1>
            <p className="text-red-600 mb-6">
              The diagnostic session could not be found or may have expired.
            </p>
            <Button onClick={() => router.push("/diagnostic")}>Start New Diagnostic</Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (error === "access_denied") {
    return (
      <main className="max-w-2xl mx-auto px-6 py-8">
        <Card>
          <CardContent className="text-center py-8">
            <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
            <p className="text-red-600 mb-6">
              You don&apos;t have permission to view this diagnostic summary.
            </p>
            <Button onClick={() => router.push("/diagnostic")}>Start New Diagnostic</Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (error === "session_not_completed") {
    return (
      <main className="max-w-2xl mx-auto px-6 py-8">
        <Card>
          <CardContent className="text-center py-8">
            <h1 className="text-2xl font-bold mb-4">Diagnostic Not Completed</h1>
            <p className="text-red-600 mb-6">
              This diagnostic session hasn&apos;t been completed yet.
            </p>
            <Button onClick={() => router.push(`/diagnostic/${sessionId}`)}>
              Continue Diagnostic
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-8">
        <Card>
          <CardContent className="text-center py-8">
            <h1 className="text-2xl font-bold mb-4">Error</h1>
            <p className="text-red-600 mb-6">{error}</p>
            <Button onClick={() => router.push("/diagnostic")}>Start New Diagnostic</Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!summary) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="text-center">No summary data available</div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            {...toast}
            onClose={() => dismissToast(toast.id)}
          />
        ))}
      </div>
      
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-900">Diagnostic Results</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">
              {new Date(summary.completedAt).toLocaleDateString()} • {summary.examType}
            </span>
            <div className="flex items-center gap-2">
              <Button onClick={handleExport} size="sm" variant="ghost" tone="neutral">
                📄 Export
              </Button>
              <Button onClick={handleShare} size="sm" variant="ghost" tone="neutral">
                🔗 Share
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Content (8-9 cols) */}
          <div className="lg:col-span-9 space-y-8">
            {/* Verdict Block */}
            <VerdictBlock 
              summary={summary}
              onStartPractice={() => handleStartPractice()}
              onRetakeDiagnostic={handleRetakeDiagnostic}
              isLoading={creatingPracticeSession}
            />

            {/* Domain Performance */}
            {domainBreakdown.length > 0 && (
              <DomainPerformance 
                domains={domainBreakdown}
                onDomainClick={handleDomainClick}
              />
            )}

            {/* Study Plan */}
            <div ref={triggers.setStudyPlanRef}>
              <StudyPlan 
                domains={domainBreakdown}
                onStartPractice={handleStartPractice}
                isLoading={creatingPracticeSession}
              />
            </div>

            {/* Question Review */}
            <QuestionReview 
              questions={summary.questions}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              selectedDomain={selectedDomain}
              onDomainChange={setSelectedDomain}
              onTrackReviewEntry={triggers.trackReviewSectionEntry}
              onTrackReviewExit={triggers.trackReviewSectionExit}
              onTrackExpansion={triggers.trackExplanationExpansion}
              onExplanationViewed={handleExplanationViewed}
            />
          </div>

          {/* Right Rail (3-4 cols) */}
          <div className="lg:col-span-3 space-y-6">
            <QuickActions 
              onRetake={handleRetakeDiagnostic}
              onPractice={() => handleStartPractice()}
              onExport={handleExport}
              onShare={handleShare}
              isLoading={creatingPracticeSession}
            />

            {/* Trial CTA for non-subscribed users */}
            {!user?.user_metadata?.has_subscription && (
              <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 md:p-6 shadow-sm">
                <h3 className="font-semibold text-slate-900 mb-2">Ready to Pass?</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Get personalized study plans and unlimited practice
                </p>
                <Button
                  onClick={() => {
                    setShowTrialModal(true);
                    posthog?.capture("trial_cta_clicked", {
                      source: "diagnostic_summary_rail",
                      diagnostic_score: summary?.score,
                    });
                  }}
                  tone="accent"
                  size="sm"
                  fullWidth
                >
                  Start Free Trial
                </Button>
                <p className="text-xs text-slate-500 mt-2 text-center">No credit card required</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Upsell Modal */}
      <UpsellModal
        isOpen={upsell.isOpen}
        variant={upsell.variant}
        trigger={upsell.trigger}
        onClose={upsell.dismiss}
        onCTAClick={handleUpsellCTA}
        onContinueWithoutTrial={handleContinueWithoutTrial}
      />

      {/* Trial Conversion Modal */}
      <TrialConversionModal
        open={showTrialModal}
        onClose={() => setShowTrialModal(false)}
        diagnosticScore={summary?.score}
        weakAreas={domainBreakdown.filter((d) => d.percentage < 60).map((d) => d.domain)}
      />
    </div>
  );
};

export default DiagnosticSummaryPage;