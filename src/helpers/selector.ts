/**
 * Computes a Solidity 4-byte function selector as a lowercase hex string
 * **without the `0x` prefix**. Two overloads are supported:
 *
 * 1. Pass a canonical signature string: `selector("transfer(address,uint256)")`.
 *    Uses `ethers.utils.id` (keccak-256) and slices the first 4 bytes.
 * 2. Pass an `ethers.utils.Interface` plus a `functionName`: the selector is
 *    looked up from the interface's pre-built function fragments, which is
 *    handy when you already have the ABI loaded.
 *
 * Used internally by {@link ErrorDecoder} to match the built-in
 * `Error(string)` / `Panic(uint256)` revert selectors; re-exported on
 * `sdk.helpers.selector` for callers that need the same primitive.
 *
 * @param s - Either a canonical signature string or an `Interface`.
 * @param functionName - When `s` is an `Interface`, the function name to
 *   resolve. Ignored when `s` is a string.
 * @returns 8 hex characters (no `0x` prefix) representing the 4-byte selector.
 *
 * @example
 * ```ts
 * sdk.helpers.selector("transfer(address,uint256)");
 * // → "a9059cbb"
 *
 * sdk.helpers.selector(new ethers.utils.Interface(abi), "deposit");
 * // → 8 hex chars matching the deposit selector in `abi`
 * ```
 */
import { Interface } from "@ethersproject/abi";
import { ethers } from "ethers";

export default function selector(
  s: string | Interface,
  functionName?: string,
): string {
  if (typeof s === "string") {
    return ethers.utils.id(s).slice(2, 10);
  } else {
    return s.getSighash(s.getFunction(functionName!)).substring(2, 10);
  }
}
