export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export enum ProcessingStatus {
  IDLE = 'idle',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  ERROR = 'error',
}

export interface SignatureItem {
  id: string;
  originalRect: Rect; // Coordinates relative to the displayed image container
  previewUrl: string; // The transparent PNG blob URL
  fileName: string; // Recognized name
  status: ProcessingStatus;
}

export type AIProvider = 'zhipu' | 'aliyun';