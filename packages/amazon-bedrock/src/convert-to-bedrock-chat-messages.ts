import {
  BEDROCK_CACHE_POINT,
  BedrockAssistantMessage,
  BedrockCachePoint,
  BedrockDocumentFormat,
  BedrockImageFormat,
  BedrockMessages,
  BedrockSystemMessages,
  BedrockUserMessage,
} from './bedrock-api-types';
import {
  JSONObject,
  LanguageModelV1Message,
  LanguageModelV1Prompt,
  LanguageModelV1ProviderMetadata,
  UnsupportedFunctionalityError,
} from '@ai-sdk/provider';
import {
  convertUint8ArrayToBase64,
  createIdGenerator,
} from '@ai-sdk/provider-utils';

const generateFileId = createIdGenerator({ prefix: 'file', size: 16 });

function getCachePoint(
  providerMetadata: LanguageModelV1ProviderMetadata | undefined,
): BedrockCachePoint | undefined {
  return providerMetadata?.bedrock?.cachePoint as BedrockCachePoint | undefined;
}

export function convertToBedrockChatMessages(prompt: LanguageModelV1Prompt): {
  system: BedrockSystemMessages;
  messages: BedrockMessages;
} {
  const blocks = groupIntoBlocks(prompt);

  let system: BedrockSystemMessages = [];
  const messages: BedrockMessages = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const isLastBlock = i === blocks.length - 1;
    const type = block.type;

    switch (type) {
      case 'system': {
        if (messages.length > 0) {
          throw new UnsupportedFunctionalityError({
            functionality:
              'Multiple system messages that are separated by user/assistant messages',
          });
        }

        for (const message of block.messages) {
          system.push({ text: message.content });
          if (getCachePoint(message.providerMetadata)) {
            system.push(BEDROCK_CACHE_POINT);
          }
        }
        break;
      }

      case 'user': {
        // combines all user and tool messages in this block into a single message:
        const bedrockContent: BedrockUserMessage['content'] = [];

        for (const message of block.messages) {
          const { role, content, providerMetadata } = message;
          switch (role) {
            case 'user': {
              for (let j = 0; j < content.length; j++) {
                const part = content[j];

                switch (part.type) {
                  case 'text': {
                    bedrockContent.push({
                      text: part.text,
                    });
                    break;
                  }
                  case 'image': {
                    if (part.image instanceof URL) {
                      // The AI SDK automatically downloads images for user image parts with URLs
                      throw new UnsupportedFunctionalityError({
                        functionality: 'Image URLs in user messages',
                      });
                    }

                    bedrockContent.push({
                      image: {
                        format: part.mimeType?.split(
                          '/',
                        )?.[1] as BedrockImageFormat,
                        source: {
                          bytes: convertUint8ArrayToBase64(
                            part.image ?? (part.image as Uint8Array),
                          ),
                        },
                      },
                    });

                    break;
                  }
                  case 'file': {
                    if (part.data instanceof URL) {
                      // The AI SDK automatically downloads files for user file parts with URLs
                      throw new UnsupportedFunctionalityError({
                        functionality: 'File URLs in user messages',
                      });
                    }

                    bedrockContent.push({
                      document: {
                        format: part.mimeType?.split(
                          '/',
                        )?.[1] as BedrockDocumentFormat,
                        name: generateFileId(),
                        source: {
                          bytes: part.data,
                        },
                      },
                    });

                    break;
                  }
                }
              }

              break;
            }
            case 'tool': {
              for (let i = 0; i < content.length; i++) {
                const part = content[i];

                bedrockContent.push({
                  toolResult: {
                    toolUseId: part.toolCallId,
                    content: [{ text: JSON.stringify(part.result) }],
                  },
                });
              }

              break;
            }
            default: {
              const _exhaustiveCheck: never = role;
              throw new Error(`Unsupported role: ${_exhaustiveCheck}`);
            }
          }

          if (getCachePoint(providerMetadata)) {
            bedrockContent.push(BEDROCK_CACHE_POINT);
          }
        }

        messages.push({ role: 'user', content: bedrockContent });

        break;
      }

      case 'assistant': {
        // combines multiple assistant messages in this block into a single message:
        const bedrockContent: BedrockAssistantMessage['content'] = [];

        for (let j = 0; j < block.messages.length; j++) {
          const message = block.messages[j];
          const isLastMessage = j === block.messages.length - 1;
          const { content } = message;

          for (let k = 0; k < content.length; k++) {
            const part = content[k];
            const isLastContentPart = k === content.length - 1;

            switch (part.type) {
              case 'text': {
                bedrockContent.push({
                  text:
                    // trim the last text part if it's the last message in the block
                    // because Bedrock does not allow trailing whitespace
                    // in pre-filled assistant responses
                    isLastBlock && isLastMessage && isLastContentPart
                      ? part.text.trim()
                      : part.text,
                });
                break;
              }

              case 'reasoning': {
                bedrockContent.push({
                  reasoningContent: {
                    reasoningText: {
                      // trim the last text part if it's the last message in the block
                      // because Bedrock does not allow trailing whitespace
                      // in pre-filled assistant responses
                      text:
                        isLastBlock && isLastMessage && isLastContentPart
                          ? part.text.trim()
                          : part.text,
                      signature: part.signature,
                    },
                  },
                });
                break;
              }

              case 'redacted-reasoning': {
                bedrockContent.push({
                  reasoningContent: {
                    redactedReasoning: {
                      data: part.data,
                    },
                  },
                });
                break;
              }

              case 'tool-call': {
                bedrockContent.push({
                  toolUse: {
                    toolUseId: part.toolCallId,
                    name: part.toolName,
                    input: part.args as JSONObject,
                  },
                });
                break;
              }
            }
          }
          if (getCachePoint(message.providerMetadata)) {
            bedrockContent.push(BEDROCK_CACHE_POINT);
          }
        }

        messages.push({ role: 'assistant', content: bedrockContent });

        break;
      }

      default: {
        const _exhaustiveCheck: never = type;
        throw new Error(`Unsupported type: ${_exhaustiveCheck}`);
      }
    }
  }

  return { system, messages };
}

