import { useState } from 'react';
import { COLOUR_NAMES, STICKER_HEX } from '../../engine/colourSets';

/*
 * 2D net of a 3x3 or 2x2 (D-019, D-097, D-098): tap a sticker, then pick its colour. Faces are laid out as a
 * cross (U above, then L F R B, then D below), each in the facelet reading order of facelets.ts, which is how
 * the face looks in the net. On the 3x3 the centres are fixed (white on top, green in front); a 2x2 shows
 * only its corner stickers (facelets 0, 2, 6 and 8 of each face) and may be held any way up.
 */

const FACE_NAMES = ['Top', 'Right', 'Front', 'Bottom', 'Left', 'Back'];
/** Where each face (U R F D L B) sits in the 4 × 3 net. */
const FACE_CELL: [number, number][] = [
  [1, 0],
  [2, 1],
  [1, 1],
  [1, 2],
  [0, 1],
  [3, 1],
];
const isCentre = (sticker: number) => sticker % 9 === 4;
/** Facelets (0–8) of a face that the editor shows, in reading order. */
const SHOWN = { 3: [0, 1, 2, 3, 4, 5, 6, 7, 8], 2: [0, 2, 6, 8] } as const;

interface NetEditorProps {
  /** Stickers along each side of a face. */
  size: 2 | 3;
  colours: number[];
  onChange: (colours: number[]) => void;
  /** Stickers to mark as worth checking (camera doubts). */
  doubtful?: readonly number[];
  /** Stickers to mark as part of the current problem. */
  problem?: readonly number[];
}

export function NetEditor({ size, colours, onChange, doubtful = [], problem = [] }: NetEditorProps) {
  // Stickers that can be set, in facelet order.
  const editable = Array.from({ length: 54 }, (_, i) => i).filter(
    (i) => (SHOWN[size] as readonly number[]).includes(i % 9) && !isCentre(i),
  );
  const each = size * size;
  const [selected, setSelected] = useState<number | null>(
    () => editable.find((i) => colours[i]! < 0) ?? null,
  );

  const pick = (colour: number) => {
    if (selected === null) return;
    const next = [...colours];
    next[selected] = colour;
    onChange(next);
    // Move on to the next sticker without a colour, else the next one in reading order.
    const at = editable.indexOf(selected);
    const order = editable.map((_, k) => editable[(at + 1 + k) % editable.length]!);
    setSelected(order.find((i) => next[i]! < 0) ?? order[0]!);
  };

  // Centres count too (each is one of its colour's 9).
  const counts = [0, 1, 2, 3, 4, 5].map(
    (c) => colours.filter((x, i) => x === c && (SHOWN[size] as readonly number[]).includes(i % 9)).length,
  );

  return (
    <div className="space-y-4">
      <div
        className="mx-auto grid w-full max-w-md gap-1.5"
        style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}
        role="group"
        aria-label="Cube net"
      >
        {FACE_CELL.map(([col, row], face) => (
          <div
            key={face}
            className="grid gap-0.5"
            style={{
              gridColumn: col + 1,
              gridRow: row + 1,
              gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
            }}
            role="group"
            aria-label={`${FACE_NAMES[face]} face`}
          >
            {SHOWN[size].map((i, k) => {
              const sticker = face * 9 + i;
              const colour = colours[sticker]!;
              const centre = isCentre(sticker);
              const name = colour >= 0 ? COLOUR_NAMES[colour] : 'not set';
              const marked = problem.includes(sticker)
                ? 'problem'
                : doubtful.includes(sticker)
                  ? 'doubt'
                  : null;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={centre}
                  onClick={() => setSelected(sticker)}
                  aria-pressed={selected === sticker}
                  aria-label={
                    centre
                      ? `${FACE_NAMES[face]} centre: ${name}`
                      : `${FACE_NAMES[face]} face, row ${Math.floor(k / size) + 1}, column ${(k % size) + 1}: ${name}${marked === 'doubt' ? ' (check this one)' : ''}`
                  }
                  data-sticker={sticker}
                  className={`relative aspect-square rounded-[3px] border border-black/25 aria-pressed:z-10 aria-pressed:ring-3 aria-pressed:ring-accent ${
                    colour < 0
                      ? 'bg-surface-2 bg-[repeating-linear-gradient(45deg,transparent_0_4px,rgb(0_0_0/0.08)_4px_6px)]'
                      : ''
                  } ${marked === 'problem' ? 'outline-2 outline-offset-1 outline-danger' : ''}`}
                  style={colour >= 0 ? { backgroundColor: STICKER_HEX[colour] } : undefined}
                >
                  {marked === 'doubt' && (
                    <span
                      aria-hidden
                      className="absolute top-1/2 left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/60 ring-2 ring-white/80"
                    />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div>
        <p className="mb-2 text-sm text-muted" aria-live="polite">
          {selected === null ? 'Tap a sticker to change it.' : 'Now pick its colour:'}
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6" role="group" aria-label="Colours">
          {COLOUR_NAMES.map((name, colour) => (
            <button
              key={name}
              type="button"
              onClick={() => pick(colour)}
              disabled={selected === null}
              aria-label={`${name} (${counts[colour]} of ${each})`}
              className="flex h-11 items-center gap-2 rounded-lg border border-border px-2 text-sm font-medium capitalize hover:bg-surface-2 disabled:opacity-50"
            >
              <span
                aria-hidden
                className="h-5 w-5 shrink-0 rounded border border-black/25"
                style={{ backgroundColor: STICKER_HEX[colour] }}
              />
              {name}
              <span className={`ml-auto text-xs ${counts[colour] === each ? 'text-muted' : 'text-danger'}`}>
                {counts[colour]}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
