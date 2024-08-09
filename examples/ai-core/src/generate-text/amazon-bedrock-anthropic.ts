import { bedrock } from '@ai-sdk/amazon-bedrock';
import { generateText } from 'ai';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const result = await generateText({
    model: bedrock.anthropicLanguageModel(
      'anthropic.claude-3-haiku-20240307-v1:0',
    ),
    prompt: 'Invent a new holiday and describe its traditions.',
  });

  console.log(result.text);
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
}

main().catch(console.error);
