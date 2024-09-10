import { JSONValue } from '@ai-sdk/provider';
import { createIdGenerator, safeParseJSON } from '@ai-sdk/provider-utils';
import { Schema } from '@ai-sdk/ui-utils';
import { z } from 'zod';
import { retryWithExponentialBackoff } from '../../util/retry-with-exponential-backoff';
import { CallSettings } from '../prompt/call-settings';
import { convertToLanguageModelPrompt } from '../prompt/convert-to-language-model-prompt';
import { prepareCallSettings } from '../prompt/prepare-call-settings';
import { Prompt } from '../prompt/prompt';
import { validatePrompt } from '../prompt/validate-prompt';
import { assembleOperationName } from '../telemetry/assemble-operation-name';
import { getBaseTelemetryAttributes } from '../telemetry/get-base-telemetry-attributes';
import { getTracer } from '../telemetry/get-tracer';
import { recordSpan } from '../telemetry/record-span';
import { selectTelemetryAttributes } from '../telemetry/select-telemetry-attributes';
import { TelemetrySettings } from '../telemetry/telemetry-settings';
import {
  CallWarning,
  FinishReason,
  LanguageModel,
  LanguageModelResponseMetadata,
  LogProbs,
  ProviderMetadata,
} from '../types';
import { calculateLanguageModelUsage } from '../types/usage';
import { prepareResponseHeaders } from '../util/prepare-response-headers';
import { GenerateObjectResult } from './generate-object-result';
import { injectJsonInstruction } from './inject-json-instruction';
import { NoObjectGeneratedError } from './no-object-generated-error';
import { getOutputStrategy } from './output-strategy';
import { validateObjectGenerationInput } from './validate-object-generation-input';

const originalGenerateId = createIdGenerator({ prefix: 'aiobj-', length: 24 });

/**
Generate a structured, typed object for a given prompt and schema using a language model.

This function does not stream the output. If you want to stream the output, use `streamObject` instead.

@returns
A result object that contains the generated object, the finish reason, the token usage, and additional information.
 */
export async function generateObject<OBJECT>(
  options: Omit<CallSettings, 'stopSequences'> &
    Prompt & {
      output?: 'object' | undefined;

      /**
The language model to use.
     */
      model: LanguageModel;

      /**
The schema of the object that the model should generate.
     */
      schema: z.Schema<OBJECT, z.ZodTypeDef, any> | Schema<OBJECT>;

      /**
Optional name of the output that should be generated.
Used by some providers for additional LLM guidance, e.g.
via tool or schema name.
     */
      schemaName?: string;

      /**
Optional description of the output that should be generated.
Used by some providers for additional LLM guidance, e.g.
via tool or schema description.
     */
      schemaDescription?: string;

      /**
The mode to use for object generation.

The schema is converted in a JSON schema and used in one of the following ways

- 'auto': The provider will choose the best mode for the model.
- 'tool': A tool with the JSON schema as parameters is is provided and the provider is instructed to use it.
- 'json': The JSON schema and an instruction is injected into the prompt. If the provider supports JSON mode, it is enabled. If the provider supports JSON grammars, the grammar is used.

Please note that most providers do not support all modes.

Default and recommended: 'auto' (best mode for the model).
     */
      mode?: 'auto' | 'json' | 'tool';

      /**
Optional telemetry configuration (experimental).
       */

      experimental_telemetry?: TelemetrySettings;

      /**
       * Internal. For test use only. May change without notice.
       */
      _internal?: {
        generateId?: () => string;
        currentDate?: () => Date;
      };
    },
): Promise<GenerateObjectResult<OBJECT>>;
/**
Generate an array with structured, typed elements for a given prompt and element schema using a language model.

This function does not stream the output. If you want to stream the output, use `streamObject` instead.

@return
A result object that contains the generated object, the finish reason, the token usage, and additional information.
 */
