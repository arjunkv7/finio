export interface ParsedSmsTransaction {
  amount: number; // stored in paise (1/100 of a rupee)
  type: 'income' | 'expense';
  accountType: 'bank' | 'credit' | 'wallet';
  description: string | null;
}

// Debit / expense patterns
const DEBIT_RES: RegExp[] = [
  /(?:rs\.?|inr|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:has[\s-]been\s+)?(?:debited|deducted|debit)/i,
  /(?:debited|deducted)\s+(?:with\s+)?(?:rs\.?|inr|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
  /(?:txn|transaction)\s+(?:of\s+)?(?:rs\.?|inr|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
  /(?:purchase|payment|paid)\s+(?:of\s+)?(?:rs\.?|inr|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
  /(?:rs\.?|inr|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)\s+(?:spent|deducted|charged|sent)/i,
  /(?:rs\.?|inr|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)\s+(?:withdrawn|withdrawal)/i,
  /(?:withdrawn|withdrawal)\s+(?:of\s+)?(?:rs\.?|inr|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
  // "spent ₹X on …" / "sent ₹X to …"
  /(?:spent|send|sent)\s+(?:rs\.?|inr|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
  // "charged ₹X" (amount after keyword)
  /charged\s+(?:rs\.?|inr|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
];

// Credit / income patterns
const CREDIT_RES: RegExp[] = [
  /(?:rs\.?|inr|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:has[\s-]been\s+)?(?:credited|deposited)/i,
  /(?:credited|deposited)\s+(?:with\s+)?(?:rs\.?|inr|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
  /(?:rs\.?|inr|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)\s+(?:received|deposited)/i,
  /received\s+(?:rs\.?|inr|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
  /(?:refund|cashback)\s+(?:of\s+)?(?:rs\.?|inr|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
  /(?:rs\.?|inr|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)\s+(?:refund|cashback)/i,
];

function extractAmount(body: string, patterns: RegExp[]): number | null {
  for (const re of patterns) {
    const m = body.match(re);
    if (m?.[1]) {
      const num = parseFloat(m[1].replace(/,/g, ''));
      if (!isNaN(num) && num > 0) return Math.round(num * 100);
    }
  }
  return null;
}

function detectAccountType(body: string): 'bank' | 'credit' | 'wallet' {
  if (/credit\s+card|cc\s+ending|card\s+ending|cc\s+no\.?/i.test(body)) return 'credit';
  if (/paytm\s+wallet|phonepe\s+wallet|amazon\s+pay\s+balance|mobikwik\s+wallet/i.test(body)) return 'wallet';
  return 'bank';
}

function extractDescription(body: string): string | null {
  // UPI: "to MerchantName" or "to vpa@bank"
  let m = body.match(/\bto\s+([A-Za-z][A-Za-z0-9\s&._-]{1,30})(?:\s+(?:on|via|ref|upi|a\/c)|$)/i);
  if (m?.[1]) {
    const desc = m[1].trim().replace(/\s+/g, ' ');
    if (!/^[xX*\d]+$/.test(desc)) return desc;
  }

  // "spent/sent … on/at MERCHANT"
  m = body.match(/\bon\s+([A-Za-z][A-Za-z0-9\s&._-]{2,30})(?:\s+(?:via|ref|upi)|[.,]|$)/i);
  if (m?.[1]) {
    const desc = m[1].trim().replace(/\s+/g, ' ');
    if (!/^[xX*\d]+$/.test(desc)) return desc;
  }

  // POS merchant: "at MERCHANT NAME"
  m = body.match(/\bat\s+([A-Za-z][A-Za-z0-9\s&._-]{2,30})(?:\s+(?:on|via|ref|upi)|[.,]|$)/i);
  if (m?.[1]) {
    const desc = m[1].trim().replace(/\s+/g, ' ');
    if (!/^[xX*\d]+$/.test(desc)) return desc;
  }

  // NEFT/IMPS ref with name
  m = body.match(/(?:neft|imps|rtgs)\s+.*?(?:from|to)\s+([A-Za-z][A-Za-z\s]{2,25})/i);
  if (m?.[1]) return m[1].trim();

  return null;
}

export function parseSms(address: string, body: string): ParsedSmsTransaction | null {
  // Skip OTP and promotional messages
  if (/\botp\b|one[\s-]time[\s-]pass|verification\s+code|your\s+otp\s+is/i.test(body)) return null;
  if (/congratulations|exclusive\s+offer|limited\s+time|click\s+here|subscribe/i.test(body)) return null;
  // Must contain a currency amount
  if (!/(?:rs\.?|inr|₹)\s*[0-9]/i.test(body)) return null;
  // Must have a financial keyword
  if (!/(?:debited?|credited?|paid|payment|txn|transaction|transfer|withdrawn|received|refund|cashback|sent|spent|charged)/i.test(body)) return null;

  const debitAmount = extractAmount(body, DEBIT_RES);
  if (debitAmount !== null) {
    return { amount: debitAmount, type: 'expense', accountType: detectAccountType(body), description: extractDescription(body) };
  }

  const creditAmount = extractAmount(body, CREDIT_RES);
  if (creditAmount !== null) {
    return { amount: creditAmount, type: 'income', accountType: detectAccountType(body), description: extractDescription(body) };
  }

  return null;
}
