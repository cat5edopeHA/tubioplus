interface StepAuthProps {
  cookies: string;
  onCookiesChange: (cookies: string) => void;
  noVncUrl?: string;
}

export function StepAuth({ cookies, onCookiesChange, noVncUrl }: StepAuthProps) {
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
    </div>
  );
}
