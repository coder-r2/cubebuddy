import { useEffect, useMemo, useRef, useState } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type { Solve } from '../../db/types';
import { effectiveTime, formatTime } from './time';

interface TimeGraphProps {
  solves: readonly Solve[];
  ao5: readonly (number | null)[];
  ao12: readonly (number | null)[];
}

const HEIGHT = 220;

/** Infinity (DNF) and missing values become gaps in the line. */
const toSeconds = (ms: number | null) => (ms === null || !Number.isFinite(ms) ? null : ms / 1000);

/** Re-renders when <html data-theme> changes, so the canvas picks up the new colours. */
function useThemeName() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme ?? 'light');
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(document.documentElement.dataset.theme ?? 'light'));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return theme;
}

/** Singles with rolling Ao5 and Ao12 (SPEC §5.4, D-043). DNFs show as gaps. */
export function TimeGraph({ solves, ao5, ao12 }: TimeGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<uPlot | null>(null);
  const theme = useThemeName();

  const data = useMemo<uPlot.AlignedData>(
    () => [
      solves.map((_, i) => i + 1),
      solves.map((s) => toSeconds(effectiveTime(s))),
      ao5.map(toSeconds),
      ao12.map(toSeconds),
    ],
    [solves, ao5, ao12],
  );
  const dataRef = useRef(data);
  const enoughData = solves.length >= 2;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enoughData) return;
    const css = getComputedStyle(document.documentElement);
    const token = (name: string) => css.getPropertyValue(name).trim();
    const [muted, border, chart1, chart2] = ['--muted', '--border', '--chart-1', '--chart-2'].map(token);
    const formatValue = (_: uPlot, value: number | null) => (value === null ? '–' : formatTime(value * 1000));
    const axis = { stroke: muted, grid: { stroke: border, width: 1 }, ticks: { show: false } };

    const chart = new uPlot(
      {
        width: container.clientWidth,
        height: HEIGHT,
        scales: { x: { time: false } },
        cursor: { drag: { x: false, y: false } },
        axes: [
          { ...axis, values: (_, ticks) => ticks.map((t) => (Number.isInteger(t) ? String(t) : '')) },
          { ...axis, size: 56, values: (_, ticks) => ticks.map((t) => formatTime(t * 1000)) },
        ],
        series: [
          { label: 'Solve' },
          {
            label: 'Single',
            stroke: muted,
            width: 1,
            points: { show: true, size: 5, fill: muted, stroke: muted },
            value: formatValue,
          },
          { label: 'Ao5', stroke: chart1, width: 2, value: formatValue },
          { label: 'Ao12', stroke: chart2, width: 2, value: formatValue },
        ],
      },
      dataRef.current,
      container,
    );
    chartRef.current = chart;

    const resize = new ResizeObserver(() => chart.setSize({ width: container.clientWidth, height: HEIGHT }));
    resize.observe(container);
    return () => {
      resize.disconnect();
      chart.destroy();
      chartRef.current = null;
    };
  }, [theme, enoughData]);

  useEffect(() => {
    dataRef.current = data;
    chartRef.current?.setData(data);
  }, [data]);

  return (
    <div className="rounded-2xl border border-border bg-surface p-3 sm:p-4">
      <h2 className="text-xs font-medium tracking-wide text-muted uppercase">Progress</h2>
      {enoughData ? (
        <div
          ref={containerRef}
          className="mt-2 text-sm text-muted"
          role="img"
          aria-label="Graph of solve times with Ao5 and Ao12"
        />
      ) : (
        <p className="py-6 text-center text-sm text-muted">The graph appears after two solves.</p>
      )}
    </div>
  );
}
