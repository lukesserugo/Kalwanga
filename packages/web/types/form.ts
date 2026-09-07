// D:\Projects\Kalwanga\packages\web\types\form.ts

export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'date' | 'datetime-local' | 'select' | 'textarea' | 'checkbox' | 'radio' | 'file' | 'hidden';
  required?: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string; disabled?: boolean }>;
  validation?: (value: any) => boolean | string;
  error?: string;
  defaultValue?: any;
  disabled?: boolean;
  readonly?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  accept?: string;
  multiple?: boolean;
}

export interface FormState {
  [key: string]: any;
}

export interface FormErrors {
  [key: string]: string[];
}

export interface FormTouched {
  [key: string]: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface FormValidationRule {
  test: (value: any, formValues?: FormState) => boolean | ValidationResult;
  message: string;
}

export interface FormSchema {
  [key: string]: FormValidationRule[];
}

export interface FormConfig {
  fields: FormField[];
  initialValues: FormState;
  validation?: FormSchema;
  onSubmit: (values: FormState) => void | Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  error?: string;
}
