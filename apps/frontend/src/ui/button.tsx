// frontend/src/ui/button.tsx
import { ReactNode } from "react";

interface ButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
  variant?: "default" | "secondary";
}

export const Button = ({
  onClick,
  disabled = false,
  children,
  className = "",
  variant = "default",
}: ButtonProps) => {
  const baseStyles =
    "px-4 py-2 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
  const variantStyles =
    variant === "default"
      ? "bg-primary text-white hover:bg-primary/90"
      : "bg-secondary text-primary hover:bg-secondary/90";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variantStyles} ${className}`}
    >
      {children}
    </button>
  );
};
