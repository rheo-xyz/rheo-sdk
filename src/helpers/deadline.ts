/**
 * Returns a unix timestamp (in seconds, as `bigint`) that is `seconds` in
 * the future from the local clock. Intended for the `deadline` field of
 * market-order params (`buyCreditMarket`, `sellCreditMarket`) and similar
 * time-bounded calls.
 *
 * @remarks
 * **Compute this at send-time, not ahead of time.** A deadline embedded in
 * an LLM completion or cached transaction plan will likely be stale by the
 * time the user signs — call `sdk.helpers.deadline(60)` inline inside the
 * `sdk.tx.build(...)` expression so it resolves against the current clock.
 *
 * The local system clock must be reasonably accurate; a large skew would
 * produce deadlines the chain rejects as already expired.
 *
 * @param seconds - Seconds to add to `Date.now()`. @defaultValue `60`
 * @returns Unix seconds (`bigint`) at which the deadline elapses.
 *
 * @example
 * ```ts
 * sdk.market.sellCreditMarket(market, {
 *   lender: "0x…",
 *   creditPositionId: ethers.constants.MaxUint256,
 *   amount: 100n,
 *   maturity: 1893456000n,
 *   deadline: sdk.helpers.deadline(60), // now + 60s
 *   maxAPR: ethers.constants.MaxUint256,
 *   exactAmountIn: false,
 *   collectionId: 0n,
 *   rateProvider: ethers.constants.AddressZero,
 * });
 * ```
 */
export default function deadline(seconds: number = 60): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + seconds);
}
