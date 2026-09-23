"use client";

import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";

// Keeps the AI Command Center conversation alive across page navigation for
// the current tab/session, without ever touching Postgres or leaking between
// users on a shared browser. sessionStorage (not localStorage) so it never
// survives closing the tab, and the key is user-scoped so a different user
// logging into the same browser reads a different (empty) key rather than
// the previous person's chat.
const STORAGE_PREFIX = "lal-motors-ai-chat";
const STORAGE_VERSION = 1;
const SAVE_DEBOUNCE_MS = 400;

function storageKey(userId: string | null | undefined): string | null {
  return userId ? `${STORAGE_PREFIX}:${userId}` : null;
}

type StoredShape<T> = { version: number; messages: T[] };

export function useAIChatSession<T>(opts: {
  userId: string | null | undefined;
  initialMessages: T[];
  // Applied to the in-memory messages right before every save — strip
  // anything that can't/shouldn't survive a reload (blob: preview URLs,
  // access tokens, transient "sending..." markers, etc).
  sanitize?: (messages: T[]) => T[];
}): { messages: T[]; setMessages: Dispatch<SetStateAction<T[]>> } {
  const { userId, initialMessages, sanitize } = opts;
  const key = storageKey(userId);

  const [messages, setMessages] = useState<T[]>(() => {
    if (typeof window === "undefined" || !key) return initialMessages;
    try {
      const raw = window.sessionStorage.getItem(key);
      if (!raw) return initialMessages;
      const parsed = JSON.parse(raw) as StoredShape<T>;
      if (parsed && parsed.version === STORAGE_VERSION && Array.isArray(parsed.messages) && parsed.messages.length > 0) {
        return parsed.messages;
      }
    } catch {
      // Corrupted JSON, quota errors reading, private-mode restrictions —
      // fail safe to the default welcome state, never throw into the UI.
    }
    return initialMessages;
  });

  // The lazy useState initializer above only runs once for the FIRST key
  // this hook instance ever sees. If `userId` becomes known only after
  // mount (or changes — e.g. a second login in the same tab), re-hydrate
  // for the new key instead of keeping whatever the previous key rendered.
  const loadedKeyRef = useRef<string | null>(key);
  useEffect(() => {
    if (key === loadedKeyRef.current) return;
    loadedKeyRef.current = key;
    if (!key) {
      setMessages(initialMessages);
      return;
    }
    try {
      const raw = window.sessionStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as StoredShape<T>) : null;
      if (parsed && parsed.version === STORAGE_VERSION && Array.isArray(parsed.messages) && parsed.messages.length > 0) {
        setMessages(parsed.messages);
      } else {
        setMessages(initialMessages);
      }
    } catch {
      setMessages(initialMessages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const saveTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!key) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      try {
        const toStore = sanitize ? sanitize(messages) : messages;
        window.sessionStorage.setItem(key, JSON.stringify({ version: STORAGE_VERSION, messages: toStore }));
      } catch {
        // sessionStorage full or unavailable — the chat just won't survive
        // navigation this session; never let this break the UI.
      }
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, messages]);

  return { messages, setMessages };
}

// Standalone (not tied to the hook's lifecycle) because logout can happen
// from any page, not only while the AI Command Center is mounted.
export function clearAIChatSession(userId: string | null | undefined): void {
  const key = storageKey(userId);
  if (!key || typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Nothing to do if storage is unavailable — there's nothing to clear.
  }
}
