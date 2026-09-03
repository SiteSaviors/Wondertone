import Section from '@/components/layout/Section';
import Card from '@/components/ui/Card';

const steps = [
  {
    step: '01',
    title: 'Upload & Sense',
    description: 'Smart orientation detection, auto-crop, and emotional tagging set the stage for recommendations.',
  },
  {
    step: '02',
    title: 'Explore Styles',
    description: 'Parallel previews stream into the rail with blur placeholders so you never wait on a spinner.',
  },
  {
    step: '03',
    title: 'Customize & Upsell',
    description: 'Canvas, frame, and digital options adjust the sticky order rail in real time.',
  },
  {
    step: '04',
    title: 'Celebrate & Share',
    description: 'Guest checkout wraps in seconds while tokens, referrals, and galleries spark the flywheel.',
  },
];

const StepsJourney = () => {
  return (
    <section className="bg-slate-900 py-20">
      <Section id="support" data-founder-anchor="support">
        <p className="text-sm uppercase tracking-[0.3em] text-brand-indigo">How Wondertone Works</p>
        <h2 className="text-3xl font-semibold mt-3 mb-10">A journey engineered for instant wow and long-term love</h2>
        <div className="grid md:grid-cols-4 gap-6">
          {steps.map((item) => (
            <Card key={item.step} glass>
              <div className="text-sm text-brand-pink font-semibold tracking-[0.3em]">{item.step}</div>
              <h3 className="text-xl font-semibold mt-4">{item.title}</h3>
              <p className="text-sm text-white/70 mt-4 leading-relaxed">{item.description}</p>
            </Card>
          ))}
        </div>
      </Section>
    </section>
  );
};

export default StepsJourney;
