import { useState } from 'react';

interface StepAuthProps {
  cookies: string;
  onCookiesChange: (cookies: string) => void;
  noVncUrl?: string;
}

const basePath = (window as any).__BASE_PATH__ ?? '';

export function StepAuth({ cookies, onCookiesChange, noVncUrl }: StepAuthProps) {
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const handleReset = async () => {
    if (!confirm('This will clear all browser cookies and session data. You will need to log in again via noVNC. Continue?')) return;
    setResetting(true);
    try {
      const res = await fetch(`${basePath}/api/reset`, { method: 'POST' });
      if (res.ok) {
        setResetDone(true);
        onCookiesChange('');
        setTimeout(() => setResetDone(false), 3000);
      }
    } catch { /* ignore */ }
    setResetting(false);
  };

  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px' }}>
      <h3 style={{ color: '#fff', fontSize: '18px', marginBottom: '4px' }}>Authentication</h3>
      <p style={{ color: '#666', fontSize: '13px', marginBottom: '16px' }}>Optional -- needed for subscriptions, history, and watch later</p>
      <textarea
        value={cookies}
        onChange={(e) => onCookiesChange(e.target.value)}
        placeholder="Paste Netscape format cookies here..."
        style={{ width: '100%', minHeight: '100px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '12px', color: '#ccc', fontSize: '13px', fontFamily: 'monospace', resize: 'vertical' }}
      />
      {noVncUrl && (
        <p style={{ color: '#555', fontSize: '12px', marginTop: '8px' }}>
          or <a href={noVncUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#ff0033' }}>open YouTube login</a> to authenticate via browser
        </p>
      )}
      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={handleReset}
          disabled={resetting}
          style={{
            padding: '8px 16px',
            background: resetting ? '#333' : 'rgba(255,0,51,0.1)',
            color: resetting ? '#666' : '#ff0033',
            border: '1px solid rgba(255,0,51,0.2)',
            borderRadius: '6px',
            cursor: resetting ? 'not-allowed' : 'pointer',
            fontSize: '13px',
          }}
        >
          {resetting ? 'Resetting...' : resetDone ? 'Session Cleared' : 'Clear Session'}
        </button>
        <p style={{ color: '#555', fontSize: '11px', marginTop: '6px' }}>
          Removes all stored cookies and browser session data
        </p>
      </div>
    </div>
  );
}
