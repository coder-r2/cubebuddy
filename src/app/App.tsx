import { lazy, useEffect } from 'react';
import { Route, Routes } from 'react-router';
import { useSettings } from '../stores/settings';
import { useAccount, wasSignedIn } from '../sync/account';
import { Layout } from './Layout';
import { NotFoundPage } from './NotFoundPage';
import { useApplyTheme } from './useTheme';

// Route-level code splitting keeps the first load small; 3D and engine code load per page (D-042).
const HomePage = lazy(() => import('../features/home/HomePage'));
const LearnPage = lazy(() => import('../features/learn/LearnPage'));
const PlayPage = lazy(() => import('../features/play/PlayPage'));
const TimerPage = lazy(() => import('../features/timer/TimerPage'));
const TrainerPage = lazy(() => import('../features/trainer/TrainerPage'));
const CfopTutorialPage = lazy(() => import('../features/tutorial/CfopTutorialPage'));
const OrtegaTutorialPage = lazy(() => import('../features/tutorial/OrtegaTutorialPage'));
const BeginnerTutorialPage = lazy(() => import('../features/tutorial/BeginnerTutorialPage'));
const SettingsPage = lazy(() => import('../features/settings/SettingsPage'));
const AccountPage = lazy(() => import('../features/account/AccountPage'));
const LabPage = lazy(() => import('../features/lab/LabPage'));
const AboutPage = lazy(() => import('../features/about/AboutPage'));

export function App() {
  const hydrate = useSettings((s) => s.hydrate);
  useEffect(() => {
    hydrate().catch((error: unknown) => console.error('Failed to load settings', error));
    // Sync starts at launch only on devices that were signed in; others load Firebase on the Account page.
    if (wasSignedIn()) {
      useAccount
        .getState()
        .start()
        .catch((error: unknown) => console.warn('Accounts failed to load', error));
    }
  }, [hydrate]);
  useApplyTheme();

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="learn" element={<LearnPage />} />
        <Route path="play" element={<PlayPage />} />
        <Route path="timer" element={<TimerPage />} />
        <Route path="trainer" element={<TrainerPage />} />
        <Route path="trainer/:setId" element={<TrainerPage />} />
        <Route path="trainer/:setId/print" element={<TrainerPage />} />
        <Route path="tutorial/cfop" element={<CfopTutorialPage />} />
        <Route path="tutorial/ortega" element={<OrtegaTutorialPage />} />
        <Route path="tutorial/beginner" element={<BeginnerTutorialPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="lab" element={<LabPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
