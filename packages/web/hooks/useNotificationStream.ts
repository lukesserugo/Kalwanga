// D:\Projects\Kalwanga\packages\web\hooks\notifications\useNotificationStream.ts

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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

export function useNotificationStream(
  options: UseNotificationStreamOptions = {},
): UseNotificationStreamResult {
  const {
    baseUrl = process.env.NEXT_PUBLIC_API_URL || '',
    onNotification,
    enabled = true,
  } = options;

  const [status, setStatus] = useState<StreamStatus>(
    enabled ? 'connecting' : 'disconnected',
  );
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);

  const onNotificationRef = useRef(onNotification);
  useEffect(() => {
    onNotificationRef.current = onNotification;
  }, [onNotification]);

  const abortRef = useRef<AbortController | null>(null);
  const retryRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manuallyClosedRef = useRef(false);

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
    manuallyClosedRef.current = false;

    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('accessToken') ||
          localStorage.getItem('token') ||
          ''
        : '';

    const url = `${baseUrl}/notifications/stream`;
    setStatus(retryRef.current === 0 ? 'connecting' : 'reconnecting');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Stream failed: ${response.status}`);
      }

      setStatus('connected');
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
                  setLastEventAt(Date.now());
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

      if (!manuallyClosedRef.current) {
        throw new Error('Stream ended');
      }
    } catch (err: unknown) {
      if (manuallyClosedRef.current) return;

      // eslint-disable-next-line no-console
      console.warn('Notification stream error:', err);
      setStatus('reconnecting');

      const delay = Math.min(1000 * 2 ** retryRef.current, 30000);
      retryRef.current += 1;

      retryTimerRef.current = setTimeout(() => {
        void connect();
      }, delay);
    }
  }, [baseUrl, enabled]);

  useEffect(() => {
    if (!enabled) {
      setStatus('disconnected');
      cleanup();
      return;
    }

    void connect();

    return () => {
      cleanup();
      setStatus('disconnected');
    };
  }, [enabled, connect, cleanup]);

  const reconnect = useCallback(() => {
    cleanup();
    retryRef.current = 0;
    setTimeout(() => {
      void connect();
    }, 100);
  }, [cleanup, connect]);

  return { status, lastEventAt, reconnect };
}
