import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Landing } from './pages/Landing';
import './styles/global.css';

const basePath = (window as any).__BASE_PATH__ ?? '';

function Configure() {
  return <div>Configure placeholder</div>;
}

export function App() {
  return (
    <BrowserRouter basename={basePath}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/configure" element={<Configure />} />
      </Routes>
    </BrowserRouter>
  );
}
