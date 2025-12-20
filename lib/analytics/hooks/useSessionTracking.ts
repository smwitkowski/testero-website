"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { trackEvent, trackEngagement, ANALYTICS_EVENTS } from "@/lib/analytics/analytics";

interface SessionMetrics {
  sessionStartTime: number;
  pageStartTime: number;
  totalPageViews: number;
  totalScrollDepth: number;
  maxScrollDepth: number;
  idleTime: number;
  lastActivityTime: number;
}

const SESSION_STORAGE_KEY = "testero_session_metrics";
const IDLE_THRESHOLD = 30000; // 30 seconds of inactivity = idle
const SCROLL_DEBOUNCE = 500; // Debounce scroll tracking

// In-memory fallback storage when sessionStorage is blocked
const memoryStorage: Record<string, string> = {};

/**
 * Safe sessionStorage wrapper that falls back to in-memory storage
 * when sessionStorage access is blocked (e.g., SecurityError in some browsers)
 */
function safeSessionStorage(): {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
} {
  // Test if sessionStorage is accessible
  let storageAvailable = false;
  try {
    const testKey = "__storage_test__";
    sessionStorage.setItem(testKey, testKey);
    sessionStorage.removeItem(testKey);
    storageAvailable = true;
  } catch {
    // sessionStorage is blocked or unavailable
    storageAvailable = false;
  }

  if (storageAvailable) {
    return {
      getItem: (key: string) => {
        try {
          return sessionStorage.getItem(key);
        } catch {
          // Fallback to memory if access fails
          return memoryStorage[key] || null;
        }
      },
      setItem: (key: string, value: string) => {
        try {
          sessionStorage.setItem(key, value);
        } catch {
          // Fallback to memory if write fails
          memoryStorage[key] = value;
        }
      },
    };
  } else {
    // Use in-memory storage only
    return {
      getItem: (key: string) => memoryStorage[key] || null,
      setItem: (key: string, value: string) => {
        memoryStorage[key] = value;
      },
    };
  }
}

