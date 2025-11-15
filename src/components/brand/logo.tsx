"use client";

import Image from "next/image";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";

interface LogoProps {
  width?: number;
  height?: number;
  className?: string;
  alt?: string;
}

export function Logo({
  width = 24,
  height = 24,
  className = "",
  alt = "WorkLog Logo",
}: LogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Use light logo for dark mode, regular logo for light mode
  // Default to light logo during SSR to avoid hydration mismatch
  const logoSrc =
    mounted && resolvedTheme === "dark" ? "/logo-light.svg" : "/logo.svg";

  return (
    <Image
      src={logoSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
    />
  );
}
