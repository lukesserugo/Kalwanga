// src/types/multer.d.ts
declare module 'multer' {
  import { Request } from 'express';
  import { Readable } from 'stream';

  namespace multer {
    interface File {
      fieldname: string;
      originalname: string;
      encoding: string;
      mimetype: string;
      size: number;
      destination?: string;
      filename?: string;
      path?: string;
      buffer?: Buffer;
      stream?: Readable;
    }

    interface MulterOptions {
      dest?: string;
      storage?: StorageEngine;
      limits?: {
        fieldNameSize?: number;
        fieldSize?: number;
        fields?: number;
        fileSize?: number;
        files?: number;
        parts?: number;
        headerPairs?: number;
      };
      fileFilter?: (
        req: Request,
        file: File,
        callback: (error: Error | null, acceptFile: boolean) => void
      ) => void;
      preservePath?: boolean;
    }

    interface StorageEngine {
      _handleFile(
        req: Request,
        file: File,
        callback: (error?: Error | null, info?: Partial<File>) => void
      ): void;
      _removeFile(
        req: Request,
        file: File,
        callback: (error: Error | null) => void
      ): void;
    }

    interface DiskStorageOptions {
      destination?: string | ((req: Request, file: File, callback: (error: Error | null, destination: string) => void) => void);
      filename?: (req: Request, file: File, callback: (error: Error | null, filename: string) => void) => void;
    }

    interface MemoryStorageOptions {}

    interface Multer {
      (options?: MulterOptions): any;
      diskStorage(options: DiskStorageOptions): StorageEngine;
      memoryStorage(options?: MemoryStorageOptions): StorageEngine;
      single(fieldname: string): any;
      array(fieldname: string, maxCount?: number): any;
      fields(fields: Array<{ name: string; maxCount?: number }>): any;
      none(): any;
      any(): any;
    }
  }

  const multer: multer.Multer;
  export = multer;
}
