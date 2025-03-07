// frontend/src/ui/input.tsx
import { ChangeEvent } from "react";

interface InputProps {
  id?: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  type?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export const Input = ({
  id,
  value,
  onChange,
  placeholder,
  className = "",
  type = "text",
}: InputProps) => {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`
        w-full px-3 py-2 
        border border-gray-300 rounded-md
        focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
        placeholder:text-gray-500
        ${className}
      `}
    />
  );
};
