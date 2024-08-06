import { AISDKError } from './ai-sdk-error';

const marker = 'vercel.ai.error.download-error';
const symbol = Symbol.for(marker);

// TODO move to ai package
export class DownloadError extends AISDKError {
  private readonly [symbol] = true; // used in isInstance

  readonly url: string;
  readonly statusCode?: number;
  readonly statusText?: string;

  constructor({
    url,
    statusCode,
    statusText,
    cause,
    message = cause == null
      ? `Failed to download ${url}: ${statusCode} ${statusText}`
      : `Failed to download ${url}: ${cause}`,
  }: {
    url: string;
    statusCode?: number;
    statusText?: string;
    message?: string;
    cause?: unknown;
  }) {
    super({
      name: 'AI_DownloadError',
      message,
      cause,
    });

    this.url = url;
    this.statusCode = statusCode;
    this.statusText = statusText;
  }

  static isInstance(error: unknown): error is DownloadError {
    return AISDKError.hasMarker(error, marker);
  }

  /**
   * @deprecated use `isInstance` instead
   */
  static isDownloadError(error: unknown): error is DownloadError {
    return (
      error instanceof Error &&
      error.name === 'AI_DownloadError' &&
      typeof (error as DownloadError).url === 'string' &&
      ((error as DownloadError).statusCode == null ||
        typeof (error as DownloadError).statusCode === 'number') &&
      ((error as DownloadError).statusText == null ||
        typeof (error as DownloadError).statusText === 'string')
    );
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      url: this.url,
      statusCode: this.statusCode,
      statusText: this.statusText,
      cause: this.cause,
    };
  }
}
