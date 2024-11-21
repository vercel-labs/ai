import 'dotenv/config';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateObject } from 'ai';
import { z } from 'zod';

async function main() {
  const togetherai = createOpenAICompatible({
    apiKeyEnvVarName: 'TOGETHER_AI_API_KEY',
    baseURL: 'https://api.together.xyz/v1',
    name: 'togetherai',
  });
  const model = togetherai.chatModel('mistralai/Mistral-7B-Instruct-v0.1');
  const result = await generateObject({
    model,
    schema: z.object({
      recipe: z.object({
        name: z.string(),
        ingredients: z.array(
          z.object({
            name: z.string(),
            amount: z.string(),
          }),
        ),
        steps: z.array(z.string()),
      }),
    }),
    prompt: 'Generate a lasagna recipe.',
  });

  console.log(JSON.stringify(result.object.recipe, null, 2));
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
}

main().catch(console.error);
