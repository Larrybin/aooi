// data: demo translations (next-intl) + static hero content
// cache: default
// reason: public demo page; keep server output cache-friendly
import { getTranslations } from 'next-intl/server';

import { Hero } from '@/themes/default/blocks/hero';

export default async function AiVideoGeneratorPage() {
  const tt = await getTranslations('demo.ai-video-generator');

  return (
    <>
      <Hero
        hero={{
          title: tt.raw('title'),
          description: tt.raw('description'),
        }}
      />
    </>
  );
}
