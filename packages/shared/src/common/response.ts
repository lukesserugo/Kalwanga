import { z } from "zod";

export interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
  timestamp?: string;
}

export function apiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
    message: z.string().optional(),
    timestamp: z.string().datetime().optional(),
  });
}

export const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
  timestamp: z.string().datetime().optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