export async function generateObject<ELEMENT>(
  options: Omit<CallSettings, 'stopSequences'> &
    Prompt & {
      output: 'array';

      /**
The language model to use.
     */
      model: LanguageModel;

      /**
The element schema of the array that the model should generate.
 */
      schema: z.Schema<ELEMENT, z.ZodTypeDef, any> | Schema<ELEMENT>;

      /**
Optional name of the array that should be generated.
Used by some providers for additional LLM guidance, e.g.
via tool or schema name.
     */
      schemaName?: string;

      /**
Optional description of the array that should be generated.
Used by some providers for additional LLM guidance, e.g.
via tool or schema description.
 */
      schemaDescription?: string;

      /**
The mode to use for object generation.

The schema is converted in a JSON schema and used in one of the following ways

- 'auto': The provider will choose the best mode for the model.
- 'tool': A tool with the JSON schema as parameters is is provided and the provider is instructed to use it.
- 'json': The JSON schema and an instruction is injected into the prompt. If the provider supports JSON mode, it is enabled. If the provider supports JSON grammars, the grammar is used.

Please note that most providers do not support all modes.

Default and recommended: 'auto' (best mode for the model).
     */
      mode?: 'auto' | 'json' | 'tool';

      /**
Optional telemetry configuration (experimental).
     */
      experimental_telemetry?: TelemetrySettings;

      /**
       * Internal. For test use only. May change without notice.
       */
      _internal?: {
        generateId?: () => string;
        currentDate?: () => Date;
      };
    },
): Promise<GenerateObjectResult<Array<ELEMENT>>>;
/**
Generate a value from an enum (limited list of string values) using a language model.

This function does not stream the output.

@return
A result object that contains the generated value, the finish reason, the token usage, and additional information.
 */
export async function generateObject<ENUM extends string>(
  options: Omit<CallSettings, 'stopSequences'> &
    Prompt & {
      output: 'enum';

      /**
The language model to use.
     */
      model: LanguageModel;

      /**
The enum values that the model should use.
     */
      enum: Array<ENUM>;

      /**
The mode to use for object generation.

The schema is converted in a JSON schema and used in one of the following ways

- 'auto': The provider will choose the best mode for the model.
- 'tool': A tool with the JSON schema as parameters is is provided and the provider is instructed to use it.
- 'json': The JSON schema and an instruction is injected into the prompt. If the provider supports JSON mode, it is enabled. If the provider supports JSON grammars, the grammar is used.

Please note that most providers do not support all modes.

Default and recommended: 'auto' (best mode for the model).
     */
      mode?: 'auto' | 'json' | 'tool';

      /**
Optional telemetry configuration (experimental).
     */
      experimental_telemetry?: TelemetrySettings;

      /**
       * Internal. For test use only. May change without notice.
       */
      _internal?: {
        generateId?: () => string;
        currentDate?: () => Date;
      };
    },
): Promise<GenerateObjectResult<ENUM>>;
/**
Generate JSON with any schema for a given prompt using a language model.

This function does not stream the output. If you want to stream the output, use `streamObject` instead.

@returns
A result object that contains the generated object, the finish reason, the token usage, and additional information.
 */
