const SB_CATEGORIES = ['sponsor', 'selfpromo', 'interaction', 'intro', 'outro'];

interface StepFeaturesProps {
  sponsorblockEnabled: boolean;
  onSponsorblockToggle: (enabled: boolean) => void;
  sponsorblockCategories: string[];
  onCategoriesChange: (cats: string[]) => void;
  dearrowEnabled: boolean;
  onDearrowToggle: (enabled: boolean) => void;
}

export function StepFeatures(props: StepFeaturesProps) {
  const toggleCategory = (cat: string) => {
    const cats = props.sponsorblockCategories.includes(cat)
      ? props.sponsorblockCategories.filter((c) => c !== cat)
      : [...props.sponsorblockCategories, cat];
    props.onCategoriesChange(cats);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ color: '#fff', fontSize: '16px' }}>SponsorBlock</h3>
          <input type="checkbox" checked={props.sponsorblockEnabled} onChange={(e) => props.onSponsorblockToggle(e.target.checked)} />
        </div>
        {props.sponsorblockEnabled && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {SB_CATEGORIES.map((cat) => (
              <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ccc', fontSize: '13px' }}>
                <input type="checkbox" checked={props.sponsorblockCategories.includes(cat)} onChange={() => toggleCategory(cat)} />
                {cat}
              </label>
            ))}
          </div>
        )}
      </div>
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ color: '#fff', fontSize: '16px' }}>DeArrow</h3>
          <input type="checkbox" checked={props.dearrowEnabled} onChange={(e) => props.onDearrowToggle(e.target.checked)} />
        </div>
        <p style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>Replace titles and thumbnails with community-submitted alternatives</p>
      </div>
    </div>
  );
}
