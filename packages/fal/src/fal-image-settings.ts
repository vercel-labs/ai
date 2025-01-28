export type FalImageModelId =
  | 'fal-ai/aura-flow'
  | 'fal-ai/aura-sr'
  | 'fal-ai/bria/eraser'
  | 'fal-ai/bria/product-shot'
  | 'fal-ai/bria/text-to-image/base'
  | 'fal-ai/bria/text-to-image/fast'
  | 'fal-ai/bria/text-to-image/hd'
  | 'fal-ai/bria/text-to-image/turbo'
  | 'fal-ai/ccsr'
  | 'fal-ai/clarity-upscaler'
  | 'fal-ai/creative-upscaler'
  | 'fal-ai/esrgan'
  | 'fal-ai/fast-sdxl'
  | 'fal-ai/flux-general'
  | 'fal-ai/flux-general/differential-diffusion'
  | 'fal-ai/flux-general/image-to-image'
  | 'fal-ai/flux-general/inpainting'
  | 'fal-ai/flux-general/rf-inversion'
  | 'fal-ai/flux-lora'
  | 'fal-ai/flux-lora/image-to-image'
  | 'fal-ai/flux-lora/inpainting'
  | 'fal-ai/flux-pro/v1.1'
  | 'fal-ai/flux-pro/v1.1-ultra'
  | 'fal-ai/flux-pro/v1.1-ultra-finetuned'
  | 'fal-ai/flux-pro/v1.1-ultra/redux'
  | 'fal-ai/flux-pro/v1.1/redux'
  | 'fal-ai/flux/dev'
  | 'fal-ai/flux/dev/image-to-image'
  | 'fal-ai/flux/dev/redux'
  | 'fal-ai/flux/schnell'
  | 'fal-ai/flux/schnell/redux'
  | 'fal-ai/hyper-sdxl'
  | 'fal-ai/ideogram/v2'
  | 'fal-ai/ideogram/v2/remix'
  | 'fal-ai/ideogram/v2/turbo'
  | 'fal-ai/ideogram/v2/turbo/edit'
  | 'fal-ai/ideogram/v2/turbo/remix'
  | 'fal-ai/janus'
  | 'fal-ai/luma-photon'
  | 'fal-ai/luma-photon/flash'
  | 'fal-ai/omnigen-v1'
  | 'fal-ai/playground-v25'
  | 'fal-ai/recraft-20b'
  | 'fal-ai/recraft-v3'
  | 'fal-ai/sana'
  | 'fal-ai/stable-cascade'
  | 'fal-ai/stable-diffusion-3.5-large'
  | 'fal-ai/stable-diffusion-3.5-medium'
  | 'fashn/tryon'
  | (string & {});

export type FalImageSize =
  | 'square'
  | 'square_hd'
  | 'landscape_16_9'
  | 'landscape_4_3'
  | 'portrait_16_9'
  | 'portrait_4_3'
  | {
      width: number;
      height: number;
    };

export interface FalImageSettings {
  /**
   * Override the maximum number of images per call (default 1)
   */
  maxImagesPerCall?: number;
}
