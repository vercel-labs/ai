import { BinaryTestServer } from '@ai-sdk/provider-utils/test';
import { describe, expect, it } from 'vitest';
import { FireworksImageModel } from './fireworks-image-model';
import { FetchFunction } from '@ai-sdk/provider-utils';

const prompt = 'A cute baby sea otter';

function createBasicModel({
  headers,
  fetch,
}: {
  headers?: () => Record<string, string>;
  fetch?: FetchFunction;
} = {}) {
  return new FireworksImageModel('accounts/fireworks/models/flux-1-dev-fp8', {
    provider: 'fireworks',
    baseURL: 'https://api.example.com',
    headers: headers ?? (() => ({ 'api-key': 'test-key' })),
    fetch,
  });
}

function createSizeModel() {
  return new FireworksImageModel(
    'accounts/fireworks/models/playground-v2-5-1024px-aesthetic',
    {
      provider: 'fireworks',
      baseURL: 'https://api.size-example.com',
      headers: () => ({ 'api-key': 'test-key' }),
    },
  );
}

function createStabilityModel() {
  return new FireworksImageModel('accounts/stability/models/sd3', {
    provider: 'fireworks',
    baseURL: 'https://api.stability.ai',
    headers: () => ({ 'api-key': 'test-key' }),
  });
}

const basicUrl =
  'https://api.example.com/workflows/accounts/fireworks/models/flux-1-dev-fp8/text_to_image';
const sizeUrl =
  'https://api.size-example.com/image_generation/accounts/fireworks/models/playground-v2-5-1024px-aesthetic';
const stabilityUrl =
  'https://api.stability.ai/v2beta/stable-image/generate/sd3';

describe('FireworksImageModel', () => {
  describe('doGenerate', () => {
    const server = new BinaryTestServer([basicUrl, sizeUrl, stabilityUrl]);
    server.setupTestEnvironment();

    function prepareBinaryResponse(url: string) {
      const mockImageBuffer = Buffer.from('mock-image-data');
      server.setResponseFor(url, { body: mockImageBuffer });
    }

    it('should pass the correct parameters including aspect ratio and seed', async () => {
      prepareBinaryResponse(basicUrl);

      const model = createBasicModel();
      await model.doGenerate({
        prompt,
        n: 1,
        size: undefined,
        aspectRatio: '16:9',
        seed: 42,
        providerOptions: { fireworks: { additional_param: 'value' } },
      });

      const request = await server.getRequestDataFor(basicUrl);
      expect(await request.bodyJson()).toStrictEqual({
        prompt,
        aspect_ratio: '16:9',
        seed: 42,
        additional_param: 'value',
      });
    });

    it('should pass headers', async () => {
      prepareBinaryResponse(basicUrl);

      const modelWithHeaders = createBasicModel({
        headers: () => ({
          'Custom-Provider-Header': 'provider-header-value',
        }),
      });

      await modelWithHeaders.doGenerate({
        prompt,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
        headers: {
          'Custom-Request-Header': 'request-header-value',
        },
      });

      const request = await server.getRequestDataFor(basicUrl);
      expect(request.headers()).toStrictEqual({
        'content-type': 'application/json',
        'custom-provider-header': 'provider-header-value',
        'custom-request-header': 'request-header-value',
      });
    });

    it('should handle empty response body', async () => {
      server.setResponseFor(basicUrl, { body: null });

      const model = createBasicModel();
      await expect(
        model.doGenerate({
          prompt,
          n: 1,
          size: undefined,
          aspectRatio: undefined,
          seed: undefined,
          providerOptions: {},
        }),
      ).rejects.toMatchObject({
        message: 'Response body is empty',
        statusCode: 200,
        url: basicUrl,
        requestBodyValues: {
          prompt: 'A cute baby sea otter',
        },
      });
    });

    it('should handle API errors', async () => {
      server.setResponseFor(basicUrl, {
        status: 400,
        body: Buffer.from('Bad Request'),
      });

      const model = createBasicModel();
      await expect(
        model.doGenerate({
          prompt,
          n: 1,
          size: undefined,
          aspectRatio: undefined,
          seed: undefined,
          providerOptions: {},
        }),
      ).rejects.toMatchObject({
        message: 'Bad Request',
        statusCode: 400,
        url: basicUrl,
        requestBodyValues: {
          prompt: 'A cute baby sea otter',
        },
        responseBody: 'Bad Request',
      });
    });

    it('should handle size parameter for supported models', async () => {
      prepareBinaryResponse(sizeUrl);

      const sizeModel = createSizeModel();

      await sizeModel.doGenerate({
        prompt,
        n: 1,
        size: '1024x768',
        aspectRatio: undefined,
        seed: 42,
        providerOptions: {},
      });

      const request = await server.getRequestDataFor(sizeUrl);
      expect(await request.bodyJson()).toStrictEqual({
        prompt,
        width: '1024',
        height: '768',
        seed: 42,
      });
    });

    it('should return appropriate warnings based on model capabilities', async () => {
      prepareBinaryResponse(basicUrl);

      // Test workflow model (supports aspectRatio but not size)
      const model = createBasicModel();
      const result1 = await model.doGenerate({
        prompt,
        n: 1,
        size: '1024x1024',
        aspectRatio: '1:1',
        seed: 123,
        providerOptions: {},
      });

      expect(result1.warnings).toContainEqual({
        type: 'unsupported-setting',
        setting: 'size',
        details:
          'This model does not support the `size` option. Use `aspectRatio` instead.',
      });

      // Test size-supporting model
      prepareBinaryResponse(sizeUrl);
      const sizeModel = createSizeModel();

      const result2 = await sizeModel.doGenerate({
        prompt,
        n: 1,
        size: '1024x1024',
        aspectRatio: '1:1',
        seed: 123,
        providerOptions: {},
      });

      expect(result2.warnings).toContainEqual({
        type: 'unsupported-setting',
        setting: 'aspectRatio',
        details: 'This model does not support the `aspectRatio` option.',
      });
    });

    it('should respect the abort signal', async () => {
      prepareBinaryResponse(basicUrl);
      const model = createBasicModel();
      const controller = new AbortController();

      const generatePromise = model.doGenerate({
        prompt,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
        abortSignal: controller.signal,
      });

      controller.abort();

      await expect(generatePromise).rejects.toThrow(
        'This operation was aborted',
      );
    });

    it('should use custom fetch function when provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(Buffer.from('mock-image-data'), {
          status: 200,
        }),
      );

      const model = createBasicModel({
        fetch: mockFetch,
      });

      await model.doGenerate({
        prompt,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        providerOptions: {},
      });

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('constructor', () => {
    it('should expose correct provider and model information', () => {
      const model = createBasicModel();

      expect(model.provider).toBe('fireworks');
      expect(model.modelId).toBe('accounts/fireworks/models/flux-1-dev-fp8');
      expect(model.specificationVersion).toBe('v1');
      expect(model.maxImagesPerCall).toBe(1);
    });
  });
});
