import { getTranslations } from 'next-intl/server';
import { SectionHeading } from './section-heading';

const STEPS = ['one', 'two', 'three'] as const;

export async function HowItWorks() {
  const t = await getTranslations('Steps');

  return (
    <section id="how-it-works" aria-labelledby="steps-title">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeading id="steps-title" eyebrow={t('eyebrow')} title={t('title')} />

        <ol className="mt-12 grid gap-8 md:grid-cols-3 md:gap-6">
          {STEPS.map((step, index) => (
            <li
              key={step}
              className="relative flex flex-col items-center gap-3 text-center md:items-start md:text-left"
            >
              {/* Connector line between the steps on wide screens */}
              {index < STEPS.length - 1 ? (
                <span
                  aria-hidden
                  className="absolute top-6 left-16 hidden h-px w-[calc(100%-4rem)] border-t-2 border-dashed md:block"
                />
              ) : null}
              <span className="relative grid size-12 place-items-center rounded-full bg-primary text-lg font-extrabold text-primary-foreground">
                {index + 1}
              </span>
              <h3 className="mt-2 text-lg font-bold">{t(`${step}.title`)}</h3>
              <p className="max-w-xs text-muted-foreground">{t(`${step}.body`)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
