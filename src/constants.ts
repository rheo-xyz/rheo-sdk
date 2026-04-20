/**
 * Canonical `CopyLimitOrderConfig` presets. Each preset is a fully-formed
 * struct that can be passed to `setCopyLimitOrderConfigs` (v1.8+ market) or
 * `setUserCollectionCopyLimitOrderConfigs` (v1.8+ factory) without the
 * caller having to construct one by hand. Re-exported as
 * `sdk.constants.{FullCopy, NoCopy, NullCopy}`.
 *
 * A `CopyLimitOrderConfig` has five fields:
 * - `minTenor` / `maxTenor` — the tenor (duration in seconds) range of the
 *   source order that should be copied.
 * - `minAPR` / `maxAPR` — the APR range of the source order that should be
 *   copied.
 * - `offsetAPR` — a signed APR delta applied on top of the copied rate.
 *
 * @module constants
 */

import { BigNumber, ethers } from "ethers";
import { CopyLimitOrderConfigStructOutput } from "./v1.8/types/ethers-contracts/Size";

/**
 * Copy every order the source user publishes, unchanged. All tenor and APR
 * ranges are opened to their maximum and `offsetAPR` is zero, so the
 * copying user effectively mirrors the source's orders one-for-one.
 *
 * @example
 * ```ts
 * sdk.market.setCopyLimitOrderConfigs(market, {
 *   copyLoanOfferConfig: sdk.constants.FullCopy,
 *   copyBorrowOfferConfig: sdk.constants.FullCopy,
 * });
 * ```
 */
export const FullCopy: CopyLimitOrderConfigStructOutput = {
  minTenor: BigNumber.from(0),
  maxTenor: ethers.constants.MaxUint256,
  minAPR: BigNumber.from(0),
  maxAPR: ethers.constants.MaxUint256,
  offsetAPR: BigNumber.from(0),
} as CopyLimitOrderConfigStructOutput;

/**
 * Disable copying entirely. `offsetAPR` is `type(int256).min`, which the
 * market uses as a sentinel meaning "do not copy this side." Use when the
 * user wants to unsubscribe from a source's loan or borrow offers without
 * touching the other side.
 *
 * @example
 * ```ts
 * sdk.market.setCopyLimitOrderConfigs(market, {
 *   copyLoanOfferConfig: sdk.constants.FullCopy,
 *   copyBorrowOfferConfig: sdk.constants.NoCopy,
 * });
 * ```
 */
export const NoCopy: CopyLimitOrderConfigStructOutput = {
  minTenor: BigNumber.from(0),
  maxTenor: BigNumber.from(0),
  minAPR: BigNumber.from(0),
  maxAPR: BigNumber.from(0),
  offsetAPR: ethers.constants.MinInt256,
} as CopyLimitOrderConfigStructOutput;

/**
 * Neutral preset with all ranges zero and `offsetAPR: 0`. Semantically this
 * is a "config is not set" placeholder — the market treats it as copying
 * disabled because the tenor/APR windows are degenerate, but unlike
 * {@link NoCopy} it does not use the sentinel `offsetAPR`. Prefer
 * {@link NoCopy} for explicit unsubscribe intent and reserve `NullCopy` for
 * initialization/reset flows.
 */
export const NullCopy: CopyLimitOrderConfigStructOutput = {
  minTenor: BigNumber.from(0),
  maxTenor: BigNumber.from(0),
  minAPR: BigNumber.from(0),
  maxAPR: BigNumber.from(0),
  offsetAPR: BigNumber.from(0),
} as CopyLimitOrderConfigStructOutput;
