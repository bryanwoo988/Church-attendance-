import { createBrowserRouter } from 'react-router';
import App from './App';

function Placeholder() {
  return <p>…</p>;
}

export const router = createBrowserRouter([
  { path: '/', element: <App />, children: [{ index: true, element: <Placeholder /> }] },
]);