type SystemBlock = {
  type: 'system';
  messages: Array<LanguageModelV1Message & { role: 'system' }>;
};
type AssistantBlock = {
  type: 'assistant';
  messages: Array<LanguageModelV1Message & { role: 'assistant' }>;
};
type ThinkingBlock = {
  type: 'thinking';
  thinking: string;
  signature: string;
};
type UserBlock = {
  type: 'user';
  messages: Array<LanguageModelV1Message & { role: 'user' | 'tool' }>;
};

function groupIntoBlocks(
  prompt: LanguageModelV1Prompt,
): Array<SystemBlock | AssistantBlock | UserBlock> {
  const blocks: Array<SystemBlock | AssistantBlock | UserBlock> = [];
  let currentBlock: SystemBlock | AssistantBlock | UserBlock | undefined =
    undefined;

  for (const message of prompt) {
    const { role } = message;
    switch (role) {
      case 'system': {
        if (currentBlock?.type !== 'system') {
          currentBlock = { type: 'system', messages: [] };
          blocks.push(currentBlock);
        }

        currentBlock.messages.push(message);
        break;
      }
      case 'assistant': {
        if (currentBlock?.type !== 'assistant') {
          currentBlock = { type: 'assistant', messages: [] };
          blocks.push(currentBlock);
        }

        currentBlock.messages.push(message);
        break;
      }
      case 'user': {
        if (currentBlock?.type !== 'user') {
          currentBlock = { type: 'user', messages: [] };
          blocks.push(currentBlock);
        }

        currentBlock.messages.push(message);
        break;
      }
      case 'tool': {
        if (currentBlock?.type !== 'user') {
          currentBlock = { type: 'user', messages: [] };
          blocks.push(currentBlock);
        }

        currentBlock.messages.push(message);
        break;
      }
      default: {
        const _exhaustiveCheck: never = role;
        throw new Error(`Unsupported role: ${_exhaustiveCheck}`);
      }
    }
  }

  return blocks;
}
