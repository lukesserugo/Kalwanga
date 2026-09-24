// packages/scanner/src/transports/usbHid.ts

import type { TransportAdapter } from '../types';

interface Options {
  /** Minimum length a buffer must reach before we consider it a scan. */
  minLength?: number;
  /** Max ms between keystrokes to still be considered a scan. */
  maxGapMs?: number;
  /** After last keystroke, wait this long before flushing. */
  flushDelayMs?: number;
  /** Target element or document. */
  target?: HTMLElement | Document;
  /** Called with every decoded code. */
  onCode: (code: string, format?: string) => void;
}

const TERMINATORS = new Set(['Enter', 'Tab']);

export class UsbHidAdapter implements TransportAdapter {
  readonly transport = 'usb-hid' as const;

  private running = false;
  private buffer = '';
  private lastKeyAt = 0;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private target: HTMLElement | Document;
  private opts: Required<Omit<Options, 'target' | 'onCode'>> & {
    target: HTMLElement | Document;
    onCode: (code: string) => void;
  };

  constructor(options: Options) {
    this.target = options.target ?? document;
    this.opts = {
      minLength: options.minLength ?? 3,
      maxGapMs: options.maxGapMs ?? 50,
      flushDelayMs: options.flushDelayMs ?? 80,
      target: this.target,
      onCode: options.onCode,
    };
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.target.addEventListener(
      'keydown',
      this.handleKeyDown as EventListener,
      true,
    );
    this.running = true;
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.target.removeEventListener(
      'keydown',
      this.handleKeyDown as EventListener,
      true,
    );
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.buffer = '';
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  private handleKeyDown = (ev: KeyboardEvent): void => {
    // Ignore when the operator is typing into a real input.
    const t = ev.target as HTMLElement | null;
    if (
      t &&
      (t.tagName === 'INPUT' ||
        t.tagName === 'TEXTAREA' ||
        t.isContentEditable)
    ) {
      return;
    }

    const now = Date.now();

    // Gap too long since last keystroke → previous buffer was
    // human typing, discard it.
    if (this.buffer && now - this.lastKeyAt > this.opts.maxGapMs) {
      this.buffer = '';
    }

    if (TERMINATORS.has(ev.key)) {
      this.flush();
      ev.preventDefault();
      return;
    }

    if (ev.key.length === 1) {
      this.buffer += ev.key;
      this.lastKeyAt = now;

      if (this.flushTimer) clearTimeout(this.flushTimer);
      this.flushTimer = setTimeout(
        () => this.flush(),
        this.opts.flushDelayMs,
      );

      // Scanner guns type fast — suppress the keystroke from
      // reaching any focused UI element.
      ev.preventDefault();
    }
  };

  private flush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    const code = this.buffer;
    this.buffer = '';
    if (code.length >= this.opts.minLength) {
      this.opts.onCode(code, 'HID');
    }
  }
}
