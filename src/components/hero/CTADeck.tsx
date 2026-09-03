import { Check } from 'lucide-react';

type CTADeckProps = {
  onUploadClick: () => void;
  frictionReducers?: string[];
  className?: string;
};

const defaultFrictionReducers = [
  'Free preview',
  'No credit card',
  'No prompts',
];

const CTADeck = ({
  onUploadClick,
  frictionReducers = defaultFrictionReducers,
  className = '',
}: CTADeckProps) => {
  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      {/* Primary CTA */}
      <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-4xl px-4">
        <button
          type="button"
          onClick={onUploadClick}
          className="font-fraunces w-full mx-auto btn-primary px-8 py-5 md:px-16 md:py-7 text-2xl sm:text-3xl md:text-[35px] font-bold tracking-[-0.02em] drop-shadow-lg shadow-[0_-4px_20px_rgba(255,255,255,0.1),_0_25px_60px_rgba(99,102,241,0.7)] hover:shadow-[0_-6px_30px_rgba(255,255,255,0.15),_0_32px_75px_rgba(99,102,241,0.85)] hover:scale-105 transition-all duration-300 whitespace-nowrap flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, rgb(192 132 252) 0%, rgb(59 130 246) 100%)'
          }}
        >
          Upload a photo
        </button>
      </div>

      {/* Friction Reducers - Horizontal on all screen sizes */}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 px-4">
        {frictionReducers.map((text, index) => (
          <div key={index} className="flex items-center gap-1.5 text-xs sm:text-sm text-white/70 whitespace-nowrap">
            <div className="flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-emerald-500/20 flex-shrink-0">
              <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" strokeWidth={3} />
            </div>
            <span className="font-poppins">{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CTADeck;
