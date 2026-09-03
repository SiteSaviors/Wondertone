import FounderNavigation from '@/components/navigation/FounderNavigation';
import HeroSection from '@/sections/HeroSection';
import StyleShowcase from '@/sections/StyleShowcase';
import StepsJourney from '@/sections/StepsJourney';
import FooterCTA from '@/sections/FooterCTA';

const LandingPage = () => {
  return (
    <div className="bg-slate-950 text-white min-h-screen">
      <FounderNavigation />
      <HeroSection />
      <StyleShowcase />
      <StepsJourney />
      <FooterCTA />
    </div>
  );
};

export default LandingPage;
