import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import dotenv from 'dotenv';

dotenv.config();

const error = `
❯ pnpm tsx src/generate-text/anthropic-cache-control.ts
Body {
  "model": "claude-3-5-sonnet-20240620",
  "max_tokens": 4096,
  "temperature": 0,
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "You are a JavaScript expert."
        },
        {
          "type": "text",
          "text": "Error messages: \nAPICallError [AI_APICallError]: Failed to process error response\n    at postToApi (/Users/larsgrammel/repositories/ai/packages/provider-utils/dist/index.js:382:15)\n    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)\n    ... 4 lines matching cause stack trace ...\n    at async fn (/Users/larsgrammel/repositories/ai/packages/ai/dist/index.js:2723:36)\n    at async /Users/larsgrammel/repositories/ai/packages/ai/dist/index.js:339:22\n    at async main (/Users/larsgrammel/repositories/ai/examples/ai-core/src/generate-text/anthropic-cache-control.ts:2:1351) {\n  cause: TypeError: Body is unusable\n      at consumeBody (node:internal/deps/undici/undici:4281:15)\n      at _Response.text (node:internal/deps/undici/undici:4236:18)\n      at /Users/larsgrammel/repositories/ai/packages/provider-utils/dist/index.js:443:39\n      at postToApi (/Users/larsgrammel/repositories/ai/packages/provider-utils/dist/index.js:373:34)\n      at process.processTicksAndRejections (node:internal/process/task_queues:95:5)\n      at async AnthropicMessagesLanguageModel.doGenerate (/Users/larsgrammel/repositories/ai/packages/anthropic/dist/index.js:316:50)\n      at async fn (/Users/larsgrammel/repositories/ai/packages/ai/dist/index.js:2748:34)\n      at async /Users/larsgrammel/repositories/ai/packages/ai/dist/index.js:339:22\n      at async _retryWithExponentialBackoff (/Users/larsgrammel/repositories/ai/packages/ai/dist/index.js:170:12)\n      at async fn (/Users/larsgrammel/repositories/ai/packages/ai/dist/index.js:2723:36),\n  url: 'https://api.anthropic.com/v1/messages',\n  requestBodyValues: {\n    model: 'claude-3-5-sonnet-20240620',\n    top_k: undefined,\n    max_tokens: 4096,\n    temperature: 0,\n    top_p: undefined,\n    stop_sequences: undefined,\n    system: undefined,\n    messages: [ [Object] ],\n    tools: undefined,\n    tool_choice: undefined\n  },\n  statusCode: 400,\n  responseHeaders: {\n    'cf-cache-status': 'DYNAMIC',\n    'cf-ray': '8b39b60ab8734516-TXL',\n    connection: 'keep-alive',\n    'content-length': '171',\n    'content-type': 'application/json',\n    date: 'Thu, 15 Aug 2024 14:00:28 GMT',\n    'request-id': 'req_01PLrS159iiihG7kS9PFQiqx',\n    server: 'cloudflare',\n    via: '1.1 google',\n    'x-cloud-trace-context': '1371f8e6d358102b79d109db3829d62e',\n    'x-robots-tag': 'none',\n    'x-should-retry': 'false'\n  },\n  responseBody: undefined,\n  isRetryable: false,\n  data: undefined,\n  [Symbol(vercel.ai.error)]: true,\n  [Symbol(vercel.ai.error.AI_APICallError)]: true\n}",
          "cache_control": {
            "type": "ephemeral"
          }
        },
        {
          "type": "text",
          "text": "Explain the error message."
        }
      ]
    }
  ]
}
Fetched {"type":"error","error":{"type":"invalid_request_error","message":"The message up to and including the first cache-control block must be at least 1024 tokens. Found: 939."}}

APICallError [AI_APICallError]: Failed to process error response
    at postToApi (/Users/larsgrammel/repositories/ai/packages/provider-utils/dist/index.js:382:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    ... 4 lines matching cause stack trace ...
    at async fn (/Users/larsgrammel/repositories/ai/packages/ai/dist/index.js:2723:36)
    at async /Users/larsgrammel/repositories/ai/packages/ai/dist/index.js:339:22
    at async main (/Users/larsgrammel/repositories/ai/examples/ai-core/src/generate-text/anthropic-cache-control.ts:54:361) {
  cause: TypeError: Body is unusable
      at consumeBody (node:internal/deps/undici/undici:4281:15)
      at _Response.text (node:internal/deps/undici/undici:4236:18)
      at /Users/larsgrammel/repositories/ai/packages/provider-utils/dist/index.js:443:39
      at postToApi (/Users/larsgrammel/repositories/ai/packages/provider-utils/dist/index.js:373:34)
      at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
      at async AnthropicMessagesLanguageModel.doGenerate (/Users/larsgrammel/repositories/ai/packages/anthropic/dist/index.js:316:50)
      at async fn (/Users/larsgrammel/repositories/ai/packages/ai/dist/index.js:2748:34)
      at async /Users/larsgrammel/repositories/ai/packages/ai/dist/index.js:339:22
      at async _retryWithExponentialBackoff (/Users/larsgrammel/repositories/ai/packages/ai/dist/index.js:170:12)
      at async fn (/Users/larsgrammel/repositories/ai/packages/ai/dist/index.js:2723:36),
  url: 'https://api.anthropic.com/v1/messages',
  requestBodyValues: {
    model: 'claude-3-5-sonnet-20240620',
    top_k: undefined,
    max_tokens: 4096,
    temperature: 0,
    top_p: undefined,
    stop_sequences: undefined,
    system: undefined,
    messages: [ [Object] ],
    tools: undefined,
    tool_choice: undefined
  },
  statusCode: 400,
  responseHeaders: {
    'cf-cache-status': 'DYNAMIC',
    'cf-ray': '8b39b87a8f684541-TXL',
    connection: 'keep-alive',
    'content-length': '173',
    'content-type': 'application/json',
    date: 'Thu, 15 Aug 2024 14:02:08 GMT',
    'request-id': 'req_01YZqjpifTdvLZqfwBieLs44',
    server: 'cloudflare',
    via: '1.1 google',
    'x-cloud-trace-context': '00f2b1629d0dc8c6a4714db1dbdb4c2c',
    'x-robots-tag': 'none',
    'x-should-retry': 'false'
  },
  responseBody: undefined,
  isRetryable: false,
  data: undefined,
  [Symbol(vercel.ai.error)]: true,
  [Symbol(vercel.ai.error.AI_APICallError)]: true
}
}`;

const anthropic = createAnthropic({
  // example fetch wrapper that logs the input to the API call:
  fetch: async (url, options) => {
    console.log('URL', url);
    console.log('Headers', JSON.stringify(options!.headers, null, 2));
    console.log(
      `Body ${JSON.stringify(JSON.parse(options!.body! as string), null, 2)}`,
    );
    return await fetch(url, options);
  },
});

async function main() {
  const result = await generateText({
    model: anthropic('claude-3-5-sonnet-20240620', {
      cacheControl: true,
    }),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'You are a JavaScript expert.',
          },
          {
            type: 'text',
            text: `Error messages: ${error}`,
            experimental_providerMetadata: {
              anthropic: {
                cacheControl: { type: 'ephemeral' },
              },
            },
          },
          {
            type: 'text',
            text: 'Explain the error message.',
          },
        ],
      },
    ],
  });

  console.log(result.text);
  console.log(result.experimental_providerMetadata?.anthropic);
  // e.g. { cacheCreationInputTokens: 2118, cacheReadInputTokens: 0 }
}

main().catch(console.error);
