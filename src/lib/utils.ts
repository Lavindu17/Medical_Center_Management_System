import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type MoneyFormatOptions = {
  minimumFractionDigits?: number
  maximumFractionDigits?: number
}

export function formatLKR(
  amount: number | string | null | undefined,
  options: MoneyFormatOptions = {}
) {
  if (amount === null || amount === undefined) return "-"

  const numericAmount = typeof amount === "string" ? Number(amount) : amount
  if (!Number.isFinite(numericAmount)) return "-"

  const { minimumFractionDigits = 2, maximumFractionDigits = 2 } = options
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    currencyDisplay: "code",
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(numericAmount)
}
