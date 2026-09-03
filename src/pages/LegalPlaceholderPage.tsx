import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import FounderNavigation from '@/components/navigation/FounderNavigation';

type LegalPlaceholderPageProps = {
  title: string;
  children: ReactNode;
};

const LegalPlaceholderPage = ({ title, children }: LegalPlaceholderPageProps) => (
  <div className="min-h-screen bg-slate-950 text-white">
    <FounderNavigation />
    <main className="mx-auto max-w-3xl space-y-8 px-6 pt-36 pb-16">
      <div
        className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-5 py-4 text-sm text-amber-100"
        role="status"
      >
        This page is not in force and is not legal advice. Legal copy has not been supplied. Do not treat it as a live policy.
      </div>
      <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
      <div className="space-y-5 text-sm leading-7 text-white/75">{children}</div>
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

export default LegalPlaceholderPage;
