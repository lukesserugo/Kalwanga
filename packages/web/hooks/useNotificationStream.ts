// D:\Projects\Kalwanga\packages\web\hooks\notifications\useNotificationStream.ts

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import type { Notification } from '../types/notification';

export type StreamStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

export interface UseNotificationStreamOptions {
  baseUrl?: string;
  onNotification?: (notification: Notification) => void;
  enabled?: boolean;
}

export interface UseNotificationStreamResult {
  status: StreamStatus;
  lastEventAt: number | null;
  reconnect: () => void;
}

/**
 * Returns true when an error is an intentional abort (React Strict Mode
 * remount, component unmount, explicit reconnect, etc.) so we can ignore it
 * instead of logging spurious errors.
 */
function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') return true;
  if (err instanceof Error) {
    if (err.name === 'AbortError') return true;
    // Some browsers/runtimes surface aborts as a plain Error with a message.
    if (/aborted|abort/i.test(err.message)) return true;
  }
  return false;
}

export function useNotificationStream(
  options: UseNotificationStreamOptions = {},
): UseNotificationStreamResult {
  const {
    baseUrl = process.env.NEXT_PUBLIC_API_URL || '',
    onNotification,
    enabled = true,
  } = options;

  // Clerk gives us a fresh token on every call. We grab it inside `connect`
  // so reconnects always use a non-expired token.
  const { getToken, isSignedIn } = useAuth();

  const [status, setStatus] = useState<StreamStatus>(
    enabled ? 'connecting' : 'disconnected',
  );
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);

  // Keep the latest callback in a ref so `connect` doesn't need to
  // re-run (and therefore reconnect) whenever the caller re-renders.
  const onNotificationRef = useRef(onNotification);
  useEffect(() => {
    onNotificationRef.current = onNotification;
  }, [onNotification]);

  // Keep the latest getToken in a ref too, so `connect` stays stable
  // even if Clerk's `getToken` identity changes between renders.
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const abortRef = useRef<AbortController | null>(null);
  const retryRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manuallyClosedRef = useRef(false);
  const mountedRef = useRef(true);

  // Track mount/unmount so async callbacks don't set state after unmount.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const cleanup = useCallback(() => {
    manuallyClosedRef.current = true;
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const connect = useCallback(async () => {
    if (!enabled) return;
    if (!isSignedIn) {
      // Wait for auth to be ready before opening a stream.
      if (mountedRef.current) setStatus('disconnected');
      return;
    }

    manuallyClosedRef.current = false;

    // Get a fresh Clerk token. If this fails (network hiccup, session
    // expiry), we fall through to the retry logic below.
    let token = '';
    try {
      token = (await getTokenRef.current()) ?? '';
    } catch (err) {
      if (!manuallyClosedRef.current && !isAbortError(err)) {
        // eslint-disable-next-line no-console
        console.warn('Failed to get Clerk token for notification stream', err);
      }
    }

    if (!token) {
      if (mountedRef.current) setStatus('reconnecting');
      const delay = Math.min(1000 * 2 ** retryRef.current, 30000);
      retryRef.current += 1;
      retryTimerRef.current = setTimeout(() => {
        if (mountedRef.current) void connect();
      }, delay);
      return;
    }

    const url = `${baseUrl}/notifications/stream`;
    if (mountedRef.current) {
      setStatus(retryRef.current === 0 ? 'connecting' : 'reconnecting');
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          // We're using fetch + ReadableStream, not native EventSource,
          // so we CAN send an Authorization header.
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        // If the token was rejected, clear it and try again — but don't
        // log a scary error for the common 401-on-reconnect case.
        if (response.status === 401) {
          throw new Error('Stream failed: 401');
        }
        throw new Error(`Stream failed: ${response.status}`);
      }

      if (mountedRef.current) {
        setStatus('connected');
      }
      retryRef.current = 0;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let boundary = buffer.indexOf('\n\n');
        while (boundary !== -1) {
          const rawEvent = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);

          // Skip SSE comment frames (lines starting with ':').
          if (!rawEvent.startsWith(':')) {
            const lines = rawEvent.split('\n');
            let dataLine = '';
            for (const line of lines) {
              if (line.startsWith('data:')) {
                dataLine += line.slice(5).trimStart();
              }
            }
            if (dataLine) {
              try {
                const payload = JSON.parse(dataLine);
                if (
                  payload &&
                  payload.type === 'notification' &&
                  payload.data
                ) {
                  if (mountedRef.current) {
                    setLastEventAt(Date.now());
                  }
                  onNotificationRef.current?.(payload.data);
                }
              } catch {
                // Malformed frame — ignore.
              }
            }
          }

          boundary = buffer.indexOf('\n\n');
        }
      }

      // Stream ended without an explicit close → treat as a disconnect and retry.
      if (!manuallyClosedRef.current) {
        throw new Error('Stream ended');
      }
    } catch (err: unknown) {
      // Intentional aborts (Strict Mode remount, unmount, reconnect) are
      // expected — never log or retry them.
      if (manuallyClosedRef.current || isAbortError(err)) {
        return;
      }

      // Suppress the noisy "Stream failed: 401" log — it's expected while
      // the backend is restarted or the token is being refreshed.
      const is401 =
        err instanceof Error && /Stream failed:\s*401/.test(err.message);
      if (!is401) {
        // eslint-disable-next-line no-console
        console.warn('Notification stream error:', err);
      }

      if (mountedRef.current) {
        setStatus('reconnecting');
      }

      const delay = Math.min(1000 * 2 ** retryRef.current, 30000);
      retryRef.current += 1;

      retryTimerRef.current = setTimeout(() => {
        if (mountedRef.current) {
          void connect();
        }
      }, delay);
    }
  }, [baseUrl, enabled, isSignedIn]);

  useEffect(() => {
    if (!enabled) {
      setStatus('disconnected');
      cleanup();
      return;
    }

    if (!isSignedIn) {
      // Clerk hasn't finished restoring the session yet. Wait for the
      // next render (when isSignedIn flips to true) to open the stream.
      setStatus('disconnected');
      return;
    }

    void connect();

    return () => {
      cleanup();
      if (mountedRef.current) {
        setStatus('disconnected');
      }
    };
  }, [enabled, isSignedIn, connect, cleanup]);

  const reconnect = useCallback(() => {
    cleanup();
    retryRef.current = 0;
    // Reset the manual-close flag so the new connect attempt runs.
    manuallyClosedRef.current = false;
    setTimeout(() => {
      if (mountedRef.current) {
        void connect();
      }
    }, 100);
  }, [cleanup, connect]);

  return { status, lastEventAt, reconnect };
}
