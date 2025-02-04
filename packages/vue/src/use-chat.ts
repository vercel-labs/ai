import type {
  ChatRequestOptions,
  CreateMessage,
  JSONValue,
  Message,
  UIMessage,
  UseChatOptions,
} from '@ai-sdk/ui-utils';
import {
  callChatApi,
  extractMaxToolInvocationStep,
  fillMessageParts,
  generateId as generateIdFunc,
  getMessageParts,
  isAssistantMessageWithCompletedToolCalls,
  prepareAttachmentsForRequest,
  shouldResubmitMessages,
  updateToolCallResult,
} from '@ai-sdk/ui-utils';
import swrv from 'swrv';
import type { Ref } from 'vue';
import { ref, unref } from 'vue';

export type { CreateMessage, Message, UIMessage, UseChatOptions };

export type UseChatHelpers = {
  /** Current messages in the chat */
  messages: Ref<UIMessage[]>;
  /** The error object of the API request */
  error: Ref<undefined | Error>;
  /**
   * Append a user message to the chat list. This triggers the API call to fetch
   * the assistant's response.
   */
  append: (
    message: Message | CreateMessage,
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
  /**
   * Reload the last AI chat response for the given chat history. If the last
   * message isn't from the assistant, it will request the API to generate a
   * new response.
   */
  reload: (
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
  /**
   * Abort the current request immediately, keep the generated tokens if any.
   */
  stop: () => void;
  /**
   * Update the `messages` state locally. This is useful when you want to
   * edit the messages on the client, and then trigger the `reload` method
   * manually to regenerate the AI response.
   */
  setMessages: (
    messages: Message[] | ((messages: Message[]) => Message[]),
  ) => void;
  /** The current value of the input */
  input: Ref<string>;
  /** Form submission handler to automatically reset input and append a user message  */
  handleSubmit: (
    event?: { preventDefault?: () => void },
    chatRequestOptions?: ChatRequestOptions,
  ) => void;
  /** Whether the API request is in progress */
  isLoading: Ref<boolean | undefined>;

  /** Additional data added on the server via StreamData. */
  data: Ref<JSONValue[] | undefined>;
  /** Set the data of the chat. You can use this to transform or clear the chat data. */
  setData: (
    data:
      | JSONValue[]
      | undefined
      | ((data: JSONValue[] | undefined) => JSONValue[] | undefined),
  ) => void;

  addToolResult: ({
    toolCallId,
    result,
  }: {
    toolCallId: string;
    result: any;
  }) => void;

  /** The id of the chat */
  id: string;
};

// @ts-expect-error - some issues with the default export of useSWRV
const useSWRV = (swrv.default as typeof import('swrv')['default']) || swrv;
const store: Record<string, UIMessage[] | undefined> = {};

export function useChat(
  {
    api = '/api/chat',
    id,
    initialMessages = [],
    initialInput = '',
    sendExtraMessageFields,
    streamProtocol = 'data',
    onResponse,
    onFinish,
    onError,
    credentials,
    headers: metadataHeaders,
    body: metadataBody,
    generateId = generateIdFunc,
    onToolCall,
    fetch,
    keepLastMessageOnError = true,
    maxSteps = 1,
  }: UseChatOptions & {
    /**
     * Maximum number of sequential LLM calls (steps), e.g. when you use tool calls. Must be at least 1.
     * A maximum number is required to prevent infinite loops in the case of misconfigured tools.
     * By default, it's set to 1, which means that only a single LLM call is made.
     */
    maxSteps?: number;
  } = {
    maxSteps: 1,
  },
): UseChatHelpers {
  // Generate a unique ID for the chat if not provided.
  const chatId = id ?? generateId();

  const key = `${api}|${chatId}`;
  const { data: messagesData, mutate: originalMutate } = useSWRV<UIMessage[]>(
    key,
    () => store[key] ?? fillMessageParts(initialMessages),
  );

  const { data: isLoading, mutate: mutateLoading } = useSWRV<boolean>(
    `${chatId}-loading`,
    null,
  );

  isLoading.value ??= false;

  // Force the `data` to be `initialMessages` if it's `undefined`.
  messagesData.value ??= fillMessageParts(initialMessages);

  const mutate = (data?: UIMessage[]) => {
    store[key] = data;
    return originalMutate();
  };

  // Because of the `initialData` option, the `data` will never be `undefined`.
  const messages = messagesData as Ref<UIMessage[]>;

  const error = ref<undefined | Error>(undefined);
  // cannot use JSONValue[] in ref because of infinite Typescript recursion:
  const streamData = ref<undefined | unknown[]>(undefined);

  let abortController: AbortController | null = null;

  async function triggerRequest(
    messagesSnapshot: Message[],
    { data, headers, body }: ChatRequestOptions = {},
  ) {
    const messageCount = messages.value.length;
    const maxStep = extractMaxToolInvocationStep(
      messages.value[messages.value.length - 1]?.toolInvocations,
    );

    try {
      error.value = undefined;
      mutateLoading(() => true);

      abortController = new AbortController();

      // Do an optimistic update to the chat state to show the updated messages
      // immediately.
      const previousMessages = fillMessageParts(messagesSnapshot);
      const chatMessages = fillMessageParts(messagesSnapshot);
      mutate(chatMessages);

      const existingData = (streamData.value ?? []) as JSONValue[];

      const constructedMessagesPayload = sendExtraMessageFields
        ? chatMessages
        : chatMessages.map(
            ({
              role,
              content,
              experimental_attachments,
              data,
              annotations,
              toolInvocations,
            }) => ({
              role,
              content,
              ...(experimental_attachments !== undefined && {
                experimental_attachments,
              }),
              ...(data !== undefined && { data }),
              ...(annotations !== undefined && { annotations }),
              ...(toolInvocations !== undefined && { toolInvocations }),
            }),
          );

      await callChatApi({
        api,
        body: {
          id: chatId,
          messages: constructedMessagesPayload,
          data,
          ...unref(metadataBody), // Use unref to unwrap the ref value
          ...body,
        },
        streamProtocol,
        headers: {
          ...metadataHeaders,
          ...headers,
        },
        abortController: () => abortController,
        credentials,
        onResponse,
        onUpdate({ message, data, replaceLastMessage }) {
          mutate([
            ...(replaceLastMessage
              ? chatMessages.slice(0, chatMessages.length - 1)
              : chatMessages),
            message,
          ]);
          if (data?.length) {
            streamData.value = [...existingData, ...data];
          }
        },
        onFinish,
        restoreMessagesOnFailure() {
          // Restore the previous messages if the request fails.
          if (!keepLastMessageOnError) {
            mutate(previousMessages);
          }
        },
        generateId,
        onToolCall,
        fetch,
        lastMessage: chatMessages[chatMessages.length - 1],
      });
    } catch (err) {
      // Ignore abort errors as they are expected.
      if ((err as any).name === 'AbortError') {
        abortController = null;
        return null;
      }

      if (onError && err instanceof Error) {
        onError(err);
      }

      error.value = err as Error;
    } finally {
      abortController = null;
      mutateLoading(() => false);
    }

    // auto-submit when all tool calls in the last assistant message have results:
    if (
      shouldResubmitMessages({
        originalMaxToolInvocationStep: maxStep,
        originalMessageCount: messageCount,
        maxSteps,
        messages: messages.value,
      })
    ) {
      await triggerRequest(messages.value);
    }
  }

  const append: UseChatHelpers['append'] = async (message, options) => {
    const attachmentsForRequest = await prepareAttachmentsForRequest(
      options?.experimental_attachments,
    );

    return triggerRequest(
      messages.value.concat({
        ...message,
        id: message.id ?? generateId(),
        createdAt: message.createdAt ?? new Date(),
        experimental_attachments:
          attachmentsForRequest.length > 0 ? attachmentsForRequest : undefined,
        parts: getMessageParts(message),
      }),
      options,
    );
  };

  const reload: UseChatHelpers['reload'] = async options => {
    const messagesSnapshot = messages.value;
    if (messagesSnapshot.length === 0) return null;

    const lastMessage = messagesSnapshot[messagesSnapshot.length - 1];
    if (lastMessage.role === 'assistant') {
      return triggerRequest(messagesSnapshot.slice(0, -1), options);
    }

    return triggerRequest(messagesSnapshot, options);
  };

  const stop = () => {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  };

  const setMessages = (
    messagesArg: Message[] | ((messages: Message[]) => Message[]),
  ) => {
    if (typeof messagesArg === 'function') {
      messagesArg = messagesArg(messages.value);
    }

    mutate(fillMessageParts(messagesArg));
  };

  const setData = (
    dataArg:
      | JSONValue[]
      | undefined
      | ((data: JSONValue[] | undefined) => JSONValue[] | undefined),
  ) => {
    if (typeof dataArg === 'function') {
      dataArg = dataArg(streamData.value as JSONValue[] | undefined);
    }

    streamData.value = dataArg;
  };

  const input = ref(initialInput);

  const handleSubmit = async (
    event?: { preventDefault?: () => void },
    options: ChatRequestOptions = {},
  ) => {
    event?.preventDefault?.();

    const inputValue = input.value;

    if (!inputValue && !options.allowEmptySubmit) return;

    const attachmentsForRequest = await prepareAttachmentsForRequest(
      options.experimental_attachments,
    );

    triggerRequest(
      messages.value.concat({
        id: generateId(),
        createdAt: new Date(),
        content: inputValue,
        role: 'user',
        experimental_attachments:
          attachmentsForRequest.length > 0 ? attachmentsForRequest : undefined,
        parts: [{ type: 'text', text: inputValue }],
      }),
      options,
    );

    input.value = '';
  };

  const addToolResult = ({
    toolCallId,
    result,
  }: {
    toolCallId: string;
    result: unknown;
  }) => {
    const currentMessages = messages.value;

    updateToolCallResult({
      messages: currentMessages,
      toolCallId,
      toolResult: result,
    });

    mutate(currentMessages);

    // auto-submit when all tool calls in the last assistant message have results:
    const lastMessage = currentMessages[currentMessages.length - 1];
    if (isAssistantMessageWithCompletedToolCalls(lastMessage)) {
      triggerRequest(currentMessages);
    }
  };

  return {
    id: chatId,
    messages,
    append,
    error,
    reload,
    stop,
    setMessages,
    input,
    handleSubmit,
    isLoading,
    data: streamData as Ref<undefined | JSONValue[]>,
    setData,
    addToolResult,
  };
}
