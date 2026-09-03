import { Sparkles, Play, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import Section from '@/components/layout/Section';
import Badge from '@/components/ui/Badge';

const HeroSection = () => {
  return (
    <section className="relative overflow-hidden bg-gradient-hero" data-founder-hero>
      <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/nice-snow.png')]" />
      <Section className="py-24 lg:py-28 relative">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          <div className="space-y-8 text-white">
            <Badge variant="glass" className="text-xs tracking-[0.4em]">
              <Sparkles className="w-4 h-4" /> Instant Preview Engine
            </Badge>
            <h1 className="text-4xl md:text-6xl font-semibold leading-tight drop-shadow-lg">
              Bring memories to life with museum-grade AI art.
            </h1>
            <p className="text-lg text-white/80 max-w-xl leading-relaxed">
              Wondertone merges human storytelling with a powerful studio workflow. Upload once, explore curated styles,
              and checkout with physical canvas or instant digital in minutes.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/create" className="btn-primary">
                Start Creating
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/create" state={{ preselectedStyle: 'watercolor-dreams' }} className="btn-ghost">
                Browse Styles
                <Play className="w-4 h-4" />
              </Link>
            </div>
          </div>
          <div className="relative glow-ring">
            <div className="absolute -inset-6 bg-white/20 blur-3xl" />
            <div className="relative aspect-square rounded-founder overflow-hidden shadow-2xl border border-white/20">
              <img
                src="https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1000&q=80"
                alt="Wondertone preview"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-4 left-4 bg-white/80 backdrop-blur-md rounded-full px-4 py-2 text-xs font-semibold text-slate-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-indigo" /> Live preview ready
              </div>
            </div>
          </div>
        </div>
      </Section>
    </section>
  );
};

export default HeroSection;
