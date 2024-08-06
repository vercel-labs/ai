import { AISDKError } from './ai-sdk-error';

const marker = 'vercel.ai.error.invalid-prompt-error';
const symbol = Symbol.for(marker);

/**
 * A prompt is invalid. This error should be thrown by providers when they cannot
 * process a prompt.
 */
export class InvalidPromptError extends AISDKError {
  private readonly [symbol] = true; // used in isInstance

  readonly prompt: unknown;

  constructor({ prompt, message }: { prompt: unknown; message: string }) {
    super({
      name: 'AI_InvalidPromptError',
      message: `Invalid prompt: ${message}`,
    });

    this.prompt = prompt;
  }

  static isInstance(error: unknown): error is InvalidPromptError {
    return AISDKError.hasMarker(error, marker);
  }

  /**
   * @deprecated use `isInstance` instead
   */
  static isInvalidPromptError(error: unknown): error is InvalidPromptError {
    return (
      error instanceof Error &&
      error.name === 'AI_InvalidPromptError' &&
      prompt != null
    );
  }

  /**
   * @deprecated Do not use this method. It will be removed in the next major version.
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      stack: this.stack,

      prompt: this.prompt,
    };
  }
}