export function useSessionTracking(userId?: string) {
  const posthog = usePostHog();
  const pathname = usePathname();
  const metricsRef = useRef<SessionMetrics | null>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastPathRef = useRef<string>("");

  // Initialize or retrieve session metrics
  const initializeMetrics = useCallback(() => {
    const storage = safeSessionStorage();
    const stored = storage.getItem(SESSION_STORAGE_KEY);
    const now = Date.now();

    if (stored) {
      try {
        const parsed = JSON.parse(stored) as SessionMetrics;
        // Check if session is still valid (less than 30 min old)
        if (now - parsed.sessionStartTime < 30 * 60 * 1000) {
          metricsRef.current = {
            ...parsed,
            pageStartTime: now,
            totalPageViews: parsed.totalPageViews + 1,
            maxScrollDepth: 0,
          };
        } else {
          // Start new session
          metricsRef.current = {
            sessionStartTime: now,
            pageStartTime: now,
            totalPageViews: 1,
            totalScrollDepth: 0,
            maxScrollDepth: 0,
            idleTime: 0,
            lastActivityTime: now,
          };
        }
      } catch {
        // Invalid stored data, start fresh
        metricsRef.current = {
          sessionStartTime: now,
          pageStartTime: now,
          totalPageViews: 1,
          totalScrollDepth: 0,
          maxScrollDepth: 0,
          idleTime: 0,
          lastActivityTime: now,
        };
      }
    } else {
      // First visit - start new session
      metricsRef.current = {
        sessionStartTime: now,
        pageStartTime: now,
        totalPageViews: 1,
        totalScrollDepth: 0,
        maxScrollDepth: 0,
        idleTime: 0,
        lastActivityTime: now,
      };
    }

    if (metricsRef.current) {
      storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(metricsRef.current));
    }
  }, []);

  // Track scroll depth
  const trackScrollDepth = useCallback(() => {
    if (!metricsRef.current) return;

    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    const scrollTop = window.scrollY;
    const scrollPercentage = Math.round((scrollTop / (documentHeight - windowHeight)) * 100);

    if (scrollPercentage > metricsRef.current.maxScrollDepth) {
      metricsRef.current.maxScrollDepth = scrollPercentage;
      metricsRef.current.totalScrollDepth += scrollPercentage - metricsRef.current.maxScrollDepth;

      // Track milestone scroll depths
      if (scrollPercentage >= 25 && metricsRef.current.maxScrollDepth < 25) {
        trackEngagement(posthog, "page_depth", 25, { page: pathname }, userId);
      } else if (scrollPercentage >= 50 && metricsRef.current.maxScrollDepth < 50) {
        trackEngagement(posthog, "page_depth", 50, { page: pathname }, userId);
      } else if (scrollPercentage >= 75 && metricsRef.current.maxScrollDepth < 75) {
        trackEngagement(posthog, "page_depth", 75, { page: pathname }, userId);
      } else if (scrollPercentage >= 90 && metricsRef.current.maxScrollDepth < 90) {
        trackEngagement(posthog, "page_depth", 90, { page: pathname }, userId);
      }
    }

    if (metricsRef.current) {
      const storage = safeSessionStorage();
      storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(metricsRef.current));
    }
  }, [pathname, posthog, userId]);

  // Handle scroll with debouncing
  const handleScroll = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      trackScrollDepth();
    }, SCROLL_DEBOUNCE);
  }, [trackScrollDepth]);

  // Track user activity for idle detection
  const trackActivity = useCallback(() => {
    if (!metricsRef.current) return;

    const now = Date.now();
    const timeSinceLastActivity = now - metricsRef.current.lastActivityTime;

    if (timeSinceLastActivity > IDLE_THRESHOLD) {
      metricsRef.current.idleTime += timeSinceLastActivity;
    }

    metricsRef.current.lastActivityTime = now;
    if (metricsRef.current) {
      const storage = safeSessionStorage();
      storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(metricsRef.current));
    }

    // Reset idle timer
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }

    idleTimeoutRef.current = setTimeout(() => {
      // User has been idle
      if (metricsRef.current) {
        metricsRef.current.idleTime += IDLE_THRESHOLD;
        trackEngagement(
          posthog,
          "session_duration",
          metricsRef.current.idleTime,
          {
            type: "idle_detected",
            page: pathname,
          },
          userId
        );
      }
    }, IDLE_THRESHOLD);
  }, [pathname, posthog, userId]);

  // Track page exit and session duration
  const trackPageExit = useCallback(() => {
    if (!metricsRef.current || !lastPathRef.current) return;

    const now = Date.now();
    const pageTime = now - metricsRef.current.pageStartTime;
    const sessionTime = now - metricsRef.current.sessionStartTime;

    // Track page-specific metrics
    trackEngagement(
      posthog,
      "session_duration",
      pageTime,
      {
        type: "page_time",
        page: lastPathRef.current,
        scroll_depth: metricsRef.current.maxScrollDepth,
      },
      userId
    );

    // Track session metrics every page change
    trackEngagement(
      posthog,
      "session_duration",
      sessionTime - metricsRef.current.idleTime,
      {
        type: "active_session_time",
        total_pages: metricsRef.current.totalPageViews,
        avg_scroll_depth: Math.round(
          metricsRef.current.totalScrollDepth / metricsRef.current.totalPageViews
        ),
      },
      userId
    );

    // Check for bounce (single page session with quick exit)
    if (metricsRef.current.totalPageViews === 1 && pageTime < 10000) {
      trackEvent(
        posthog,
        ANALYTICS_EVENTS.FEATURE_DISCOVERED,
        {
          feature_name: "bounce_detected",
          discovery_type: "quick_exit",
          page: lastPathRef.current,
          time_on_page: pageTime,
        },
        userId
      );
    }
  }, [posthog, userId]);

  // Set up event listeners
  useEffect(() => {
    initializeMetrics();

    // Track scroll depth
    window.addEventListener("scroll", handleScroll);

    // Track user activity
    window.addEventListener("mousemove", trackActivity);
    window.addEventListener("keydown", trackActivity);
    window.addEventListener("click", trackActivity);
    window.addEventListener("touchstart", trackActivity);

    // Track page visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        trackPageExit();
      } else {
        if (metricsRef.current) {
          metricsRef.current.pageStartTime = Date.now();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Track before unload
    const handleBeforeUnload = () => {
      trackPageExit();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("mousemove", trackActivity);
      window.removeEventListener("keydown", trackActivity);
      window.removeEventListener("click", trackActivity);
      window.removeEventListener("touchstart", trackActivity);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }
    };
  }, [initializeMetrics, handleScroll, trackActivity, trackPageExit]);

  // Track page changes
  useEffect(() => {
    if (pathname !== lastPathRef.current && lastPathRef.current) {
      trackPageExit();
      initializeMetrics();
    }
    lastPathRef.current = pathname;
  }, [pathname, trackPageExit, initializeMetrics]);

  return {
    sessionMetrics: metricsRef.current,
  };
}
