import { Link } from 'react-router-dom';
import FounderNavigation from '@/components/navigation/FounderNavigation';

const PricingPage = () => (
  <div className="min-h-screen bg-slate-950 text-white">
    <FounderNavigation />
    <main className="mx-auto max-w-xl space-y-6 px-6 pt-36 pb-24 text-center">
      <p className="text-xs uppercase tracking-[0.32em] text-white/45">Not offered</p>
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        Memberships and token packs are not for sale.
      </h1>
      <p className="text-white/70 leading-relaxed">
        The first product is the full-resolution artwork file. Start with a photo in the studio.
      </p>
      <div className="flex flex-wrap justify-center gap-4">
        <Link to="/create" className="btn-primary">
          Upload a photo
        </Link>
      </div>
      <p className="text-xs text-white/40">
        <Link to="/privacy" className="underline underline-offset-4">
          Privacy
        </Link>
        {' · '}
        <Link to="/terms" className="underline underline-offset-4">
          Terms
        </Link>
      </p>
    </main>
  </div>
);

export default PricingPage;
