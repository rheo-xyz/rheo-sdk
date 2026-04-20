/**
 * Authorization bitmap utilities for delegated execution through the
 * `SizeFactory`. Every onchain market function that can be invoked via the
 * factory's `onBehalfOf` flow maps to a bit position in the {@link Action}
 * enum; a call site authorizes a set of actions by setting the corresponding
 * bits in an {@link ActionsBitmap} and clears them after the call returns.
 *
 * `TxBuilder.build` sets up and tears down the bitmap automatically — callers
 * rarely need to construct one by hand. These helpers are exposed so that
 * tooling (decoders, tests, custom flows) can inspect or produce the same
 * bitmaps the contracts expect.
 *
 * @module Authorization
 */

// the order is important
/**
 * Onchain action each bit of an {@link ActionsBitmap} represents. Bit
 * position equals the enum value, so enum ordering is load-bearing — do not
 * reorder or insert entries in the middle, or existing bitmaps will be
 * reinterpreted incorrectly by the contracts.
 *
 * Only entries with a corresponding market function appear in
 * {@link ActionToFunctionName}; `NUMBER_OF_ACTIONS` and
 * `MANAGE_COLLECTION_SUBSCRIPTIONS` are structural.
 */
export enum Action {
  /** Bit 0 — `deposit` market function. */
  DEPOSIT,
  /** Bit 1 — `withdraw` market function. */
  WITHDRAW,
  /** Bit 2 — `buyCreditLimit` (place resting loan offer). */
  BUY_CREDIT_LIMIT,
  /** Bit 3 — `sellCreditLimit` (place resting borrow offer). */
  SELL_CREDIT_LIMIT,
  /** Bit 4 — `buyCreditMarket` (taker side of a borrow offer). */
  BUY_CREDIT_MARKET,
  /** Bit 5 — `sellCreditMarket` (taker side of a loan offer). */
  SELL_CREDIT_MARKET,
  /** Bit 6 — `selfLiquidate` a creditor position that is underwater. */
  SELF_LIQUIDATE,
  /** Bit 7 — `compensate` (swap two credit positions, legacy). */
  COMPENSATE,
  /** Bit 8 — `setUserConfiguration` (per-user borrow CR, sale flags, …). */
  SET_USER_CONFIGURATION,
  /** Bit 9 — `setCopyLimitOrderConfigs`. Renamed in v1.8 from the v1.7 `copyLimitOrders`. */
  SET_COPY_LIMIT_ORDER_CONFIGS, // renamed in v1.8
  /** Bit 10 — `setVault`. Added in v1.8 alongside ERC-4626 vault routing. */
  SET_VAULT, // added in v1.8
  /** Bit 11 — collection subscribe/unsubscribe on the factory. Added in v1.8. */
  MANAGE_COLLECTION_SUBSCRIPTIONS, // added in v1.8
  // add more actions here
  /** Sentinel equal to the total action count — used to bound `isValid` and iteration. */
  NUMBER_OF_ACTIONS,
}

type AvailableActions = Exclude<
  Action,
  Action.NUMBER_OF_ACTIONS | Action.MANAGE_COLLECTION_SUBSCRIPTIONS
>;

/**
 * Maps each per-market {@link Action} to the Solidity function name it
 * authorizes. `MANAGE_COLLECTION_SUBSCRIPTIONS` and `NUMBER_OF_ACTIONS` are
 * excluded because they do not correspond to a single market function.
 */
export const ActionToFunctionName: Record<AvailableActions, string> = {
  [Action.DEPOSIT]: "deposit",
  [Action.WITHDRAW]: "withdraw",
  [Action.BUY_CREDIT_LIMIT]: "buyCreditLimit",
  [Action.SELL_CREDIT_LIMIT]: "sellCreditLimit",
  [Action.BUY_CREDIT_MARKET]: "buyCreditMarket",
  [Action.SELL_CREDIT_MARKET]: "sellCreditMarket",
  [Action.SELF_LIQUIDATE]: "selfLiquidate",
  [Action.COMPENSATE]: "compensate",
  [Action.SET_USER_CONFIGURATION]: "setUserConfiguration",
  [Action.SET_COPY_LIMIT_ORDER_CONFIGS]: "setCopyLimitOrderConfigs",
  [Action.SET_VAULT]: "setVault",
};

