import { useState } from 'react';
import { Link } from 'react-router-dom';
import Section from '@/components/layout/Section';
import Card from '@/components/ui/Card';

const styleCards = [
  {
    id: 'watercolor-dreams',
    name: 'Watercolor Dreams',
    description: 'Soft washes and light.',
    image: '/art-style-thumbnails/watercolor-dreams.jpg',
  },
  {
    id: 'neon-splash',
    name: 'Neon Splash',
    description: 'Electric color and contrast.',
    image: '/art-style-thumbnails/neon-splash.jpg',
  },
  {
    id: 'classic-oil-painting',
    name: 'Classic Oil Painting',
    description: 'Traditional oil texture.',
    image: '/art-style-thumbnails/classic-oil-painting.jpg',
  },
];

const createStyleHref = (styleId: string) => `/create?preselected_style=${encodeURIComponent(styleId)}`;

const StyleShowcaseCard = ({
  style,
}: {
  style: (typeof styleCards)[number];
}) => {
  const [missing, setMissing] = useState(false);
  if (missing) return null;

  return (
    <Card className="overflow-hidden flex flex-col">
      <img
        src={style.image}
        alt={style.name}
        className="h-48 w-full object-cover"
        onError={() => setMissing(true)}
      />
      <div className="p-6 space-y-3 flex-1 flex flex-col">
        <h3 className="text-xl font-semibold">{style.name}</h3>
        <p className="text-sm text-slate-500 leading-relaxed">{style.description}</p>
        <Link
          to={createStyleHref(style.id)}
          state={{ preselectedStyle: style.id }}
          className="mt-auto inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 text-white py-2 text-sm font-semibold hover:bg-slate-800 transition"
        >
          Try this style
        </Link>
      </div>
    </Card>
  );
};

const StyleShowcase = () => {
  return (
    <Section id="styles" data-founder-anchor="styles">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-brand-pink">Styles</p>
          <h2 className="text-3xl font-semibold mt-2">Choose a look</h2>
        </div>
        <Link to="/create" className="text-sm text-brand-indigo hover:text-white transition">
          View all styles →
        </Link>
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        {styleCards.map((style) => (
          <StyleShowcaseCard key={style.id} style={style} />
        ))}
      </div>
    </Section>
  );
};

export default StyleShowcase;
