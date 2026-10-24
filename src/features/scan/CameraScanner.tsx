import { useCallback, useEffect, useRef, useState } from 'react';
import { COLOUR_NAMES, STICKER_HEX } from '../../engine/colourSets';
import { averageRgb, rgbToLab, type Lab, type RGB } from './classify';

/*
 * Camera scan of the six faces (D-019, D-097). The rear camera on phones (any camera elsewhere) shows the
 * cube inside a 3×3 guide; each capture samples the middle of every guide cell. Faces are scanned in a fixed
 * order with fixed holds, so each face's stickers arrive in facelet reading order (side faces with white on
 * top, white with blue at the top, yellow with green at the top).
 */

interface ScanStep {
  face: number;
  hold: string;
  /** Colour of the face that should be at the top of the picture. */
  top: number;
}

const SCAN_STEPS: ScanStep[] = [
  { face: 2, top: 0, hold: 'Hold the cube with green facing the camera and white on top.' },
  {
    face: 1,
    top: 0,
    hold: 'Turn the whole cube a quarter turn to the left, so red faces the camera. White stays on top.',
  },
  { face: 5, top: 0, hold: 'Another quarter turn to the left: blue faces the camera, white on top.' },
  { face: 4, top: 0, hold: 'And once more: orange faces the camera, white on top.' },
  {
    face: 0,
    top: 5,
    hold: 'Turn back to green in front, then tip the top towards the camera so white faces it and green is at the bottom.',
  },
  { face: 3, top: 2, hold: 'Now tip it the other way, so yellow faces the camera and green is at the top.' },
];

/** The guide square inside the (square, centre-cropped) picture, as a fraction of its side. */
const GUIDE_INSET = 0.14;
/** Middle part of each cell that's sampled. */
const SAMPLE = 0.45;

interface CameraScannerProps {
  /** 54 Lab samples in facelet order. */
  onDone: (samples: Lab[]) => void;
  onManual: () => void;
}

