// Format number with Indian currency style: ₹1,23,456.00
export function formatCurrency(val: string | number): string {
  const n = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(n)) return String(val) || '';
  
  const [intPart, decPart] = Math.abs(n).toFixed(2).split('.');
  
  // Indian grouping: last 3 digits, then every 2 digits
  let formatted = '';
  if (intPart.length <= 3) {
    formatted = intPart;
  } else {
    formatted = intPart.slice(-3);
    let remaining = intPart.slice(0, -3);
    while (remaining.length > 2) {
      formatted = remaining.slice(-2) + ',' + formatted;
      remaining = remaining.slice(0, -2);
    }
    if (remaining) formatted = remaining + ',' + formatted;
  }
  
  return `${n < 0 ? '-' : ''}₹${formatted}.${decPart}`;
}
