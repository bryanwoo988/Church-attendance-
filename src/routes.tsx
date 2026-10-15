import { createBrowserRouter } from 'react-router';
import App from './App';
import LoginPage from './auth/LoginPage';
import { RequireAuth } from './auth/RequireRole';

function Placeholder() {
  return <p>…</p>;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <RequireAuth><Placeholder /></RequireAuth> },
      { path: 'login', element: <LoginPage /> },
    ],
  },
]);
