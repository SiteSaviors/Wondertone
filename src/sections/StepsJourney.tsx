import Section from '@/components/layout/Section';
import Card from '@/components/ui/Card';

const steps = [
  {
    step: '01',
    title: 'Upload',
    description: 'Add a picture.',
  },
  {
    step: '02',
    title: 'Choose a style',
    description: 'Pick a look.',
  },
  {
    step: '03',
    title: 'See it',
    description: 'Reveal the artwork.',
  },
  {
    step: '04',
    title: 'Get the file',
    description: 'The product is the full-resolution file.',
  },
];

const StepsJourney = () => {
  return (
    <section className="bg-slate-900 py-20">
      <Section id="how-it-works" data-founder-anchor="how-it-works">
        <p className="text-sm uppercase tracking-[0.3em] text-brand-indigo">How it works</p>
        <h2 className="text-3xl font-semibold mt-3 mb-10">Upload → Choose a style → See it → Get the file.</h2>
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
