import { LanguageModelV1, LanguageModelV1CallOptions } from '@ai-sdk/provider';
import { getLastUserMessageText } from './get-last-user-message-text';
import { injectIntoLastUserMessage as injectIntoLastUserMessageOriginal } from './inject-into-last-user-message';

export const inputTransformationModel = ({
  modelId,
  provider,
  baseModel,
  transformInput,
}: {
  modelId: string;
  provider: string;
  baseModel: LanguageModelV1;
  transformInput: ({
    parameters,
  }: {
    parameters: LanguageModelV1CallOptions;
    lastUserMessageText: string | undefined;
    injectIntoLastUserMessage: (options: {
      text: string;
    }) => LanguageModelV1CallOptions;
  }) => PromiseLike<LanguageModelV1CallOptions>;
}): LanguageModelV1 => ({
  specificationVersion: 'v1',
  provider,
  modelId,
  defaultObjectGenerationMode: baseModel.defaultObjectGenerationMode,

  async doGenerate(
    parameters: LanguageModelV1CallOptions,
  ): Promise<Awaited<ReturnType<LanguageModelV1['doGenerate']>>> {
    const lastUserMessageText = getLastUserMessageText({
      prompt: parameters.prompt,
    });

    const injectIntoLastUserMessage = (options: { text: string }) =>
      injectIntoLastUserMessageOriginal({
        text: options.text,
        parameters,
      });

    return baseModel.doGenerate(
      await transformInput({
        parameters,
        lastUserMessageText,
        injectIntoLastUserMessage,
      }),
    );
  },

  async doStream(
    parameters: LanguageModelV1CallOptions,
  ): Promise<Awaited<ReturnType<LanguageModelV1['doStream']>>> {
    const lastUserMessageText = getLastUserMessageText({
      prompt: parameters.prompt,
    });

    const injectIntoLastUserMessage = (options: { text: string }) =>
      injectIntoLastUserMessageOriginal({
        text: options.text,
        parameters,
      });

    return baseModel.doStream(
      await transformInput({
        parameters,
        lastUserMessageText,
        injectIntoLastUserMessage,
      }),
    );
  },
});
