import { luma } from '@ai-sdk/luma';
import { experimental_generateImage as generateImage } from 'ai';
import 'dotenv/config';
import fs from 'fs';

async function main() {
  const result = await generateImage({
    model: luma.image('photon-flash-1'),
    prompt: 'A blue cream Persian cat launching its website on Vercel',
    aspectRatio: '1:1',
    providerOptions: {
      luma: {
        // https://docs.lumalabs.ai/docs/image-generation#style-reference
        style_ref: [
          {
            url: 'https://pbs.twimg.com/media/GiBweI6XUAEOh3w?format=jpg&name=4096x4096',
            weight: 0.8,
          },
        ],
      },
    },
  });

  for (const [index, image] of result.images.entries()) {
    const filename = `image-${Date.now()}-${index}.png`;
    fs.writeFileSync(filename, image.uint8Array);
    console.log(`Image saved to ${filename}`);
  }
}

main().catch(console.error);
