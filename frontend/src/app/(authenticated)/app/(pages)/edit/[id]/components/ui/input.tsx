import * as React from 'react';

import TextInput, { TextInputProps } from '@/components/ui/TextInput';

type InputProps = Omit<TextInputProps, 'label'> & { label?: string };

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, placeholder, name, ...props }, ref) => {
    const resolvedLabel = label ?? placeholder ?? name ?? 'Input';

    return (
      <TextInput
        ref={ref}
        label={resolvedLabel}
        placeholder={placeholder}
        name={name}
        className={className}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
