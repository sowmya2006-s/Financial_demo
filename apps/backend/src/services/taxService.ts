// src/services/taxService.ts

/**
 * Calculates income tax based on simplified rules:
 * Salary < ₹30,000 → 0%
 * ₹30,000 – ₹60,000 → 5%
 * ₹60,000 – ₹1,00,000 → 10%
 * ₹1,00,000+ → 20%
 */
export function calculateIncomeTax(salaryRupees: number): number {
  if (salaryRupees < 30000) return 0;
  if (salaryRupees <= 60000) return salaryRupees * 0.05;
  if (salaryRupees <= 100000) return salaryRupees * 0.10;
  return salaryRupees * 0.20;
}

/**
 * Compute weekly income tax based on current salary (in rupees).
 * Returns tax amount in paise (since our monetary unit is paise).
 */
export function computeWeeklyTax(salaryPaise: number): number {
  // salary paise to rupees
  const salaryRupees = Math.floor(salaryPaise / 100);
  const taxRupees = calculateIncomeTax(salaryRupees);
  return taxRupees * 100; // back to paise
}
