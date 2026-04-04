"use client";

import Image from "next/image";

interface SarSymbolProps {
  size?: number;
  className?: string;
}

export default function SarSymbol({ size = 16, className = "" }: SarSymbolProps) {
  return (
    <Image
      src="/images/sar-symbol.png"
      alt="ر.س"
      width={size}
      height={size}
      className={`inline-block align-middle ${className}`}
      style={{ width: size, height: size }}
      unoptimized
    />
  );
}
