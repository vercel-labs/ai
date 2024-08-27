import { cohere } from '@ai-sdk/cohere';
import { embed } from 'ai';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const { embedding, usage } = await embed({
    model: cohere.textEmbeddingModel('embed-multilingual-v3.0'),
    value: 'sunny day at the beach',
  });

  console.log(embedding);
  console.log(usage);
}

main().catch(console.error);
