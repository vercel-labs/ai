import { openai } from '@ai-sdk/openai';
import { generateId, createDataStreamResponse, streamText } from 'ai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  // immediately start streaming (solves RAG issues with status, etc.)
  return createDataStreamResponse({
    execute: dataStream => {
      dataStream.writeData('initialized call');

      const result = streamText({
        model: openai('gpt-4o'),
        messages,
        onChunk() {
          dataStream.writeMessageAnnotation({ chunk: '123' });
        },
        onFinish() {
          // message annotation:
          dataStream.writeMessageAnnotation({
            id: generateId(), // e.g. id from saved DB record
            other: 'information',
          });

          // call annotation:
          dataStream.writeData('call completed');
        },
      });

      // TODO: result.mergeIntoDataStream(dataStream);
      dataStream.merge(
        result.toDataStream().pipeThrough(new TextDecoderStream()),
      );
    },
  });
}