export async function generateObject(
  options: Omit<CallSettings, 'stopSequences'> &
    Prompt & {
      output: 'no-schema';

      /**
The language model to use.
     */
      model: LanguageModel;

      /**
The mode to use for object generation. Must be "json" for no-schema output.
     */
      mode?: 'json';

      /**
Optional telemetry configuration (experimental).
       */
      experimental_telemetry?: TelemetrySettings;

      /**
       * Internal. For test use only. May change without notice.
       */
      _internal?: {
        generateId?: () => string;
        currentDate?: () => Date;
      };
    },
): Promise<GenerateObjectResult<JSONValue>>;
export async function generateObject<SCHEMA, RESULT>({
  model,
  enum: enumValues, // rename bc enum is reserved by typescript
  schema: inputSchema,
  schemaName,
  schemaDescription,
  mode,
  output = 'object',
  system,
  prompt,
  messages,
  maxRetries,
  abortSignal,
  headers,
  experimental_telemetry: telemetry,
  _internal: {
    generateId = originalGenerateId,
    currentDate = () => new Date(),
  } = {},
  ...settings
}: Omit<CallSettings, 'stopSequences'> &
  Prompt & {
    /**
     * The expected structure of the output.
     *
     * - 'object': Generate a single object that conforms to the schema.
     * - 'array': Generate an array of objects that conform to the schema.
     * - 'no-schema': Generate any JSON object. No schema is specified.
     *
     * Default is 'object' if not specified.
     */
    output?: 'object' | 'array' | 'enum' | 'no-schema';

    model: LanguageModel;
    enum?: Array<SCHEMA>;
    schema?: z.Schema<SCHEMA, z.ZodTypeDef, any> | Schema<SCHEMA>;
    schemaName?: string;
    schemaDescription?: string;
    mode?: 'auto' | 'json' | 'tool';
    experimental_telemetry?: TelemetrySettings;

    /**
     * Internal. For test use only. May change without notice.
     */
    _internal?: {
      generateId?: () => string;
      currentDate?: () => Date;
    };
  }): Promise<GenerateObjectResult<RESULT>> {
  validateObjectGenerationInput({
    output,
    mode,
    schema: inputSchema,
    schemaName,
    schemaDescription,
    enumValues,
  });

  const outputStrategy = getOutputStrategy({
    output,
    schema: inputSchema,
    enumValues,
  });

  // automatically set mode to 'json' for no-schema output
  if (outputStrategy.type === 'no-schema' && mode === undefined) {
    mode = 'json';
  }

  const baseTelemetryAttributes = getBaseTelemetryAttributes({
    model,
    telemetry,
    headers,
    settings: { ...settings, maxRetries },
  });

  const tracer = getTracer({ isEnabled: telemetry?.isEnabled ?? false });
  return recordSpan({
    name: 'ai.generateObject',
    attributes: selectTelemetryAttributes({
      telemetry,
      attributes: {
        ...assembleOperationName({
          operationId: 'ai.generateObject',
          telemetry,
        }),
        ...baseTelemetryAttributes,
        // specific settings that only make sense on the outer level:
        'ai.prompt': {
          input: () => JSON.stringify({ system, prompt, messages }),
        },
        'ai.schema':
          outputStrategy.jsonSchema != null
            ? { input: () => JSON.stringify(outputStrategy.jsonSchema) }
            : undefined,
        'ai.schema.name': schemaName,
        'ai.schema.description': schemaDescription,
        'ai.settings.output': outputStrategy.type,
        'ai.settings.mode': mode,
      },
    }),
    tracer,
    fn: async span => {
      const retry = retryWithExponentialBackoff({ maxRetries });

      // use the default provider mode when the mode is set to 'auto' or unspecified
      if (mode === 'auto' || mode == null) {
        mode = model.defaultObjectGenerationMode;
      }

      let result: string;
      let finishReason: FinishReason;
      let usage: Parameters<typeof calculateLanguageModelUsage>[0];
      let warnings: CallWarning[] | undefined;
      let rawResponse: { headers?: Record<string, string> } | undefined;
      let response: LanguageModelResponseMetadata;
      let logprobs: LogProbs | undefined;
      let providerMetadata: ProviderMetadata | undefined;

      switch (mode) {
        case 'json': {
          const validatedPrompt = validatePrompt({
            system:
              outputStrategy.jsonSchema == null
                ? injectJsonInstruction({ prompt: system })
                : model.supportsStructuredOutputs
                ? system
                : injectJsonInstruction({
                    prompt: system,
                    schema: outputStrategy.jsonSchema,
                  }),
            prompt,
            messages,
          });

          const promptMessages = await convertToLanguageModelPrompt({
            prompt: validatedPrompt,
            modelSupportsImageUrls: model.supportsImageUrls,
          });

          const inputFormat = validatedPrompt.type;

          const generateResult = await retry(() =>
            recordSpan({
              name: 'ai.generateObject.doGenerate',
              attributes: selectTelemetryAttributes({
                telemetry,
                attributes: {
                  ...assembleOperationName({
                    operationId: 'ai.generateObject.doGenerate',
                    telemetry,
                  }),
                  ...baseTelemetryAttributes,
                  'ai.prompt.format': {
                    input: () => inputFormat,
                  },
                  'ai.prompt.messages': {
                    input: () => JSON.stringify(promptMessages),
                  },
                  'ai.settings.mode': mode,

                  // standardized gen-ai llm span attributes:
                  'gen_ai.system': model.provider,
                  'gen_ai.request.model': model.modelId,
                  'gen_ai.request.frequency_penalty': settings.frequencyPenalty,
                  'gen_ai.request.max_tokens': settings.maxTokens,
                  'gen_ai.request.presence_penalty': settings.presencePenalty,
                  'gen_ai.request.temperature': settings.temperature,
                  'gen_ai.request.top_k': settings.topK,
                  'gen_ai.request.top_p': settings.topP,
                },
              }),
              tracer,
              fn: async span => {
                const result = await model.doGenerate({
                  mode: {
                    type: 'object-json',
                    schema: outputStrategy.jsonSchema,
                    name: schemaName,
                    description: schemaDescription,
                  },
                  ...prepareCallSettings(settings),
                  inputFormat,
                  prompt: promptMessages,
                  abortSignal,
                  headers,
                });

                if (result.text === undefined) {
                  throw new NoObjectGeneratedError();
                }

                const responseData = {
                  id: result.response?.id ?? generateId(),
                  timestamp: result.response?.timestamp ?? currentDate(),
                  modelId: result.response?.modelId ?? model.modelId,
                };

                // Add response information to the span:
                span.setAttributes(
                  selectTelemetryAttributes({
                    telemetry,
                    attributes: {
                      'ai.response.finishReason': result.finishReason,
                      'ai.response.object': { output: () => result.text },
                      'ai.response.id': responseData.id,
                      'ai.response.model': responseData.modelId,
                      'ai.response.timestamp':
                        responseData.timestamp.toISOString(),

                      'ai.usage.promptTokens': result.usage.promptTokens,
                      'ai.usage.completionTokens':
                        result.usage.completionTokens,

                      // deprecated:
                      'ai.finishReason': result.finishReason,
                      'ai.result.object': { output: () => result.text },

                      // standardized gen-ai llm span attributes:
                      'gen_ai.response.finish_reasons': [result.finishReason],
                      'gen_ai.response.id': responseData.id,
                      'gen_ai.response.model': responseData.modelId,
                      'gen_ai.usage.prompt_tokens': result.usage.promptTokens,
                      'gen_ai.usage.completion_tokens':
                        result.usage.completionTokens,
                    },
                  }),
                );

                return { ...result, objectText: result.text, responseData };
              },
            }),
          );

          result = generateResult.objectText;
          finishReason = generateResult.finishReason;
          usage = generateResult.usage;
          warnings = generateResult.warnings;
          rawResponse = generateResult.rawResponse;
          logprobs = generateResult.logprobs;
          providerMetadata = generateResult.providerMetadata;
          response = generateResult.responseData;

          break;
        }

        case 'tool': {
          const validatedPrompt = validatePrompt({
            system,
            prompt,
            messages,
          });

          const promptMessages = await convertToLanguageModelPrompt({
            prompt: validatedPrompt,
            modelSupportsImageUrls: model.supportsImageUrls,
          });
          const inputFormat = validatedPrompt.type;

          const generateResult = await retry(() =>
            recordSpan({
              name: 'ai.generateObject.doGenerate',
              attributes: selectTelemetryAttributes({
                telemetry,
                attributes: {
                  ...assembleOperationName({
                    operationId: 'ai.generateObject.doGenerate',
                    telemetry,
                  }),
                  ...baseTelemetryAttributes,
                  'ai.prompt.format': {
                    input: () => inputFormat,
                  },
                  'ai.prompt.messages': {
                    input: () => JSON.stringify(promptMessages),
                  },
                  'ai.settings.mode': mode,

                  // standardized gen-ai llm span attributes:
                  'gen_ai.system': model.provider,
                  'gen_ai.request.model': model.modelId,
                  'gen_ai.request.frequency_penalty': settings.frequencyPenalty,
                  'gen_ai.request.max_tokens': settings.maxTokens,
                  'gen_ai.request.presence_penalty': settings.presencePenalty,
                  'gen_ai.request.temperature': settings.temperature,
                  'gen_ai.request.top_k': settings.topK,
                  'gen_ai.request.top_p': settings.topP,
                },
              }),
              tracer,
              fn: async span => {
                const result = await model.doGenerate({
                  mode: {
                    type: 'object-tool',
                    tool: {
                      type: 'function',
                      name: schemaName ?? 'json',
                      description:
                        schemaDescription ?? 'Respond with a JSON object.',
                      parameters: outputStrategy.jsonSchema!,
                    },
                  },
                  ...prepareCallSettings(settings),
                  inputFormat,
                  prompt: promptMessages,
                  abortSignal,
                  headers,
                });

                const objectText = result.toolCalls?.[0]?.args;

                if (objectText === undefined) {
                  throw new NoObjectGeneratedError();
                }

                const responseData = {
                  id: result.response?.id ?? generateId(),
                  timestamp: result.response?.timestamp ?? currentDate(),
                  modelId: result.response?.modelId ?? model.modelId,
                };

                // Add response information to the span:
                span.setAttributes(
                  selectTelemetryAttributes({
                    telemetry,
                    attributes: {
                      'ai.response.finishReason': result.finishReason,
                      'ai.response.object': { output: () => objectText },
                      'ai.response.id': responseData.id,
                      'ai.response.model': responseData.modelId,
                      'ai.response.timestamp':
                        responseData.timestamp.toISOString(),

                      'ai.usage.promptTokens': result.usage.promptTokens,
                      'ai.usage.completionTokens':
                        result.usage.completionTokens,

                      // deprecated:
                      'ai.finishReason': result.finishReason,
                      'ai.result.object': { output: () => objectText },

                      // standardized gen-ai llm span attributes:
                      'gen_ai.response.finish_reasons': [result.finishReason],
                      'gen_ai.response.id': responseData.id,
                      'gen_ai.response.model': responseData.modelId,
                      'gen_ai.usage.input_tokens': result.usage.promptTokens,
                      'gen_ai.usage.output_tokens':
                        result.usage.completionTokens,
                    },
                  }),
                );

                return { ...result, objectText, responseData };
              },
            }),
          );

          result = generateResult.objectText;
          finishReason = generateResult.finishReason;
          usage = generateResult.usage;
          warnings = generateResult.warnings;
          rawResponse = generateResult.rawResponse;
          logprobs = generateResult.logprobs;
          providerMetadata = generateResult.providerMetadata;
          response = generateResult.responseData;

          break;
        }

        case undefined: {
          throw new Error(
            'Model does not have a default object generation mode.',
          );
        }

        default: {
          const _exhaustiveCheck: never = mode;
          throw new Error(`Unsupported mode: ${_exhaustiveCheck}`);
        }
      }

      const parseResult = safeParseJSON({ text: result });

      if (!parseResult.success) {
        throw parseResult.error;
      }

      const validationResult = outputStrategy.validateFinalResult(
        parseResult.value,
      );

      if (!validationResult.success) {
        throw validationResult.error;
      }

      // Add response information to the span:
      span.setAttributes(
        selectTelemetryAttributes({
          telemetry,
          attributes: {
            'ai.response.finishReason': finishReason,
            'ai.response.object': {
              output: () => JSON.stringify(validationResult.value),
            },

            'ai.usage.promptTokens': usage.promptTokens,
            'ai.usage.completionTokens': usage.completionTokens,

            // deprecated:
            'ai.finishReason': finishReason,
            'ai.result.object': {
              output: () => JSON.stringify(validationResult.value),
            },
          },
        }),
      );

      return new DefaultGenerateObjectResult({
        object: validationResult.value,
        finishReason,
        usage: calculateLanguageModelUsage(usage),
        warnings,
        response: {
          ...response,
          headers: rawResponse?.headers,
        },
        logprobs,
        providerMetadata,
      });
    },
  });
}

