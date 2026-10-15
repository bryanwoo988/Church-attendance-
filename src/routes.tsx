import { createBrowserRouter } from 'react-router';
import App from './App';
import LoginPage from './auth/LoginPage';
import { RequireAuth, RequireRole } from './auth/RequireRole';
import ScannerPage from './checkin/ScannerPage';
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
      { path: 'scan', element: <RequireRole any={['scanner', 'leader', 'admin']}><ScannerPage /></RequireRole> },
    ],
  },
]);
