// D:\Projects\Kalwanga\packages\backend\src\middleware\validateRequest.ts

import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';

export const validateRequest = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if schema expects wrapper (body, query, params) or just body
      const schemaShape = (schema as any).shape || {};
      const expectsWrapper = 'body' in schemaShape || 'query' in schemaShape || 'params' in schemaShape;
      
      if (expectsWrapper) {
        // Schema expects { body, query, params } structure
        await schema.parseAsync({
          body: req.body,
          query: req.query,
          params: req.params,
        });
      } else {
        // Schema expects just the body
        await schema.parseAsync(req.body);
      }
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
};
