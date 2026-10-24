import { Link } from 'react-router';
import { Icon } from '../components/ui/Icon';
import { STATUS_COLOUR, useAccount, type SyncStatus } from '../sync/account';

const LABEL: Record<SyncStatus, string> = {
  idle: 'Signed in',
  syncing: 'Syncing',
  synced: 'Synced',
  offline: 'Offline, will sync later',
  error: 'Sync problem',
};

/** Cloud icon with a status dot, shown in the header while signed in (SPEC §5.9). */
export function SyncBadge() {
  const auth = useAccount((s) => s.auth);
  const status = useAccount((s) => s.sync.status);
  if (auth !== 'signed-in') return null;
  return (
    <Link
      to="/account"
      title={LABEL[status]}
      aria-label={`Account: ${LABEL[status]}`}
      className="relative grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text"
    >
      <Icon name="cloud" />
      <span
        className={`absolute right-2 bottom-2 h-2.5 w-2.5 rounded-full ring-2 ring-bg ${STATUS_COLOUR[status]}`}
        aria-hidden
      />
    </Link>
  );
}
