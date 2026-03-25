import { useState } from 'react';
import { Stepper } from '../components/Stepper';
import { StepAuth } from '../components/StepAuth';
import { StepQuality } from '../components/StepQuality';
import { StepFeatures } from '../components/StepFeatures';
import { StepInstall } from '../components/StepInstall';

const basePath = (window as any).__BASE_PATH__ ?? '';
const noVncUrl = (window as any).__NOVNC_URL__ || undefined;

export function Configure() {
  const [step, setStep] = useState(0);
  const [cookies, setCookies] = useState('');
  const [quality, setQuality] = useState('1080');
  const [sbEnabled, setSbEnabled] = useState(false);
  const [sbCategories, setSbCategories] = useState(['sponsor', 'selfpromo', 'interaction', 'intro', 'outro']);
  const [daEnabled, setDaEnabled] = useState(false);
  const [addonUrl, setAddonUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generateUrl = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${basePath}/api/encrypt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cookies,
          quality,
          sponsorblock: { enabled: sbEnabled, categories: sbCategories },
          dearrow: { enabled: daEnabled },
        }),
      });
      const data = await res.json();
      setAddonUrl(data.url);
    } catch {
      setAddonUrl(null);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (step === 2) { generateUrl(); }
    setStep((s) => Math.min(s + 1, 3));
  };

  const steps = [
    { label: 'Auth', content: <StepAuth cookies={cookies} onCookiesChange={setCookies} noVncUrl={noVncUrl} /> },
    { label: 'Quality', content: <StepQuality quality={quality} onQualityChange={setQuality} /> },
    { label: 'Features', content: <StepFeatures sponsorblockEnabled={sbEnabled} onSponsorblockToggle={setSbEnabled} sponsorblockCategories={sbCategories} onCategoriesChange={setSbCategories} dearrowEnabled={daEnabled} onDearrowToggle={setDaEnabled} /> },
    { label: 'Install', content: <StepInstall addonUrl={addonUrl} loading={loading} /> },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
      <Stepper
        steps={steps}
        activeStep={step}
        onNext={handleNext}
        onBack={() => setStep((s) => Math.max(s - 1, 0))}
        onSkip={() => setStep((s) => Math.min(s + 1, 3))}
        showSkip={step === 0}
        nextLabel={step === 3 ? undefined : 'Next'}
      />
    </div>
  );
}
