const QUALITIES = ['360', '480', '720', '1080', '2160'];
const LABELS: Record<string, string> = { '360': '360p', '480': '480p', '720': '720p', '1080': '1080p', '2160': '4K' };

interface StepQualityProps {
  quality: string;
  onQualityChange: (q: string) => void;
}

export function StepQuality({ quality, onQualityChange }: StepQualityProps) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px' }}>
      <h3 style={{ color: '#fff', fontSize: '18px', marginBottom: '4px' }}>Max Quality</h3>
      <p style={{ color: '#666', fontSize: '13px', marginBottom: '16px' }}>iOS devices work best with 1080p or below (h264 codec)</p>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {QUALITIES.map((q) => (
          <button key={q} onClick={() => onQualityChange(q)} aria-pressed={quality === q}
            style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: quality === q ? 600 : 400,
              background: quality === q ? '#ff0033' : 'rgba(255,255,255,0.06)',
              color: quality === q ? 'white' : '#888',
            }}>
            {LABELS[q]}
          </button>
        ))}
      </div>
    </div>
  );
}