class DefaultGenerateObjectResult<T> implements GenerateObjectResult<T> {
  readonly object: GenerateObjectResult<T>['object'];
  readonly finishReason: GenerateObjectResult<T>['finishReason'];
  readonly usage: GenerateObjectResult<T>['usage'];
  readonly warnings: GenerateObjectResult<T>['warnings'];
  readonly rawResponse: GenerateObjectResult<T>['rawResponse'];
  readonly logprobs: GenerateObjectResult<T>['logprobs'];
  readonly experimental_providerMetadata: GenerateObjectResult<T>['experimental_providerMetadata'];
  readonly response: GenerateObjectResult<T>['response'];

  constructor(options: {
    object: GenerateObjectResult<T>['object'];
    finishReason: GenerateObjectResult<T>['finishReason'];
    usage: GenerateObjectResult<T>['usage'];
    warnings: GenerateObjectResult<T>['warnings'];
    logprobs: GenerateObjectResult<T>['logprobs'];
    providerMetadata: GenerateObjectResult<T>['experimental_providerMetadata'];
    response: GenerateObjectResult<T>['response'];
  }) {
    this.object = options.object;
    this.finishReason = options.finishReason;
    this.usage = options.usage;
    this.warnings = options.warnings;
    this.experimental_providerMetadata = options.providerMetadata;
    this.response = options.response;

    // deprecated:
    this.rawResponse = {
      headers: options.response.headers,
    };
    this.logprobs = options.logprobs;
  }

  toJsonResponse(init?: ResponseInit): Response {
    return new Response(JSON.stringify(this.object), {
      status: init?.status ?? 200,
      headers: prepareResponseHeaders(init, {
        contentType: 'application/json; charset=utf-8',
      }),
    });
  }
}

/**
 * @deprecated Use `generateObject` instead.
 */
export const experimental_generateObject = generateObject;
