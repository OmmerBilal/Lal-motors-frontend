"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { apiFetch } from "@/lib/api";

// One shared progress mechanism for every AI operation (Command Center chat,
// Smart Intake scan/paste, Content Studio, image generation). The caller
// generates a correlation id, passes it as `client_request_id` on the slow
// request, and this hook polls GET /ai/requests/{id}/progress while it runs.
// Every stage shown comes from the backend recording what it is actually doing
// — nothing here invents stages or percentages.

export type AIProgress = {
  stage: string | null;
  message: string | null;
  current: number | null;
  total: number | null;
};

export type AIProgressState = AIProgress & {
  // Real stage messages already passed, oldest first (deduplicated).
  history: string[];
};

const POLL_INTERVAL_MS = 1200;

export function newRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Fallback for very old browsers: RFC4122-ish v4.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const IDLE: AIProgressState = { stage: null, message: null, current: null, total: null, history: [] };

export function useAIProgress(initialMessage = "Sending request…") {
  const [state, setState] = useState<AIProgressState>(IDLE);
  const [active, setActive] = useState(false);
  const timerRef = useRef<number | null>(null);
  const idRef = useRef<string | null>(null);
  const stoppedRef = useRef(true);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const stop = useCallback(() => {
    stoppedRef.current = true;
    idRef.current = null;
    clearTimer();
    setActive(false);
    setState(IDLE);
  }, []);

  const poll = useCallback(async () => {
    const id = idRef.current;
    if (!id || stoppedRef.current) return;
    try {
      const p = await apiFetch<AIProgress & { status: string | null }>(`/ai/requests/${id}/progress`, {
        timeoutMs: 5_000,
      });
      if (!stoppedRef.current && idRef.current === id && p.message) {
        setState((prev) => {
          const history =
            prev.message && prev.message !== p.message && !prev.history.includes(prev.message)
              ? [...prev.history, prev.message]
              : prev.history;
          return { stage: p.stage, message: p.message, current: p.current, total: p.total, history };
        });
      }
    } catch {
      // A missed poll never affects the real request — try again next tick.
    }
    if (!stoppedRef.current && idRef.current === id) {
      timerRef.current = window.setTimeout(poll, POLL_INTERVAL_MS);
    }
  }, []);

  // Shows the first (client-known, truthful) status immediately, then polls.
  const start = useCallback(
    (requestId: string, firstMessage?: string) => {
      clearTimer();
      idRef.current = requestId;
      stoppedRef.current = false;
      setActive(true);
      setState({ stage: "queued", message: firstMessage ?? initialMessage, current: null, total: null, history: [] });
      timerRef.current = window.setTimeout(poll, 400);
    },
    [initialMessage, poll],
  );

  useEffect(() => () => {
    stoppedRef.current = true;
    clearTimer();
  }, []);

  return { progress: state, active, start, stop };
}
