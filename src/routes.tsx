import { createBrowserRouter } from 'react-router';
import App from './App';
import LoginPage from './auth/LoginPage';
import { RequireAuth, RequireRole } from './auth/RequireRole';
import ScannerPage from './checkin/ScannerPage';
import SelfCheckinPage from './checkin/SelfCheckinPage';
import WelcomePage from './welcome/WelcomePage';
import OfferingPage from './offering/OfferingPage';
import PeoplePage from './admin/PeoplePage';
import NewcomersPage from './admin/NewcomersPage';
import MeetingsPage from './admin/MeetingsPage';
import GroupsPage from './admin/GroupsPage';
import PosterPage from './admin/PosterPage';
import SettingsPage from './admin/SettingsPage';
import HomePage from './member/HomePage';
import FamilyPage from './member/FamilyPage';
import MyDataPage from './member/MyDataPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <RequireAuth><HomePage /></RequireAuth> },
      { path: 'family', element: <RequireAuth><FamilyPage /></RequireAuth> },
      { path: 'me', element: <RequireAuth><MyDataPage /></RequireAuth> },
      { path: 'login', element: <LoginPage /> },
      { path: 'welcome', element: <WelcomePage /> },
      { path: 'admin/people', element: <RequireRole any={['admin']}><PeoplePage /></RequireRole> },
      { path: 'admin/meetings', element: <RequireRole any={['admin', 'leader']}><MeetingsPage /></RequireRole> },
      { path: 'admin/groups', element: <RequireRole any={['admin', 'leader']}><GroupsPage /></RequireRole> },
      { path: 'admin/posters', element: <RequireRole any={['admin', 'leader']}><PosterPage /></RequireRole> },
      { path: 'admin/settings', element: <RequireRole any={['admin']}><SettingsPage /></RequireRole> },
      { path: 'admin/newcomers', element: <RequireRole any={['admin']}><NewcomersPage /></RequireRole> },
      { path: 'offering', element: <RequireAuth><OfferingPage /></RequireAuth> },
      { path: 'checkin', element: <RequireAuth><SelfCheckinPage /></RequireAuth> },
      { path: 'scan', element: <RequireRole any={['scanner', 'leader', 'admin']}><ScannerPage /></RequireRole> },
    ],
  },
]);
