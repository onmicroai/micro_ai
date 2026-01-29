export interface InputProps {
  type?: string;
  placeholder?: string;
  control: any;
  name: string;
  label: string;
  hint?: string;
  info?: string;
  defaultValue?: string;
  rules?: object;
  disabled?: boolean;
  readOnly?: boolean;
  error?: string | undefined;
}
