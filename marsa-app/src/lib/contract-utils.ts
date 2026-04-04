import { tafqeet, tafqeetFull } from "./tafqeet";

/**
 * Extract variable names from contract template content
 * Pattern: {{variableName}}
 */
export function extractVariables(content: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const vars = new Set<string>();
  let match;
  while ((match = regex.exec(content)) !== null) {
    vars.add(match[1].trim());
  }
  return Array.from(vars);
}

/**
 * Auto-generated variables computed from contract data
 */
export interface AutoVariables {
  [key: string]: string;
}

/**
 * Generate auto-computed variables from contract variables JSON
 */
export function generateAutoVariables(variables: Record<string, string>): AutoVariables {
  const auto: AutoVariables = {};

  // Find amount fields and generate tafqeet
  const amountKeys = [
    "totalAmount", "المبلغ_الإجمالي", "amount", "قيمة_العقد",
    "contract_amount", "مبلغ_العقد", "price", "السعر",
  ];

  for (const key of amountKeys) {
    const val = variables[key];
    if (val) {
      const num = parseFloat(val.replace(/,/g, ""));
      if (!isNaN(num)) {
        auto[`${key}_tafqeet`] = tafqeet(num);
        auto[`${key}_tafqeet_full`] = tafqeetFull(num);
        auto["المبلغ_كتابة"] = tafqeetFull(num);
        break;
      }
    }
  }

  // Date auto variables
  const today = new Date();
  const hijriFormatter = new Intl.DateTimeFormat("ar-SA-u-ca-islamic", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const gregorianFormatter = new Intl.DateTimeFormat("ar-SA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  auto["التاريخ_الهجري"] = hijriFormatter.format(today);
  auto["التاريخ_الميلادي"] = gregorianFormatter.format(today);
  auto["تاريخ_اليوم"] = today.toISOString().split("T")[0];

  return auto;
}

/**
 * Replace all {{variable}} placeholders in content with values
 * Tries user variables first, then auto variables
 */
export function replaceVariables(
  content: string,
  variables: Record<string, string>,
  autoVars?: AutoVariables
): string {
  const allVars = { ...autoVars, ...variables };

  return content.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const trimmedKey = key.trim();
    return allVars[trimmedKey] !== undefined ? allVars[trimmedKey] : match;
  });
}

/**
 * Extract contract total price from variables JSON
 */
export function extractContractPrice(variables: Record<string, string>): number | null {
  const keys = [
    "totalAmount", "المبلغ_الإجمالي", "amount", "قيمة_العقد",
    "contract_amount", "مبلغ_العقد", "price", "السعر",
  ];

  for (const key of keys) {
    const val = variables[key];
    if (val) {
      const num = parseFloat(val.replace(/,/g, ""));
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return null;
}
