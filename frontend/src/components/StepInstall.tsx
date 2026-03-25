import { useState } from 'react';

interface StepInstallProps {
  addonUrl: string | null;
  loading: boolean;
}

export function StepInstall({ addonUrl, loading }: StepInstallProps) {
  const [copied, setCopied] = useState(false);

  const copyUrl = async () => {
    if (!addonUrl) return;
    await navigator.clipboard.writeText(addonUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <p style={{ color: '#888', textAlign: 'center' }}>Generating addon URL...</p>;
  if (!addonUrl) return <p style={{ color: '#f44', textAlign: 'center' }}>Failed to generate URL</p>;

  const stremioUrl = addonUrl.replace(/^https?:/, 'stremio:');

  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px' }}>
      <h3 style={{ color: '#fff', fontSize: '18px', marginBottom: '16px' }}>Your Addon URL</h3>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input readOnly value={addonUrl} style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px', color: '#ccc', fontSize: '12px', fontFamily: 'monospace' }} />
        <button onClick={copyUrl} style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.06)', color: '#888', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <a href={stremioUrl} style={{ display: 'block', background: '#ff0033', color: 'white', padding: '14px', borderRadius: '8px', textAlign: 'center', textDecoration: 'none', fontSize: '16px', fontWeight: 600 }}>
        Install in Stremio
      </a>
    </div>
  );
}
