import {
  APICallError,
  ImageModelV1,
  ImageModelV1CallWarning,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  extractResponseHeaders,
  FetchFunction,
  postJsonToApi,
  ResponseHandler,
} from '@ai-sdk/provider-utils';

// https://fireworks.ai/models?type=image
export type FireworksImageModelId =
  | 'accounts/fireworks/models/flux-1-dev-fp8'
  | 'accounts/fireworks/models/flux-1-schnell-fp8'
  | 'accounts/fireworks/models/playground-v2-5-1024px-aesthetic'
  | 'accounts/fireworks/models/japanese-stable-diffusion-xl'
  | 'accounts/fireworks/models/playground-v2-1024px-aesthetic'
  | 'accounts/fireworks/models/SSD-1B'
  | 'accounts/fireworks/models/stable-diffusion-xl-1024-v1-0'
  | (string & {});

interface FireworksImageModelBackendConfig {
  urlFormat: 'workflows' | 'image_generation';
  supportsSize?: boolean;
}

const modelToBackendConfig: Partial<
  Record<FireworksImageModelId, FireworksImageModelBackendConfig>
> = {
  'accounts/fireworks/models/flux-1-dev-fp8': {
    urlFormat: 'workflows',
  },
  'accounts/fireworks/models/flux-1-schnell-fp8': {
    urlFormat: 'workflows',
  },
  'accounts/fireworks/models/playground-v2-5-1024px-aesthetic': {
    urlFormat: 'image_generation',
    supportsSize: true,
  },
  'accounts/fireworks/models/japanese-stable-diffusion-xl': {
    urlFormat: 'image_generation',
    supportsSize: true,
  },
  'accounts/fireworks/models/playground-v2-1024px-aesthetic': {
    urlFormat: 'image_generation',
    supportsSize: true,
  },
  'accounts/fireworks/models/stable-diffusion-xl-1024-v1-0': {
    urlFormat: 'image_generation',
    supportsSize: true,
  },
  'accounts/fireworks/models/SSD-1B': {
    urlFormat: 'image_generation',
    supportsSize: true,
  },
};

function getUrlForModel(
  baseUrl: string,
  modelId: FireworksImageModelId,
): string {
  switch (modelToBackendConfig[modelId]?.urlFormat) {
    case 'image_generation':
      return `${baseUrl}/image_generation/${modelId}`;
    case 'workflows':
    default:
      return `${baseUrl}/workflows/${modelId}/text_to_image`;
  }
}

interface FireworksImageModelConfig {
  provider: string;
  baseURL: string;
  headers: () => Record<string, string>;
  fetch?: FetchFunction;
}

const createBinaryResponseHandler =
  (): ResponseHandler<ArrayBuffer> =>
  async ({ response, url, requestBodyValues }) => {
    const responseHeaders = extractResponseHeaders(response);

    if (!response.body) {
      throw new APICallError({
        message: 'Response body is empty',
        url,
        requestBodyValues,
        statusCode: response.status,
        responseHeaders,
        responseBody: undefined,
      });
    }

    try {
      const buffer = await response.arrayBuffer();
      return {
        responseHeaders,
        value: buffer,
      };
    } catch (error) {
      throw new APICallError({
        message: 'Failed to read response as array buffer',
        url,
        requestBodyValues,
        statusCode: response.status,
        responseHeaders,
        responseBody: undefined,
        cause: error,
      });
    }
  };

const statusCodeErrorResponseHandler: ResponseHandler<APICallError> = async ({
  response,
  url,
  requestBodyValues,
}) => {
  const responseHeaders = extractResponseHeaders(response);
  const responseBody = await response.text();

  return {
    responseHeaders,
    value: new APICallError({
      message: response.statusText,
      url,
      requestBodyValues: requestBodyValues as Record<string, unknown>,
      statusCode: response.status,
      responseHeaders,
      responseBody,
    }),
  };
};

interface ImageRequestParams {
  baseUrl: string;
  modelId: FireworksImageModelId;
  prompt: string;
  aspectRatio?: string;
  size?: string;
  seed?: number;
  providerOptions: Record<string, unknown>;
  headers: Record<string, string | undefined>;
  abortSignal?: AbortSignal;
  fetch?: FetchFunction;
}

async function postImageToApi(
  params: ImageRequestParams,
): Promise<ArrayBuffer> {
  const splitSize = params.size?.split('x');
  const { value: response } = await postJsonToApi({
    url: getUrlForModel(params.baseUrl, params.modelId),
    headers: params.headers,
    body: {
      prompt: params.prompt,
      aspect_ratio: params.aspectRatio,
      seed: params.seed,
      ...(splitSize && { width: splitSize[0], height: splitSize[1] }),
      ...(params.providerOptions.fireworks ?? {}),
    },
    failedResponseHandler: statusCodeErrorResponseHandler,
    successfulResponseHandler: createBinaryResponseHandler(),
    abortSignal: params.abortSignal,
    fetch: params.fetch,
  });

  return response;
}

export class FireworksImageModel implements ImageModelV1 {
  readonly specificationVersion = 'v1';

  get provider(): string {
    return this.config.provider;
  }

  readonly maxImagesPerCall = 1;

  constructor(
    readonly modelId: FireworksImageModelId,
    private config: FireworksImageModelConfig,
  ) {}

  async doGenerate({
    prompt,
    n,
    size,
    aspectRatio,
    seed,
    providerOptions,
    headers,
    abortSignal,
  }: Parameters<ImageModelV1['doGenerate']>[0]): Promise<
    Awaited<ReturnType<ImageModelV1['doGenerate']>>
  > {
    const warnings: Array<ImageModelV1CallWarning> = [];

    const backendConfig = modelToBackendConfig[this.modelId];
    if (!backendConfig?.supportsSize && size != null) {
      warnings.push({
        type: 'unsupported-setting',
        setting: 'size',
        details:
          'This model does not support the `size` option. Use `aspectRatio` instead.',
      });
    }

    // Use supportsSize as a proxy for whether the model does not support
    // aspectRatio. This invariant holds for the current set of models.
    if (backendConfig?.supportsSize && aspectRatio != null) {
      warnings.push({
        type: 'unsupported-setting',
        setting: 'aspectRatio',
        details: 'This model does not support the `aspectRatio` option.',
      });
    }

    const response = await postImageToApi({
      baseUrl: this.config.baseURL,
      prompt,
      aspectRatio,
      size,
      seed,
      modelId: this.modelId,
      providerOptions,
      headers: combineHeaders(this.config.headers(), headers),
      abortSignal,
      fetch: this.config.fetch,
    });

    return { images: [new Uint8Array(response)], warnings };
  }
}
