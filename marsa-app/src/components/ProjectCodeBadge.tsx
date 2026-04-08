/**
 * Small monospace pill that renders Project.projectCode consistently
 * across cards, table cells, tooltips, and dropdowns.
 *
 * Returns null when the code is missing so callers don't have to gate
 * it themselves — drop it in and forget about it.
 */

import { Hash } from "lucide-react";

interface Props {
  code?: string | null;
  size?: "xs" | "sm" | "md";
  // When true, renders a tighter inline variant (no icon, smaller padding)
  // suitable for table cells and dropdowns where horizontal space is tight.
  inline?: boolean;
  className?: string;
}

export default function ProjectCodeBadge({
  code,
  size = "sm",
  inline = false,
  className = "",
}: Props) {
  if (!code) return null;

  const sizeStyles = {
    xs: { fontSize: 9, padding: inline ? "0 4px" : "1px 5px", iconSize: 8 },
    sm: { fontSize: 10, padding: inline ? "1px 5px" : "2px 7px", iconSize: 9 },
    md: { fontSize: 12, padding: "3px 9px", iconSize: 11 },
  }[size];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-mono font-bold tracking-wider ${className}`}
      style={{
        fontSize: sizeStyles.fontSize,
        padding: sizeStyles.padding,
        backgroundColor: inline ? "transparent" : "rgba(94,84,149,0.08)",
        color: "#5E5495",
        border: inline ? "none" : "1px solid rgba(94,84,149,0.18)",
        whiteSpace: "nowrap",
        verticalAlign: "middle",
      }}
      title={`رمز المشروع: ${code}`}
    >
      {!inline && <Hash size={sizeStyles.iconSize} />}
      {code}
    </span>
  );
}
