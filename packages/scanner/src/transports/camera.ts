// packages/scanner/src/transports/camera.ts

import type { TransportAdapter } from '../types';

interface Options {
  /** The <video> element to attach a MediaStream to. */
  video: HTMLVideoElement;
  onCode: (code: string, format?: string) => void;
  /** Restrict formats; leave undefined for all. */
  formats?: string[];
  /** Prefer rear camera on mobile. */
  facingMode?: 'environment' | 'user';
}

type DetectorLike = {
  detect: (source: CanvasImageSource) => Promise<
    Array<{ rawValue: string; format: string }>
  >;
};

export class CameraAdapter implements TransportAdapter {
  readonly transport = 'camera' as const;

  private running = false;
  private stream: MediaStream | null = null;
  private detector: DetectorLike | null = null;
  private rafId: number | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private lastCode: string | null = null;
  private lastAt = 0;

  constructor(private opts: Options) {}

  async start(): Promise<void> {
    if (this.running) return;

    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: this.opts.facingMode ?? 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });

    this.opts.video.srcObject = this.stream;
    this.opts.video.setAttribute('playsinline', 'true');
    await this.opts.video.play();

    // Prefer native BarcodeDetector.
    const Ctor = (globalThis as any).BarcodeDetector as
      | (new (opts?: { formats?: string[] }) => DetectorLike)
      | undefined;

    if (Ctor) {
      this.detector = new Ctor(
        this.opts.formats ? { formats: this.opts.formats } : undefined,
      );
    } else {
      // Fall back to ZXing loaded lazily.
      const { BrowserMultiFormatReader } = await import(
        '@zxing/library'
      );
      const reader = new BrowserMultiFormatReader();
      this.detector = {
        detect: async () => {
          const result = await reader.decodeOnceFromVideoElement(
            this.opts.video,
          ).catch(() => null);
          return result
            ? [
                {
                  rawValue: result.getText(),
                  format: String(result.getBarcodeFormat()),
                },
              ]
            : [];
        },
      };
    }

    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.running = true;
    this.loop();
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.opts.video.srcObject = null;
  }

  isRunning(): boolean {
    return this.running;
  }

  private loop = async (): Promise<void> => {
    if (!this.running || !this.detector || !this.ctx || !this.canvas) {
      return;
    }
    const v = this.opts.video;
    if (v.readyState === v.HAVE_ENOUGH_DATA) {
      this.canvas.width = v.videoWidth;
      this.canvas.height = v.videoHeight;
      this.ctx.drawImage(v, 0, 0, this.canvas.width, this.canvas.height);
      try {
        const results = await this.detector.detect(this.canvas);
        const first = results[0];
        if (first) {
          const now = Date.now();
          if (
            first.rawValue !== this.lastCode ||
            now - this.lastAt > 1500
          ) {
            this.lastCode = first.rawValue;
            this.lastAt = now;
            this.opts.onCode(first.rawValue, first.format);
          }
        }
      } catch {
        /* swallow — detection failures are expected per frame */
      }
    }
    this.rafId = requestAnimationFrame(() => void this.loop());
  };
}
