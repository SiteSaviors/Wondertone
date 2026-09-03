import Section from '@/components/layout/Section';
import Card from '@/components/ui/Card';

const highlights = [
  {
    icon: '🌟',
    title: 'Social proof engine',
    body: 'Smart momentum modules encourage hesitant visitors with live stories.',
  },
  {
    icon: '🛡️',
    title: 'Trust built in',
    body: 'Stripe, Supabase, and multi-region caching keep transactions secure and fast.',
  },
  {
    icon: '⏱️',
    title: 'Time-to-wow under 10s',
    body: 'Parallel preview generation & cache warming keep excitement high.',
  },
];

const FooterCTA = () => {
  return (
    <footer className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 py-16">
      <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
      <Section id="pricing" data-founder-anchor="pricing" className="relative text-center space-y-10">
        <h2 className="text-4xl font-semibold">Ready to deliver the world’s most meaningful art gifts?</h2>
        <p className="text-white/70 max-w-2xl mx-auto text-lg">
          Upload a photo. Choose a style. Keep the artwork as a digital file or a canvas print.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <a href="/create" className="btn-primary">
            Start Creating Now
          </a>
          <a href="#styles" className="btn-ghost">
            View Marketplace Preview
          </a>
        </div>
        <div className="grid md:grid-cols-3 gap-6 text-left">
          {highlights.map((item) => (
            <Card glass key={item.title} className="flex items-start gap-3">
              <span className="text-2xl" aria-hidden>{item.icon}</span>
              <div>
                <h4 className="font-semibold text-white">{item.title}</h4>
                <p className="text-sm text-white/70">{item.body}</p>
              </div>
            </Card>
          ))}
        </div>
      </Section>
    </footer>
  );
};

export default FooterCTA;
