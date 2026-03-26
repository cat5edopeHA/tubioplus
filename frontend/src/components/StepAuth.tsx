import { useState } from 'react';

declare global {
  interface Window {
    __BASE_PATH__?: string;
  }
}

interface StepAuthProps {
  cookies: string;
  onCookiesChange: (cookies: string) => void;
  noVncUrl?: string;
}

export function StepAuth({ cookies, onCookiesChange, noVncUrl }: StepAuthProps) {
  const [resetStatus, setResetStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleReset = async () => {
    if (!window.confirm('This will clear your Google login and all cached data. You will need to log in again via noVNC. Continue?')) {
      return;
    }
    setResetStatus('loading');
    try {
      const basePath = window.__BASE_PATH__ ?? '';
      const res = await fetch(`${basePath}/api/reset`, { method: 'POST' });
      if (res.ok) {
        setResetStatus('success');
        setTimeout(() => setResetStatus('idle'), 3000);
      } else {
        setResetStatus('error');
        setTimeout(() => setResetStatus('idle'), 3000);
      }
    } catch {
      setResetStatus('error');
      setTimeout(() => setResetStatus('idle'), 3000);
    }
  };

  const resetLabel = resetStatus === 'loading' ? 'Clearing...' : resetStatus === 'success' ? 'Session cleared' : resetStatus === 'error' ? 'Reset failed' : 'Clear Session';
  const resetColor = resetStatus === 'success' ? '#22c55e' : resetStatus === 'error' ? '#ef4444' : '#ff0033';

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
      <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={handleReset}
          disabled={resetStatus === 'loading'}
          style={{
            background: 'transparent',
            border: `1px solid ${resetColor}`,
            color: resetColor,
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            cursor: resetStatus === 'loading' ? 'wait' : 'pointer',
            opacity: resetStatus === 'loading' ? 0.6 : 1,
            transition: 'all 0.2s',
          }}
        >
          {resetLabel}
        </button>
        <span style={{ color: '#555', fontSize: '11px' }}>Clears cookies, cache, and browser session</span>
      </div>
    </div>
  );
}
