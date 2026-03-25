import { useNavigate } from 'react-router-dom';

export function Landing() {
  const navigate = useNavigate();
  const basePath = (window as any).__BASE_PATH__ ?? '';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      gap: '20px',
    }}>
      <div style={{
        width: '64px',
        height: '64px',
        background: '#ff0033',
        borderRadius: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
          <polygon points="9.5,7 16.5,12 9.5,17" />
        </svg>
      </div>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.5px' }}>
        Tubio<span style={{ color: '#ff0033' }}>+</span>
      </h1>
      <p style={{ color: '#888', fontSize: '0.9rem' }}>YouTube for Stremio</p>
      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
        <button
          onClick={() => navigate('/configure')}
          style={{
            background: '#ff0033',
            color: 'white',
            border: 'none',
            padding: '12px 28px',
            borderRadius: '8px',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Configure
        </button>
        <a
          href={`stremio://${window.location.host}${basePath}/manifest.json`}
          style={{
            background: 'transparent',
            color: '#ccc',
            border: '1px solid #333',
            padding: '12px 28px',
            borderRadius: '8px',
            fontSize: '0.9rem',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          Install
        </a>
      </div>
    </div>
  );
}
