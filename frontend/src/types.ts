export interface ButtonProps {
  type?: string;
  text: string;
  style?: React.CSSProperties;
  size?: string;
  onClick: () => void;
}

export interface CardProps {
  children?: React.ReactNode;
  undertext?: string;
  type?: string;
  profileImg?: string;
  name?: string;
  role?: string;
  quote?: string;
}

export interface InputProps {
  type: string;
  placeholder: string;
  control: any;
  name: string;
  rules: any;
  error: string | undefined;
}

export type App = {
  id: number;
  title: string;
  icon: string;
  undertext: string;
};

export type Collection = {
  id: number;
  name: string;
}
