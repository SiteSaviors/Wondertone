import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import Section from '@/components/layout/Section';

const HeroSection = () => {
  return (
    <section className="relative overflow-hidden bg-gradient-hero" data-founder-hero>
      <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/nice-snow.png')]" />
      <Section className="py-24 lg:py-28 relative">
        <div className="mx-auto max-w-3xl space-y-8 text-center text-white">
          <h1 className="text-4xl md:text-6xl font-semibold leading-tight drop-shadow-lg">
            The photo you love, as art.
          </h1>
          <p className="text-lg text-white/80 leading-relaxed">
            One upload. One style. No prompts.
          </p>
          <div className="flex justify-center">
            <Link to="/create" className="btn-primary">
              Upload a photo
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </Section>
    </section>
  );
};

export default HeroSection;
