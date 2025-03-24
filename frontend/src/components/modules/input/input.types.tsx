export interface InputProps {
  type: string;
  placeholder?: string;
  control: any;
  name: string;
  defaultValue?: string;
  rules?: object;
  style?: React.CSSProperties;
  error?: string | undefined;
}
