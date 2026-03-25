import { type ReactNode } from 'react';

interface Step {
  label: string;
  content: ReactNode;
}

interface StepperProps {
  steps: Step[];
  activeStep: number;
  onNext: () => void;
  onBack: () => void;
  onSkip?: () => void;
  showSkip?: boolean;
  nextLabel?: string;
}

export function Stepper({ steps, activeStep, onNext, onBack, onSkip, showSkip, nextLabel }: StepperProps) {
  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}>
      {/* Progress indicator */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', alignItems: 'center' }}>
        {steps.map((step, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: i < steps.length - 1 ? 1 : undefined }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: i <= activeStep ? '#ff0033' : '#333',
              color: i <= activeStep ? 'white' : '#666',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: 600,
              flexShrink: 0,
            }}>{i + 1}</div>
            <span style={{ color: i <= activeStep ? '#fff' : '#666', fontSize: '13px', whiteSpace: 'nowrap' }}>{step.label}</span>
            {i < steps.length - 1 && <div style={{ flex: 1, height: '1px', background: '#333' }} />}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div style={{ marginBottom: '24px' }}>{steps[activeStep].content}</div>

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button onClick={onBack} disabled={activeStep === 0}
          style={{ padding: '10px 20px', background: 'transparent', color: activeStep === 0 ? '#333' : '#888', border: 'none', cursor: 'pointer', fontSize: '14px' }}>
          Back
        </button>
        <div style={{ display: 'flex', gap: '8px' }}>
          {showSkip && <button onClick={onSkip} style={{ padding: '10px 16px', background: 'transparent', color: '#555', border: 'none', cursor: 'pointer', fontSize: '14px' }}>Skip</button>}
          <button onClick={onNext}
            style={{ padding: '10px 24px', background: '#ff0033', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
            {nextLabel ?? 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
