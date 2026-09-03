import FounderNavigation from '@/components/navigation/FounderNavigation';

const GiftPage = () => (
  <div className="min-h-screen bg-slate-950 text-white">
    <FounderNavigation />
    <main className="mx-auto max-w-xl space-y-4 px-6 py-24 text-center">
      <h1 className="font-display text-3xl font-semibold">Gift</h1>
      <p className="text-white/70">
        This route is unlisted. Nothing here is for sale. It is not an offer and is not linked from
        navigation.
      </p>
    </main>
  </div>
);

export default GiftPage;
