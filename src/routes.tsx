import { createBrowserRouter } from 'react-router';
import App from './App';
import LoginPage from './auth/LoginPage';
import { RequireAuth, RequireRole } from './auth/RequireRole';
import ScannerPage from './checkin/ScannerPage';
import SelfCheckinPage from './checkin/SelfCheckinPage';
import ScanPosterPage from './checkin/ScanPosterPage';
import WelcomePage from './welcome/WelcomePage';
import OfferingPage from './offering/OfferingPage';
import PeoplePage from './admin/PeoplePage';
import NewcomersPage from './admin/NewcomersPage';
import MeetingsPage from './admin/MeetingsPage';
import GroupsPage from './admin/GroupsPage';
import PosterPage from './admin/PosterPage';
import SettingsPage from './admin/SettingsPage';
import ExportPage from './finance/ExportPage';
import GroupAttendancePage from './leader/GroupAttendancePage';
import FinanceOfferingsPage from './finance/OfferingsPage';
import HomePage from './member/HomePage';
import FamilyPage from './member/FamilyPage';
import MyDataPage from './member/MyDataPage';
import HistoryPage from './member/HistoryPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <RequireAuth><HomePage /></RequireAuth> },
      { path: 'family', element: <RequireAuth><FamilyPage /></RequireAuth> },
      { path: 'history', element: <RequireAuth><HistoryPage /></RequireAuth> },
      { path: 'me', element: <RequireAuth><MyDataPage /></RequireAuth> },
      { path: 'login', element: <LoginPage /> },
      { path: 'welcome', element: <WelcomePage /> },
      { path: 'admin/people', element: <RequireRole any={['admin']}><PeoplePage /></RequireRole> },
      { path: 'admin/meetings', element: <RequireRole any={['admin', 'leader']}><MeetingsPage /></RequireRole> },
      { path: 'admin/groups', element: <RequireRole any={['admin', 'leader']}><GroupsPage /></RequireRole> },
      { path: 'admin/posters', element: <RequireRole any={['admin', 'leader']}><PosterPage /></RequireRole> },
      { path: 'admin/settings', element: <RequireRole any={['admin']}><SettingsPage /></RequireRole> },
      { path: 'finance/export', element: <RequireRole any={['finance', 'admin']}><ExportPage /></RequireRole> },
      { path: 'finance/offerings', element: <RequireRole any={['finance', 'admin']}><FinanceOfferingsPage /></RequireRole> },
      { path: 'leader/attendance', element: <RequireRole any={['leader', 'admin']}><GroupAttendancePage /></RequireRole> },
      { path: 'admin/newcomers', element: <RequireRole any={['admin']}><NewcomersPage /></RequireRole> },
      { path: 'offering', element: <RequireAuth><OfferingPage /></RequireAuth> },
      { path: 'scan-poster', element: <RequireAuth><ScanPosterPage /></RequireAuth> },
      { path: 'checkin', element: <RequireAuth><SelfCheckinPage /></RequireAuth> },
      { path: 'scan', element: <RequireRole any={['scanner', 'leader', 'admin']}><ScannerPage /></RequireRole> },
    ],
  },
]);
