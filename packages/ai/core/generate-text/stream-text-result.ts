import { ServerResponse } from 'node:http';
import { StreamData } from '../../streams/stream-data';
import { DataStreamWriter } from '../data-stream/data-stream-writer';
import { CoreAssistantMessage, CoreToolMessage } from '../prompt/message';
import {
  CallWarning,
  FinishReason,
  LanguageModelRequestMetadata,
  LogProbs,
  ProviderMetadata,
} from '../types';
import { Source } from '../types/language-model';
import { LanguageModelResponseMetadata } from '../types/language-model-response-metadata';
import { LanguageModelUsage } from '../types/usage';
import { AsyncIterableStream } from '../util/async-iterable-stream';
import { StepResult } from './step-result';
import { ToolCallUnion } from './tool-call';
import { ToolResultUnion } from './tool-result';
import { ToolSet } from './tool-set';
import { ReasoningDetail } from './reasoning-detail';

export type DataStreamOptions = {
  /**
   * Send usage parts to the client.
   * Default to true.
   */
  // TODO change default to false in v5: secure by default
  sendUsage?: boolean;

  /**
   * Send reasoning parts to the client.
   * Default to false.
   */
  sendReasoning?: boolean;

  /**
   * Send source parts to the client.
   * Default to false.
   */
  sendSources?: boolean;

  /**
   * Send the finish event to the client.
   * Set to false if you are using additional streamText calls
   * that send additional data.
   * Default to true.
   */
  experimental_sendFinishReason?: boolean;
};

/**
A result object for accessing different stream types and additional information.
 */
export interface StreamTextResult<TOOLS extends ToolSet, PARTIAL_OUTPUT> {
  /**
Warnings from the model provider (e.g. unsupported settings) for the first step.
     */
  readonly warnings: Promise<CallWarning[] | undefined>;

  /**
The total token usage of the generated response.
When there are multiple steps, the usage is the sum of all step usages.

Resolved when the response is finished.
     */
  readonly usage: Promise<LanguageModelUsage>;

  /**
Sources that have been used as input to generate the response.
For multi-step generation, the sources are accumulated from all steps.

Resolved when the response is finished.
   */
  readonly sources: Promise<Source[]>;

  /**
The reason why the generation finished. Taken from the last step.

Resolved when the response is finished.
     */
  readonly finishReason: Promise<FinishReason>;

  /**
Additional provider-specific metadata from the last step.
Metadata is passed through from the provider to the AI SDK and
enables provider-specific results that can be fully encapsulated in the provider.
   */
  readonly providerMetadata: Promise<ProviderMetadata | undefined>;

  /**
@deprecated Use `providerMetadata` instead.
   */
  readonly experimental_providerMetadata: Promise<ProviderMetadata | undefined>;

  /**
The full text that has been generated by the last step.

Resolved when the response is finished.
     */
  readonly text: Promise<string>;

  /**
The reasoning that has been generated by the last step.

Resolved when the response is finished.
     */
  // TODO v5: rename to `reasoningText`
  readonly reasoning: Promise<string | undefined>;

  /**
The full reasoning that the model has generated.

Resolved when the response is finished.
   */
  // TODO v5: rename to `reasoning`
  readonly reasoningDetails: Promise<Array<ReasoningDetail>>;

  /**
The tool calls that have been executed in the last step.

Resolved when the response is finished.
     */
  readonly toolCalls: Promise<ToolCallUnion<TOOLS>[]>;

  /**
The tool results that have been generated in the last step.

Resolved when the all tool executions are finished.
     */
  readonly toolResults: Promise<ToolResultUnion<TOOLS>[]>;

  /**
Details for all steps.
You can use this to get information about intermediate steps,
such as the tool calls or the response headers.
   */
  readonly steps: Promise<Array<StepResult<TOOLS>>>;

  /**
Additional request information from the last step.
 */
  readonly request: Promise<LanguageModelRequestMetadata>;

  /**
Additional response information from the last step.
 */
  readonly response: Promise<
    LanguageModelResponseMetadata & {
      /**
The response messages that were generated during the call. It consists of an assistant message,
potentially containing tool calls.

When there are tool results, there is an additional tool message with the tool results that are available.
If there are tools that do not have execute functions, they are not included in the tool results and
need to be added separately.
       */
      messages: Array<CoreAssistantMessage | CoreToolMessage>;
    }
  >;

  /**
  A text stream that returns only the generated text deltas. You can use it
  as either an AsyncIterable or a ReadableStream. When an error occurs, the
  stream will throw the error.
     */
  readonly textStream: AsyncIterableStream<string>;

  /**
  A stream with all events, including text deltas, tool calls, tool results, and
  errors.
  You can use it as either an AsyncIterable or a ReadableStream.
  Only errors that stop the stream, such as network errors, are thrown.
     */
  readonly fullStream: AsyncIterableStream<TextStreamPart<TOOLS>>;

  /**
A stream of partial outputs. It uses the `experimental_output` specification.
   */
  readonly experimental_partialOutputStream: AsyncIterableStream<PARTIAL_OUTPUT>;

  /**
Consumes the stream without processing the parts.
This is useful to force the stream to finish.
It effectively removes the backpressure and allows the stream to finish,
triggering the `onFinish` callback and the promise resolution.
  */
  consumeStream(): Promise<void>;

