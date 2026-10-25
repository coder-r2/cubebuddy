import { useCallback, useEffect, useRef, useState } from 'react';
import { COLOUR_NAMES, STICKER_HEX } from '../../engine/colourSets';
import { averageRgb, rgbToLab, type Lab, type RGB } from './classify';

// Missing on insecure origins and some embedded browsers, despite what the DOM types say.
const cameraSupported = () => typeof navigator.mediaDevices?.getUserMedia === 'function';

/*
 * Camera scan of the six faces (D-019, D-097). The rear camera on phones (any camera elsewhere) shows the
 * cube inside a 3×3 guide; each capture samples the middle of every guide cell. Faces are scanned in a fixed
 * order with fixed holds, so each face's stickers arrive in facelet reading order (side faces with white on
 * top, white with blue at the top, yellow with green at the top).
 *
 * A 2x2 (D-098) has no centres to name the faces by, so it's held any way up and the faces are named by
 * where they are (front, right, …), with the same turns between them; its 2×2 guide cells are its corner
 * stickers.
 */

interface ScanStep {
  face: number;
  hold: string;
  /** Colour of the face that should be at the top of the picture. */
  top: number;
  /** What the face is called on the 2x2, where faces have no fixed colour. */
  name: string;
  /** 2x2 instructions. */
  hold2: string;
}

const SCAN_STEPS: ScanStep[] = [
  {
    face: 2,
    top: 0,
    name: 'front',
    hold: 'Hold the cube with green facing the camera and white on top.',
    hold2:
      'Hold the cube any way you like: this is the front. Keep the same side on top for the next three faces.',
  },
  {
    face: 1,
    top: 0,
    name: 'right',
    hold: 'Turn the whole cube a quarter turn to the left, so red faces the camera. White stays on top.',
    hold2:
      'Turn the whole cube a quarter turn to the left, so the right side faces the camera. The top stays on top.',
  },
  {
    face: 5,
    top: 0,
    name: 'back',
    hold: 'Another quarter turn to the left: blue faces the camera, white on top.',
    hold2: 'Another quarter turn to the left: the back faces the camera.',
  },
  {
    face: 4,
    top: 0,
    name: 'left',
    hold: 'And once more: orange faces the camera, white on top.',
    hold2: 'And once more: the left side faces the camera.',
  },
  {
    face: 0,
    top: 5,
    name: 'top',
    hold: 'Turn back to green in front, then tip the top towards the camera so white faces it and green is at the bottom.',
    hold2:
      'Turn back to the front, then tip the top towards the camera so the top faces it and the front is at the bottom.',
  },
  {
    face: 3,
    top: 2,
    name: 'bottom',
    hold: 'Now tip it the other way, so yellow faces the camera and green is at the top.',
    hold2: 'Now tip it the other way, so the bottom faces the camera and the front is at the top.',
  },
];

/** The guide square inside the (square, centre-cropped) picture, as a fraction of its side. */
const GUIDE_INSET = 0.14;
/** Middle part of each cell that's sampled. */
const SAMPLE = 0.45;

interface CameraScannerProps {
  /** Stickers along each side of a face. */
  size: 2 | 3;
  /** Lab samples in facelet order (54; a 2x2 fills only its corner facelets). */
  onDone: (samples: Lab[]) => void;
  onManual: () => void;
}

/** Facelet index (0–8) within a face of each guide cell, in reading order. */
const CELLS = { 3: [0, 1, 2, 3, 4, 5, 6, 7, 8], 2: [0, 2, 6, 8] } as const;

export function CameraScanner({ size, onDone, onManual }: CameraScannerProps) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(() =>
    cameraSupported() ? null : 'This browser can’t use the camera here.',
  );
  const [ready, setReady] = useState(false);
  const [live, setLive] = useState<RGB[] | null>(null);
  const [captured, setCaptured] = useState<RGB[][]>([]);
  const step = SCAN_STEPS[captured.length];
  const small = size === 2;
  const faceName = (s: ScanStep) => (small ? s.name : COLOUR_NAMES[s.face]!);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    if (!cameraSupported()) return;
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
    const px = 192;
    const c = (canvas.current ??= document.createElement('canvas'));
    c.width = c.height = px;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, px, px);
    const { data } = ctx.getImageData(0, 0, px, px);
    const cell = (px * (1 - 2 * GUIDE_INSET)) / size;
    const box = cell * SAMPLE;
    const cells: RGB[] = [];
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const x = px * GUIDE_INSET + col * cell + (cell - box) / 2;
        const y = px * GUIDE_INSET + row * cell + (cell - box) / 2;
        cells.push(averageRgb(data, px, x, y, box));
      }
    }
    return cells;
  }, [size]);

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
        face.forEach((rgb, k) => (samples[SCAN_STEPS[i]!.face * 9 + CELLS[size][k]!] = rgbToLab(rgb))),
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
        {small ? <PositionBadge step={captured.length} /> : <FaceBadge face={step!.face} top={step!.top} />}
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">
            Face {captured.length + 1} of 6 · {faceName(step!)}
          </p>
          <p className="text-sm" data-testid="scan-instruction">
            {small ? step!.hold2 : step!.hold}
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
          className="pointer-events-none absolute grid gap-0 rounded-md border-2 border-white/90 shadow-[0_0_0_9999px_rgb(0_0_0/0.35)]"
          style={{ inset: `${GUIDE_INSET * 100}%`, gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
          aria-hidden
        >
          {Array.from({ length: size * size }, (_, i) => (
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
          Capture {faceName(step!)} face
        </button>
      </div>
      <ol className="flex justify-center gap-1.5" aria-label="Faces captured">
        {SCAN_STEPS.map((s, i) => (
          <li
            key={s.face}
            aria-label={`${faceName(s)}${i < captured.length ? ' (captured)' : ''}`}
            className={`h-3 w-3 rounded-full border border-black/30 ${i < captured.length ? '' : 'opacity-30'} ${small ? 'bg-accent' : ''}`}
            style={small ? undefined : { backgroundColor: STICKER_HEX[s.face] }}
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

/** 2x2: a cube drawn in perspective with the face to scan filled in (front, right, back, left, top, bottom). */
function PositionBadge({ step }: { step: number }) {
  const front = 'M6 14 H26 V34 H6 Z';
  const top = 'M6 14 L14 6 H34 L26 14 Z';
  const right = 'M26 14 L34 6 V26 L26 34 Z';
  // The back, left and bottom are behind the drawing: shown lighter and dashed, as if seen through.
  const back = 'M14 6 H34 V26 H14 Z';
  const left = 'M6 14 L14 6 V26 L6 34 Z';
  const bottom = 'M6 34 L14 26 H34 L26 34 Z';
  const faces = [front, right, back, left, top, bottom];
  const hidden = step === 2 || step === 3 || step === 5;
  return (
    <svg
      viewBox="0 0 40 40"
      className="h-12 w-12 shrink-0 text-muted"
      role="img"
      aria-label={`${SCAN_STEPS[step]!.name} face`}
    >
      <path d={faces[step]} className="fill-accent" fillOpacity={hidden ? 0.45 : 0.9} />
      {[front, top, right].map((d) => (
        <path key={d} d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      ))}
      {hidden && (
        <path d={faces[step]} fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" />
      )}
    </svg>
  );
}
