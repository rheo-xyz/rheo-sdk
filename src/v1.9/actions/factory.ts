/**
 * SizeFactory actions exposed on the v1.9 factory ABI. Unlike market
 * actions these are not scoped to a particular market contract — they
 * target the factory directly, which is the single onchain entry point
 * across all v1.7/v1.8/v1.9 markets.
 *
 * @module v1.9/actions/factory
 */

import { BigNumberish } from "ethers";
import { Address } from "../..";
import { CopyLimitOrderConfigStruct } from "../types/ethers-contracts/SizeFactory";

type FactoryFunctionName =
  | "subscribeToCollections"
  | "unsubscribeFromCollections"
  | "setAuthorization"
  | "revokeAllAuthorizations"
  | "setUserCollectionCopyLimitOrderConfigs";

/**
 * Tagged description of a single factory call. Unlike
 * {@link MarketOperation} there is no `market` field because the target is
 * always the SizeFactory itself. `params` is a tuple whose concrete shape
 * depends on `functionName`.
 */
export type FactoryOperation = {
  /** SizeFactory function to invoke. */
  functionName: FactoryFunctionName;
  /**
   * Positional ABI arguments for `functionName`:
   * - `subscribeToCollections` / `unsubscribeFromCollections`: `BigNumberish[]`
   *   of collection IDs.
   * - `setAuthorization`: `[operator, bitmap]`.
   * - `revokeAllAuthorizations`: `[]` (no args).
   * - `setUserCollectionCopyLimitOrderConfigs`:
   *   `[collectionId, copyLoanOfferConfig, copyBorrowOfferConfig]`.
   */
  params:
    | BigNumberish[]
    | [Address, BigNumberish]
    | [BigNumberish, CopyLimitOrderConfigStruct, CopyLimitOrderConfigStruct]
    | [];
};

/**
 * Stateless factory for {@link FactoryOperation} objects. Accessed through
 * `sdk.factory` on a v1.9-configured SDK.
 */
export class FactoryActions {
  constructor() {}

  /**
   * Subscribes the caller to a list of collection IDs. Subscribed
   * collections supply a curated set of rate providers whose offers the
   * user can route through when taking market orders
   * (`buy/sellCreditMarket` with `collectionId !== 0`).
   *
   * @param params - Array of collection IDs to subscribe to.
   * @returns A {@link FactoryOperation} targeting `subscribeToCollections`.
   *
   * @example
   * ```ts
   * sdk.factory.subscribeToCollections([1n, 42n]);
   * ```
   */
  subscribeToCollections(params: BigNumberish[]): FactoryOperation {
    return {
      functionName: "subscribeToCollections",
      params,
    };
  }

  /**
   * Removes the caller's subscription to one or more collections. After
   * unsubscribing, taker orders through those collections will fail unless
   * the user resubscribes.
   *
   * @param params - Array of collection IDs to unsubscribe from.
   * @returns A {@link FactoryOperation} targeting `unsubscribeFromCollections`.
   *
   * @example
   * ```ts
   * sdk.factory.unsubscribeFromCollections([42n]);
   * ```
   */
  unsubscribeFromCollections(params: BigNumberish[]): FactoryOperation {
    return {
      functionName: "unsubscribeFromCollections",
      params,
    };
  }

  /**
   * Sets the action bitmap authorizing `operator` to call market functions
   * on the caller's behalf via `callMarket`.
   *
   * @remarks
   * **Callers rarely invoke this directly** — `sdk.tx.build` automatically
   * wraps any batch containing market operations with a matching
   * `setAuthorization(..., bitmap)` at the start and
   * `setAuthorization(..., 0)` at the end. Use this method only for custom
   * flows where you want a standing authorization that persists across
   * transactions. Emitting it alongside market operations in a single
   * `build` call will double-grant; let the builder handle it.
   *
   * Build the bitmap with {@link Authorization.getActionsBitmap}.
   *
   * @param params - `[operator, bitmap]`.
   * @returns A {@link FactoryOperation} targeting `setAuthorization`.
   *
   * @example
   * ```ts
   * sdk.factory.setAuthorization([
   *   sdk.sizeFactory,
   *   sdk.helpers.Authorization.getActionsBitmap([
   *     sdk.helpers.Authorization.Action.DEPOSIT,
   *   ]),
   * ]);
   * ```
   */
  setAuthorization(params: [Address, BigNumberish]): FactoryOperation {
    return {
      functionName: "setAuthorization",
      params,
    };
  }

  /**
   * Clears every authorization the caller has granted, across all
   * operators. Use as a defensive reset — for example after rotating a
   * delegated wallet.
   *
   * @returns A {@link FactoryOperation} targeting `revokeAllAuthorizations`.
   *
   * @example
   * ```ts
   * sdk.factory.revokeAllAuthorizations();
   * ```
   */
  revokeAllAuthorizations(): FactoryOperation {
    return {
      functionName: "revokeAllAuthorizations",
      params: [],
    };
  }

  /**
   * Overrides the caller's copy-limit-order configuration for a single
   * collection, taking precedence over the market-level configs set via
   * `sdk.market.setCopyLimitOrderConfigs` when orders route through that
   * collection.
   *
   * @param params - `[collectionId, copyLoanOfferConfig, copyBorrowOfferConfig]`.
   *   Use the presets in `sdk.constants` — {@link FullCopy} / {@link NoCopy}
   *   / {@link NullCopy} — unless a custom range is needed.
   * @returns A {@link FactoryOperation} targeting
   *   `setUserCollectionCopyLimitOrderConfigs`.
   *
   * @example
   * ```ts
   * sdk.factory.setUserCollectionCopyLimitOrderConfigs([
   *   42n, // collectionId
   *   sdk.constants.FullCopy,
   *   sdk.constants.NoCopy,
   * ]);
   * ```
   */
  setUserCollectionCopyLimitOrderConfigs(
    params: [
      BigNumberish,
      CopyLimitOrderConfigStruct,
      CopyLimitOrderConfigStruct,
    ],
  ): FactoryOperation {
    return {
      functionName: "setUserCollectionCopyLimitOrderConfigs",
      params,
    };
  }
}
