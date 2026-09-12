// D:\Projects\Kalwanga\packages\web\utils\registerCodeGenerator.ts

/**
 * Generate a unique register code from business unit code and register name
 * Format: {BU_CODE}-{INITIALS}-{SEQUENCE}
 * Example: KCL-E-001
 */

export interface RegisterCodeOptions {
  businessUnitCode: string;
  businessUnitName?: string;
  registerName: string;
  existingCodes?: string[];
  sequenceNumber?: number;
}

// ============================================
// EXISTING FUNCTIONS (keep these)
// ============================================

function extractInitials(name: string): string {
  if (!name || name.trim().length === 0) return 'REG';

  const words = name.trim().split(/\s+/);

  if (words.length === 1) {
    const word = words[0];
    const letters = word.replace(/[^a-zA-Z]/g, '');
    const numbers = word.replace(/[^0-9]/g, '');

    if (numbers) {
      return letters.charAt(0).toUpperCase() + numbers;
    }
    return letters.charAt(0).toUpperCase();
  }

  return words
    .slice(0, 3)
    .map((word) => {
      const letters = word.replace(/[^a-zA-Z]/g, '');
      const numbers = word.replace(/[^0-9]/g, '');
      return letters.charAt(0).toUpperCase() + (numbers || '');
    })
    .join('');
}

function sanitizeBusinessUnitCode(code: string): string {
  if (!code) return 'BU';
  return code
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 10);
}

export function generateRegisterCode(options: RegisterCodeOptions): string {
  const { businessUnitCode, registerName, existingCodes = [], sequenceNumber } = options;

  const buCode = sanitizeBusinessUnitCode(businessUnitCode);
  const initials = extractInitials(registerName);
  const baseCode = `${buCode}-${initials}`;

  if (sequenceNumber !== undefined) {
    return `${baseCode}-${String(sequenceNumber).padStart(3, '0')}`;
  }

  let nextSequence = 1;
  const existingWithBase = existingCodes.filter((code) =>
    code.toUpperCase().startsWith(baseCode.toUpperCase())
  );

  if (existingWithBase.length > 0) {
    const sequences = existingWithBase
      .map((code) => {
        const match = code.match(/-(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => n > 0);

    if (sequences.length > 0) {
      nextSequence = Math.max(...sequences) + 1;
    }
  }

  return `${baseCode}-${String(nextSequence).padStart(3, '0')}`;
}

export function validateRegisterCode(code: string): { valid: boolean; error?: string } {
  if (!code || code.trim().length === 0) {
    return { valid: false, error: 'Register code is required' };
  }
  if (code.length < 3) {
    return { valid: false, error: 'Register code must be at least 3 characters' };
  }
  if (code.length > 30) {
    return { valid: false, error: 'Register code must be less than 30 characters' };
  }
  if (!/^[A-Z0-9-]+$/.test(code)) {
    return {
      valid: false,
      error: 'Register code can only contain uppercase letters, numbers, and hyphens',
    };
  }
  return { valid: true };
}

export function previewRegisterCode(
  businessUnitCode: string,
  registerName: string,
  existingCodes: string[] = []
): string {
  if (!businessUnitCode || !registerName) return '';
  return generateRegisterCode({
    businessUnitCode,
    registerName,
    existingCodes,
  });
}

// ============================================
// ✅ NEW FUNCTIONS (add these)
// ============================================

/**
 * Parse a register code into its components
 * "002-LS-001" → { prefix: "002-LS", sequence: 1 }
 * "KCL-ME-042" → { prefix: "KCL-ME", sequence: 42 }
 */
export function parseRegisterCode(code: string): {
  prefix: string;
  sequence: number;
} | null {
  if (!code) return null;
  const match = code.toUpperCase().match(/^(.*?)-(\d+)$/);
  if (!match) return null;
  return {
    prefix: match[1],
    sequence: parseInt(match[2], 10),
  };
}

/**
 * Find the next available code given a base code and existing codes
 * "002-LS-001" + ["002-LS-001", "002-LS-002"] → "002-LS-003"
 * "002-LS-001" + [] → "002-LS-001"
 */
export function findNextAvailableCode(
  code: string,
  existingCodes: string[]
): string {
  if (!code) return code;

  const parsed = parseRegisterCode(code);

  // If the code doesn't have a sequence pattern, we can't auto-increment
  if (!parsed) {
    return code.toUpperCase();
  }

  const { prefix, sequence: startSeq } = parsed;
  const upperExisting = new Set(
    existingCodes.map((c) => c.toUpperCase())
  );

  // If the original code is free, use it
  const originalCode = code.toUpperCase();
  if (!upperExisting.has(originalCode)) {
    return originalCode;
  }

  // Otherwise, increment until we find a free slot
  let seq = startSeq;
  let candidate = `${prefix}-${String(seq).padStart(3, '0')}`;

  let attempts = 0;
  const maxAttempts = 999;

  while (upperExisting.has(candidate) && attempts < maxAttempts) {
    seq += 1;
    candidate = `${prefix}-${String(seq).padStart(3, '0')}`;
    attempts++;
  }

  return candidate;
}

// ============================================
// DEFAULT EXPORT
// ============================================

export default {
  generateRegisterCode,
  validateRegisterCode,
  previewRegisterCode,
  extractInitials,
  sanitizeBusinessUnitCode,
  parseRegisterCode,
  findNextAvailableCode,
};
