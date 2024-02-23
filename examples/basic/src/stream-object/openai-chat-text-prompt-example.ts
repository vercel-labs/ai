import { streamObject, zodSchema } from 'ai/function';
import { openai } from 'ai/provider';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

async function main() {
  const result = await streamObject({
    model: openai.chat({
      id: 'gpt-4-turbo-preview',
      maxTokens: 2000,
    }),

    schema: zodSchema(
      z.object({
        characters: z.array(
          z.object({
            name: z.string(),
            class: z
              .string()
              .describe('Character class, e.g. warrior, mage, or thief.'),
            description: z.string(),
          }),
        ),
      }),
    ),

    prompt:
      'Generate 3 character descriptions for a fantasy role playing game.',
  });

  for await (const partialObject of result.objectStream) {
    console.clear();
    console.log(partialObject);
  }
}

main().catch(console.error);
