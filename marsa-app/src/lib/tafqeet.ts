/**
 * تفقيط - تحويل الأرقام إلى نص عربي
 * Arabic number to words converter (Tafqeet)
 */

const ones = [
  "", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة",
  "ستة", "سبعة", "ثمانية", "تسعة", "عشرة",
  "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر",
  "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر",
];

const tens = [
  "", "", "عشرون", "ثلاثون", "أربعون", "خمسون",
  "ستون", "سبعون", "ثمانون", "تسعون",
];

const hundreds = [
  "", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة",
  "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة",
];

const scales = [
  "", "ألف", "مليون", "مليار", "تريليون",
];

const scalesPlural = [
  "", "آلاف", "ملايين", "مليارات", "تريليونات",
];

function convertGroup(num: number): string {
  if (num === 0) return "";
  if (num < 20) return ones[num];

  const h = Math.floor(num / 100);
  const remainder = num % 100;
  const t = Math.floor(remainder / 10);
  const o = remainder % 10;

  const parts: string[] = [];

  if (h > 0) parts.push(hundreds[h]);

  if (remainder > 0 && remainder < 20) {
    parts.push(ones[remainder]);
  } else {
    if (o > 0) parts.push(ones[o]);
    if (t > 0) parts.push(tens[t]);
  }

  return parts.join(" و");
}

export function tafqeet(amount: number, currency: string = "ريال سعودي"): string {
  if (amount === 0) return `صفر ${currency}`;

  const isNegative = amount < 0;
  amount = Math.abs(amount);

  const intPart = Math.floor(amount);
  const decPart = Math.round((amount - intPart) * 100);

  // Split integer into groups of 3
  const groups: number[] = [];
  let temp = intPart;
  if (temp === 0) {
    groups.push(0);
  } else {
    while (temp > 0) {
      groups.push(temp % 1000);
      temp = Math.floor(temp / 1000);
    }
  }

  const parts: string[] = [];

  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g === 0) continue;

    const groupText = convertGroup(g);
    if (i === 0) {
      parts.push(groupText);
    } else {
      // Use dual form for 2, plural for 3-10, singular for others
      const scale = g <= 2
        ? scales[i]
        : g <= 10
          ? scalesPlural[i]
          : scales[i];

      if (g === 1) {
        parts.push(scale);
      } else if (g === 2) {
        parts.push(scale === "ألف" ? "ألفان" : scale);
      } else {
        parts.push(`${groupText} ${scale}`);
      }
    }
  }

  let result = parts.join(" و");

  if (intPart > 0) {
    result += ` ${currency}`;
  }

  if (decPart > 0) {
    const decText = convertGroup(decPart);
    if (intPart > 0) {
      result += ` و${decText} هللة`;
    } else {
      result = `${decText} هللة`;
    }
  }

  if (isNegative) {
    result = `سالب ${result}`;
  }

  return result;
}

/**
 * تفقيط مبسط - يعيد النص مع "فقط لا غير"
 */
export function tafqeetFull(amount: number, currency: string = "ريال سعودي"): string {
  return `${tafqeet(amount, currency)} فقط لا غير`;
}
