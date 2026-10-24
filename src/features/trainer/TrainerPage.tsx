import { useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { getSet } from '../../data/algs/sets';
import { useTrainerStore } from '../../stores/trainer';
import { PrintView } from './PrintView';
import { SetPicker } from './SetPicker';
import { SetView } from './SetView';

/** /trainer, /trainer/:setId and /trainer/:setId/print (SPEC §5.5). */
export default function TrainerPage() {
  const { setId } = useParams();
  const { pathname } = useLocation();
  const loaded = useTrainerStore((s) => s.loaded);
  const load = useTrainerStore((s) => s.load);

  useEffect(() => {
    if (!loaded) load().catch((error: unknown) => console.error('Failed to load trainer data', error));
  }, [loaded, load]);

  if (!setId) return <SetPicker />;
  const set = getSet(setId);
  if (!set) {
    return (
      <section className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold">Alg set not found</h1>
        <Link to="/trainer" className="mt-4 inline-block text-accent underline">
          Back to all sets
        </Link>
      </section>
    );
  }
  return pathname.endsWith('/print') ? <PrintView set={set} /> : <SetView key={set.id} set={set} />;
}
