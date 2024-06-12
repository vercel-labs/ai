import { anthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { experimental_createModelRegistry } from 'ai';
import dotenv from 'dotenv';

dotenv.config();

export const registry = experimental_createModelRegistry({
  // register provider with prefix and default setup:
  anthropic,

  // register provider with prefix and custom setup:
  openai: createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  }),
});
