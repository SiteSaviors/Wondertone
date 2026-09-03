import { Link } from 'react-router-dom';
import Section from '@/components/layout/Section';

const FooterCTA = () => {
  return (
    <footer className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 py-16">
      <Section className="relative text-center space-y-8">
        <h2 className="text-3xl font-semibold">Start with a photo.</h2>
        <p className="text-white/70 max-w-2xl mx-auto text-lg">
          Upload a picture. Pick a look. Get the file.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link to="/create" className="btn-primary">
            Start creating
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
      </Section>
    </footer>
  );
};

export default FooterCTA;
