/**
 * Risk config structure as returned by riskConfig() on Rheo/Size contracts.
 * Per the updated ABI, the tuple order is:
 * [crOpening, crLiquidation, minimumCreditBorrowToken, minTenor, maxTenor, maturities?]
 */
export interface ParsedRiskConfig {
  crOpening: string;
  crLiquidation: string;
  minimumCreditBorrowToken: string;
  minTenor: string;
  maxTenor: string;
  maturities?: string[];
}

/**
 * Parses risk config from contract riskConfig() response.
 *
 * The contract ABI returns a tuple with this structure:
 * - Index 0: crOpening (uint256)
 * - Index 1: crLiquidation (uint256)
 * - Index 2: minimumCreditBorrowToken (uint256)
 * - Index 3: minTenor (uint256)
 * - Index 4: maxTenor (uint256)
 * - Index 5: maturities (uint256[]) - FM/Rheo only
 *
 * Handles both legacy 5-field (Size) and 6-field (Rheo/FM) responses.
 *
 * @param result - Raw result from riskConfig() call - can be tuple, array,
 *   or object with named properties (ethers Result)
 */
export function parseRiskConfig(
  result: unknown,
): ParsedRiskConfig {
  const toStr = (v: unknown): string => {
    if (v === undefined || v === null) return "0";
    if (typeof v === "object" && "toString" in v && typeof (v as { toString: () => string }).toString === "function") {
      return (v as { toString: () => string }).toString();
    }
    return String(v);
  };

  const toStrArray = (v: unknown): string[] => {
    if (!Array.isArray(v)) return [];
    return v.map((x) => toStr(x));
  };

  // Handle named object (ethers Result with keys crOpening, crLiquidation, etc.)
  if (
    result !== null &&
    typeof result === "object" &&
    !Array.isArray(result) &&
    ("crOpening" in result || "crLiquidation" in result)
  ) {
    const r = result as Record<string, unknown>;
    return {
      crOpening: toStr(r.crOpening),
      crLiquidation: toStr(r.crLiquidation),
      minimumCreditBorrowToken: toStr(r.minimumCreditBorrowToken),
      minTenor: toStr(r.minTenor),
      maxTenor: toStr(r.maxTenor),
      maturities: r.maturities ? toStrArray(r.maturities) : undefined,
    };
  }

  // Handle tuple/array - use explicit index mapping per updated ABI order
  const arr = Array.isArray(result) ? result : [];
  const parsed: ParsedRiskConfig = {
    crOpening: toStr(arr[0]),
    crLiquidation: toStr(arr[1]),
    minimumCreditBorrowToken: toStr(arr[2]),
    minTenor: toStr(arr[3]),
    maxTenor: toStr(arr[4]),
  };

  if (arr.length >= 6 && arr[5] !== undefined && arr[5] !== null) {
    parsed.maturities = toStrArray(arr[5]);
  }

  return parsed;
}
