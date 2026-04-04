import Image from "next/image";

interface MarsaLogoProps {
  size?: number;
  variant?: "auto" | "dark" | "light";
  className?: string;
}

export default function MarsaLogo({ size = 38, variant = "auto", className = "" }: MarsaLogoProps) {
  // "light" variant = white logo (for dark backgrounds)
  // "dark" variant = original logo (for light backgrounds)
  // "auto" defaults to dark (original)
  const isLight = variant === "light";
  const src = isLight ? "/images/marsa-logo-white.png" : "/images/marsa-logo.png";

  return (
    <Image
      src={src}
      alt="مرسى"
      width={size}
      height={size}
      className={`object-contain ${className}`}
      style={{ width: size, height: "auto" }}
      unoptimized
    />
  );
}

// Keep backward-compatible named exports
export function MarsaLogoMark({ size = 32 }: { size?: number }) {
  return <MarsaLogo size={size} variant="dark" />;
}
