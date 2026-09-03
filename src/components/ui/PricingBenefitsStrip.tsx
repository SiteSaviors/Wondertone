import { Package, Brain, TrendingUp } from 'lucide-react';

type Benefit = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  gradient: string;
};

const benefits: Benefit[] = [
  {
    icon: Package,
    title: 'Concierge Production',
    description: 'Archival-grade materials with white-glove service',
    gradient: 'from-cyan-400 to-blue-400',
  },
  {
    icon: Brain,
    title: 'Smart Recommendations',
    description: 'AI-tuned style matching by Wondertone analysts',
    gradient: 'from-pink-400 to-purple-400',
  },
  {
    icon: TrendingUp,
    title: 'Social Momentum Console',
    description: 'Drive word-of-mouth and engagement in seconds',
    gradient: 'from-orange-400 to-pink-400',
  },
];

const PricingBenefitsStrip = () => {
  return (
    <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[36px] border border-white/15 bg-gradient-to-br from-[#14152d]/95 via-[#101226]/95 to-[#13182c]/95 p-10 shadow-[0_45px_110px_rgba(76,29,149,0.5)] backdrop-blur-2xl">
      {/* Radial glow backdrop */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(168,85,247,0.15),transparent_70%)]" />

      {/* Scan-line effect */}
      <div className="scan-line pointer-events-none absolute left-0 right-0 top-0 h-[2px] animate-scan-slow bg-gradient-to-r from-transparent via-purple-400/50 to-transparent" />

      <div className="relative z-10 space-y-8">
        {/* Header */}
        <div className="space-y-3">
          <h2 className="bg-gradient-to-r from-white to-white/80 bg-clip-text text-3xl font-bold text-transparent">
            Every Wondertone membership unlocks:
          </h2>
          <div className="h-[2px] w-24 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500" />
        </div>

        {/* Benefits grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <div
                key={index}
                className="group flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:border-white/20 hover:bg-white/10"
                style={{
                  animationDelay: `${index * 100}ms`,
                }}
              >
                {/* Icon with gradient */}
                <div
                  className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${benefit.gradient} shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}
                >
                  <Icon className="h-6 w-6 text-white" />
                </div>

                {/* Content */}
                <div className="space-y-1.5">
                  <h3 className="text-base font-semibold text-white">{benefit.title}</h3>
                  <p className="text-sm leading-relaxed text-white/60">{benefit.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer fine print */}
        <div className="space-y-2 border-t border-white/10 pt-6">
          <p className="text-xs leading-relaxed text-white/40">
            Prices shown in USD. Stripe handles all payments securely. Cancel anytime. Tokens renew monthly based on
            your tier and reset at the beginning of each billing cycle.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PricingBenefitsStrip;