  /**
  Converts the result to a data stream.

  @param data an optional StreamData object that will be merged into the stream.
  @param getErrorMessage an optional function that converts an error to an error message.
  @param sendUsage whether to send the usage information to the client. Defaults to true.
  @param sendReasoning whether to send the reasoning information to the client. Defaults to false.
  @return A data stream.
     */
  toDataStream(
    options?: {
      data?: StreamData;
      getErrorMessage?: (error: unknown) => string;
    } & DataStreamOptions,
  ): ReadableStream<Uint8Array>;

  /**
   * Merges the result as a data stream into another data stream.
   *
   * @param dataStream A data stream writer.
   * @param options.sendUsage Whether to send the usage information to the client. Defaults to true.
   * @param options.sendReasoning Whether to send the reasoning information to the client. Defaults to false.
   */
  mergeIntoDataStream(
    dataStream: DataStreamWriter,
    options?: DataStreamOptions,
  ): void;

  /**
  Writes data stream output to a Node.js response-like object.

  @param response A Node.js response-like object (ServerResponse).
  @param options.status The status code.
  @param options.statusText The status text.
  @param options.headers The headers.
  @param options.data The stream data.
  @param options.getErrorMessage An optional function that converts an error to an error message.
  @param options.sendUsage Whether to send the usage information to the client. Defaults to true.
  @param options.sendReasoning Whether to send the reasoning information to the client. Defaults to false.
     */
  pipeDataStreamToResponse(
    response: ServerResponse,
    options?: ResponseInit & {
      data?: StreamData;
      getErrorMessage?: (error: unknown) => string;
    } & DataStreamOptions,
  ): void;

  /**
  Writes text delta output to a Node.js response-like object.
  It sets a `Content-Type` header to `text/plain; charset=utf-8` and
  writes each text delta as a separate chunk.

  @param response A Node.js response-like object (ServerResponse).
  @param init Optional headers, status code, and status text.
     */
  pipeTextStreamToResponse(response: ServerResponse, init?: ResponseInit): void;

  /**
  Converts the result to a streamed response object with a stream data part stream.
  It can be used with the `useChat` and `useCompletion` hooks.

  @param options.status The status code.
  @param options.statusText The status text.
  @param options.headers The headers.
  @param options.data The stream data.
  @param options.getErrorMessage An optional function that converts an error to an error message.
  @param options.sendUsage Whether to send the usage information to the client. Defaults to true.
  @param options.sendReasoning Whether to send the reasoning information to the client. Defaults to false.

  @return A response object.
     */
  toDataStreamResponse(
    options?: ResponseInit & {
      data?: StreamData;
      getErrorMessage?: (error: unknown) => string;
    } & DataStreamOptions,
  ): Response;

  /**
  Creates a simple text stream response.
  Each text delta is encoded as UTF-8 and sent as a separate chunk.
  Non-text-delta events are ignored.

  @param init Optional headers, status code, and status text.
     */
  toTextStreamResponse(init?: ResponseInit): Response;
}

export type TextStreamPart<TOOLS extends ToolSet> =
  | {
      type: 'text-delta';
      textDelta: string;
    }
  | {
      type: 'reasoning';
      textDelta: string;
    }
  | {
      type: 'reasoning-signature';
      signature: string;
    }
  | {
      type: 'redacted-reasoning';
      data: string;
    }
  | {
      type: 'source';
      source: Source;
    }
  | ({
      type: 'tool-call';
    } & ToolCallUnion<TOOLS>)
  | {
      type: 'tool-call-streaming-start';
      toolCallId: string;
      toolName: string;
    }
  | {
      type: 'tool-call-delta';
      toolCallId: string;
      toolName: string;
      argsTextDelta: string;
    }
  | ({
      type: 'tool-result';
    } & ToolResultUnion<TOOLS>)
  | {
      type: 'step-start';
      messageId: string;
      request: LanguageModelRequestMetadata;
      warnings: CallWarning[];
    }
  | {
      type: 'step-finish';
      messageId: string;

      // TODO 5.0 breaking change: remove logprobs
      logprobs?: LogProbs;
      // TODO 5.0 breaking change: remove request (on start instead)
      request: LanguageModelRequestMetadata;
      // TODO 5.0 breaking change: remove warnings (on start instead)
      warnings: CallWarning[] | undefined;

      response: LanguageModelResponseMetadata;
      usage: LanguageModelUsage;
      finishReason: FinishReason;
      providerMetadata: ProviderMetadata | undefined;
      /**
       * @deprecated Use `providerMetadata` instead.
       */
      // TODO 5.0 breaking change: remove
      experimental_providerMetadata?: ProviderMetadata;
      isContinued: boolean;
    }
  | {
      type: 'finish';
      finishReason: FinishReason;
      usage: LanguageModelUsage;
      providerMetadata: ProviderMetadata | undefined;
      /**
       * @deprecated Use `providerMetadata` instead.
       */
      // TODO 5.0 breaking change: remove
      experimental_providerMetadata?: ProviderMetadata;

      /**
       * @deprecated will be moved into provider metadata
       */
      // TODO 5.0 breaking change: remove logprobs
      logprobs?: LogProbs;

      /**
       * @deprecated use response on step-finish instead
       */
      // TODO 5.0 breaking change: remove response (on step instead)
      response: LanguageModelResponseMetadata;
    }
  | {
      type: 'error';
      error: unknown;
    };