/**
 * Inverse of {@link ActionToFunctionName}. Looking up a market function name
 * yields the {@link Action} whose bit must be set to authorize a delegated
 * call to that function.
 */
export const FunctionNameToAction: Record<string, AvailableActions> =
  Object.fromEntries(
    Object.entries(ActionToFunctionName).map(([action, functionName]) => [
      functionName,
      Number(action),
    ]),
  ) as Record<string, AvailableActions>;

/**
 * Packed bitmap of authorized {@link Action}s, stored as a `bigint` matching
 * the `uint256` the onchain `setAuthorization` function expects. Bit `i` is
 * set when the action with value `i` is authorized.
 */
export type ActionsBitmap = bigint;

/**
 * Coerces an {@link ActionsBitmap} to its underlying `bigint`. Provided for
 * API symmetry — the type alias is already a `bigint`, so this is an
 * identity function.
 *
 * @param actionsBitmap - The bitmap to unwrap.
 * @returns The bitmap as a plain `bigint`.
 */
export const toBigInt = (actionsBitmap: ActionsBitmap): bigint => actionsBitmap;

/**
 * Returns the empty authorization bitmap (no actions authorized). Passing
 * this to `setAuthorization` revokes all per-action grants.
 *
 * @returns `0n` as an {@link ActionsBitmap}.
 */
export const nullActionsBitmap = (): ActionsBitmap => 0n;

/**
 * Checks whether a bitmap is within the range the contracts will accept. A
 * bitmap is valid if it uses only bit positions `0..NUMBER_OF_ACTIONS - 1`;
 * any higher bit indicates an unknown action and is rejected onchain.
 *
 * @param actionsBitmap - The bitmap to validate.
 * @returns `true` if every set bit corresponds to a known {@link Action}.
 */
export const isValid = (actionsBitmap: ActionsBitmap): boolean => {
  const maxValidBitmap = (1n << BigInt(Action.NUMBER_OF_ACTIONS)) - 1n;
  return toBigInt(actionsBitmap) <= maxValidBitmap;
};

/**
 * Tests whether a single {@link Action} is authorized in `actionsBitmap`.
 *
 * @param actionsBitmap - The bitmap to inspect.
 * @param action - The action to check.
 * @returns `true` when the bit at position `action` is set.
 */
export const isActionSet = (
  actionsBitmap: ActionsBitmap,
  action: Action,
): boolean => (toBigInt(actionsBitmap) & (1n << BigInt(action))) !== 0n;

/**
 * Computes the {@link ActionsBitmap} that authorizes `actionOrActions`.
 *
 * @remarks
 * Accepts either a single {@link Action} or an array. When given an array,
 * the resulting bitmap has one bit set for each entry; duplicate actions are
 * idempotent. When given a single action, the result has exactly one bit
 * set. `TxBuilder.build` calls this internally to build the bitmap that
 * wraps a batch of delegated market operations.
 *
 * @param actionOrActions - One action or an array of actions to authorize.
 * @returns The packed bitmap as an {@link ActionsBitmap}.
 *
 * @example
 * ```ts
 * import Authorization, { Action } from "@rheo/sdk/dist/Authorization";
 *
 * const bitmap = Authorization.getActionsBitmap([
 *   Action.DEPOSIT,
 *   Action.BUY_CREDIT_LIMIT,
 * ]);
 * // bitmap === 0b0000_0000_0000_0101n === 5n
 * ```
 */
export function getActionsBitmap(
  actionOrActions: Action | Action[],
): ActionsBitmap {
  // Check if the argument is an array
  if (Array.isArray(actionOrActions)) {
    const actions = actionOrActions;
    const combineBitmaps = (acc: bigint, action: Action): bigint =>
      acc | (1n << BigInt(action));

    return actions.reduce(combineBitmaps, 0n);
  } else {
    // Single action case
    const action = actionOrActions;
    return 1n << BigInt(action);
  }
}

/**
 * Aggregate namespace bundling the {@link Action} enum and all bitmap
 * helpers. Re-exported as `sdk.helpers.Authorization` so consumers can reach
 * authorization utilities without importing individual symbols.
 */
export const Authorization = {
  Action,
  toBigInt,
  nullActionsBitmap,
  isValid,
  isActionSet,
  getActionsBitmap,
};

export default Authorization;
