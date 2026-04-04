"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

// ═══════════════════════════════════════════════════
// Marsa Design System — Unified Button Component
// ═══════════════════════════════════════════════════
//
// Variants:
//   primary   — Purple (#5E5495) bg, white text. Main actions: save, create, submit
//   gold      — Gold (#C9A84C) bg, white text. Accent actions: add, highlight
//   secondary — Light border, gray text. Cancel, back, dismiss
//   danger    — Red (#DC2626) bg, white text. Delete, remove, destructive
//   dangerSoft— Red tinted bg, red text. Soft destructive: unlink, remove item
//   ghost     — Transparent, subtle hover. Minimal actions: filters, toggles
//   outline   — Border only, themed text. Alternative secondary
//   link      — Text only, gold color. Inline navigation
//
// Sizes:
//   xs — Small inline actions (badges, table actions)
//   sm — Compact buttons (filters, small forms)
//   md — Default size
//   lg — Large buttons (primary form actions)
//

type Variant = "primary" | "gold" | "secondary" | "danger" | "dangerSoft" | "ghost" | "outline" | "link";
type Size = "xs" | "sm" | "md" | "lg";

const variantStyles: Record<Variant, React.CSSProperties> = {
  primary: {
    backgroundColor: "#5E5495",
    color: "#FFFFFF",
    border: "1px solid transparent",
  },
  gold: {
    backgroundColor: "#C9A84C",
    color: "#FFFFFF",
    border: "1px solid transparent",
  },
  secondary: {
    backgroundColor: "transparent",
    color: "#2D3748",
    border: "1px solid #E2E0D8",
  },
  danger: {
    backgroundColor: "#DC2626",
    color: "#FFFFFF",
    border: "1px solid transparent",
  },
  dangerSoft: {
    backgroundColor: "rgba(220,38,38,0.08)",
    color: "#DC2626",
    border: "1px solid transparent",
  },
  ghost: {
    backgroundColor: "transparent",
    color: "#6B7280",
    border: "1px solid transparent",
  },
  outline: {
    backgroundColor: "transparent",
    color: "#5E5495",
    border: "1px solid #5E5495",
  },
  link: {
    backgroundColor: "transparent",
    color: "#C9A84C",
    border: "none",
    padding: "0",
  },
};

const variantHover: Record<Variant, React.CSSProperties> = {
  primary: { backgroundColor: "#4E4585", boxShadow: "0 4px 12px rgba(94,84,149,0.3)" },
  gold: { backgroundColor: "#B8963F", boxShadow: "0 4px 12px rgba(201,168,76,0.3)" },
  secondary: { backgroundColor: "#F3F4F6" },
  danger: { backgroundColor: "#B91C1C", boxShadow: "0 4px 12px rgba(220,38,38,0.25)" },
  dangerSoft: { backgroundColor: "rgba(220,38,38,0.14)" },
  ghost: { backgroundColor: "rgba(0,0,0,0.04)" },
  outline: { backgroundColor: "rgba(94,84,149,0.06)" },
  link: { textDecoration: "underline" },
};

const sizeClasses: Record<Size, string> = {
  xs: "px-2.5 py-1 text-xs rounded-lg gap-1",
  sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5",
  md: "px-4 py-2.5 text-sm rounded-xl gap-2",
  lg: "px-6 py-3 text-sm rounded-xl gap-2",
};

const iconSizeClasses: Record<Size, string> = {
  xs: "w-6 h-6 rounded-lg",
  sm: "w-8 h-8 rounded-lg",
  md: "w-9 h-9 rounded-xl",
  lg: "w-10 h-10 rounded-xl",
};

interface MarsaButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  iconOnly?: boolean;
  href?: string;
  children?: ReactNode;
}

const MarsaButton = forwardRef<HTMLButtonElement, MarsaButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      icon,
      iconOnly = false,
      href,
      children,
      disabled,
      className = "",
      style,
      onMouseEnter,
      onMouseLeave,
      ...props
    },
    ref
  ) => {
    const baseStyle = variantStyles[variant];
    const hover = variantHover[variant];
    const sizeClass = iconOnly ? iconSizeClasses[size] : sizeClasses[size];

    const combinedClassName = `inline-flex items-center justify-center font-semibold whitespace-nowrap transition-all duration-200 select-none ${sizeClass} ${
      disabled || loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
    } ${className}`.trim();

    const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!disabled && !loading) {
        Object.assign(e.currentTarget.style, hover);
      }
      onMouseEnter?.(e);
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!disabled && !loading) {
        // Reset to base styles
        e.currentTarget.style.backgroundColor = baseStyle.backgroundColor || "";
        e.currentTarget.style.boxShadow = "";
        e.currentTarget.style.textDecoration = "";
      }
      onMouseLeave?.(e);
    };

    const content = (
      <>
        {loading ? <Loader2 size={size === "xs" || size === "sm" ? 14 : 18} className="animate-spin" /> : icon}
        {!iconOnly && children}
      </>
    );

    if (href && !disabled) {
      return (
        <Link
          href={href}
          className={combinedClassName}
          style={{ ...baseStyle, ...style }}
          onMouseEnter={(e) => {
            if (!disabled) Object.assign(e.currentTarget.style, hover);
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = baseStyle.backgroundColor || "";
            e.currentTarget.style.boxShadow = "";
            e.currentTarget.style.textDecoration = "";
          }}
        >
          {content}
        </Link>
      );
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={combinedClassName}
        style={{ ...baseStyle, ...style }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {content}
      </button>
    );
  }
);

MarsaButton.displayName = "MarsaButton";

export { MarsaButton };
export type { MarsaButtonProps, Variant as MarsaButtonVariant, Size as MarsaButtonSize };