export function CameraScanner({ onDone, onManual }: CameraScannerProps) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(() =>
    navigator.mediaDevices?.getUserMedia ? null : 'This browser can’t use the camera here.',
  );
  const [ready, setReady] = useState(false);
  const [live, setLive] = useState<RGB[] | null>(null);
  const [captured, setCaptured] = useState<RGB[][]>([]);
  const step = SCAN_STEPS[captured.length];

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) return;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        const v = video.current;
        if (v) {
          v.srcObject = s;
          void v.play().catch(() => undefined);
        }
      })
      .catch((e: unknown) => {
        const name = e instanceof DOMException ? e.name : '';
        setError(
          name === 'NotAllowedError'
            ? 'Camera access was blocked. Allow the camera for this site in your browser settings, or enter the colours by hand.'
            : name === 'NotFoundError'
              ? 'No camera was found.'
              : 'The camera couldn’t be started.',
        );
      });
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  /** The 9 cell colours of the current frame, or null before the video has a picture. */
  const sample = useCallback((): RGB[] | null => {
    const v = video.current;
    if (!v || v.readyState < 2 || !v.videoWidth) return null;
    const side = Math.min(v.videoWidth, v.videoHeight);
    const size = 192;
    const c = (canvas.current ??= document.createElement('canvas'));
    c.width = c.height = size;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    const cell = (size * (1 - 2 * GUIDE_INSET)) / 3;
    const box = cell * SAMPLE;
    const cells: RGB[] = [];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const x = size * GUIDE_INSET + col * cell + (cell - box) / 2;
        const y = size * GUIDE_INSET + row * cell + (cell - box) / 2;
        cells.push(averageRgb(data, size, x, y, box));
      }
    }
    return cells;
  }, []);

  // Live preview of the sampled colours, a few times a second.
  useEffect(() => {
    if (error) return;
    const timer = window.setInterval(() => {
      const cells = sample();
      if (cells) {
        setReady(true);
        setLive(cells);
      }
    }, 150);
    return () => window.clearInterval(timer);
  }, [error, sample]);

  const capture = () => {
    const cells = sample();
    if (!cells) return;
    const next = [...captured, cells];
    if (next.length === SCAN_STEPS.length) {
      const samples: Lab[] = new Array<Lab>(54);
      next.forEach((face, i) =>
        face.forEach((rgb, k) => (samples[SCAN_STEPS[i]!.face * 9 + k] = rgbToLab(rgb))),
      );
      onDone(samples);
      return;
    }
    setCaptured(next);
  };

  if (error) {
    return (
      <div className="space-y-3">
        <p className="rounded-lg bg-danger/10 p-3 text-sm text-danger" role="alert">
          {error}
        </p>
        <button
          type="button"
          onClick={onManual}
          className="h-11 rounded-lg border border-border px-4 text-sm font-medium hover:bg-surface-2"
        >
          Enter the colours by hand
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <FaceBadge face={step!.face} top={step!.top} />
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">
            Face {captured.length + 1} of 6 · {COLOUR_NAMES[step!.face]}
          </p>
          <p className="text-sm" data-testid="scan-instruction">
            {step!.hold}
          </p>
        </div>
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-xl bg-black">
        <video
          ref={video}
          playsInline
          muted
          className="h-full w-full object-cover"
          aria-label="Camera view"
        />
        <div
          className="pointer-events-none absolute grid grid-cols-3 gap-0 rounded-md border-2 border-white/90 shadow-[0_0_0_9999px_rgb(0_0_0/0.35)]"
          style={{ inset: `${GUIDE_INSET * 100}%` }}
          aria-hidden
        >
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} className="grid place-items-center border border-white/60">
              {live && (
                <span
                  className="h-1/3 w-1/3 rounded-sm border border-white/80"
                  style={{ backgroundColor: `rgb(${live[i]!.map(Math.round).join(' ')})` }}
                />
              )}
            </div>
          ))}
        </div>
        {!ready && (
          <p className="absolute inset-0 grid place-items-center text-sm text-white/80">
            Starting the camera…
          </p>
        )}
      </div>
      <p className="text-center text-xs text-muted">
        Fill the square with the face, in even light without glare. The small squares show the colours seen.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setCaptured(captured.slice(0, -1))}
          disabled={captured.length === 0}
          className="h-11 rounded-lg border border-border px-4 text-sm font-medium hover:bg-surface-2 disabled:opacity-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={capture}
          disabled={!ready}
          className="h-11 rounded-lg bg-accent px-5 font-medium text-accent-contrast disabled:opacity-50"
        >
          Capture {COLOUR_NAMES[step!.face]} face
        </button>
      </div>
      <ol className="flex justify-center gap-1.5" aria-label="Faces captured">
        {SCAN_STEPS.map((s, i) => (
          <li
            key={s.face}
            aria-label={`${COLOUR_NAMES[s.face]}${i < captured.length ? ' (captured)' : ''}`}
            className={`h-3 w-3 rounded-full border border-black/30 ${i < captured.length ? '' : 'opacity-30'}`}
            style={{ backgroundColor: STICKER_HEX[s.face] }}
          />
        ))}
      </ol>
    </div>
  );
}

/** A small picture of how to hold the face: its colour, with a bar of the colour that should be on top. */
function FaceBadge({ face, top }: { face: number; top: number }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className="h-12 w-12 shrink-0"
      role="img"
      aria-label={`${COLOUR_NAMES[face]} face, ${COLOUR_NAMES[top]} on top`}
    >
      <rect x="2" y="2" width="36" height="7" rx="2" fill={STICKER_HEX[top]} stroke="#0005" />
      <rect x="2" y="11" width="36" height="27" rx="3" fill={STICKER_HEX[face]} stroke="#0005" />
    </svg>
  );
}
