import { Link } from 'react-router-dom';
import FounderNavigation from '@/components/navigation/FounderNavigation';

const GiftPage = () => (
  <div className="min-h-screen bg-slate-950 text-white">
    <FounderNavigation />
    <main className="mx-auto max-w-xl space-y-4 px-6 pt-36 pb-24 text-center">
      <h1 className="font-display text-3xl font-semibold">Gift</h1>
      <p className="text-white/70">
        This route is unlisted. Nothing here is for sale. It is not an offer and is not linked from
        navigation.
      </p>
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

export default GiftPage;
