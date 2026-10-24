import { useEffect, useMemo, useState } from 'react';
import type { HelperOptions } from '../engine/api';
import { getEngine } from '../engine/client';
import { COLOUR_SETS } from '../engine/colourSets';
import { useSettings } from '../stores/settings';
import { choiceMap, useTrainerStore } from '../stores/trainer';

/**
 * The engine worker with the user's trainer alg choices applied, so helpers use the chosen algs (D-016).
 * `version` changes whenever the choices do; answers computed before that are stale.
 */
export function useHelperEngine() {
  const engine = useMemo(() => getEngine(), []);
  const choices = useTrainerStore((s) => s.choices);
  const loaded = useTrainerStore((s) => s.loaded);
  const load = useTrainerStore((s) => s.load);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!loaded) load().catch((error: unknown) => console.error('Failed to load alg choices', error));
  }, [loaded, load]);

  useEffect(() => {
    // Worker calls run in order, so anything asked after this sees the new choices.
    engine
      .setAlgChoices(choiceMap(choices))
      .then(() => setVersion((v) => v + 1))
      .catch((error: unknown) => console.error('[engine] choices failed', error));
  }, [engine, choices]);

  return { engine, version };
}

/** Helper options from the settings (cross colours, F2L style, LL mode); `key` changes whenever they do. */
export function useHelperOptions(): { options: HelperOptions; key: string } {
  const { crossColorMode, f2lStyle, llMode } = useSettings((s) => s.settings);
  return useMemo(
    () => ({
      options: { colours: COLOUR_SETS[crossColorMode], f2lStyle, llMode },
      key: `${crossColorMode}|${f2lStyle}|${llMode}`,
    }),
    [crossColorMode, f2lStyle, llMode],
  );
}
