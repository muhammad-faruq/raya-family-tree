declare module "cropperjs" {
  interface CropperOptions {
    aspectRatio?: number;
    viewMode?: number;
    dragMode?: string;
    autoCropArea?: number;
    [key: string]: unknown;
  }

  export default class Cropper {
    constructor(element: HTMLImageElement, options?: CropperOptions);
    destroy(): void;
    getCroppedCanvas(options?: {
      width?: number;
      height?: number;
      imageSmoothingQuality?: string;
    }): HTMLCanvasElement;
  }
}
