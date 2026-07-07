/**
 * Rheo (v1.9) market actions. Each method on {@link MarketActions} is a pure
 * constructor — it returns a tagged {@link MarketOperation} object but has
 * no side effects. The resulting operations are fed to
 * `sdk.tx.build(onBehalfOf, ops)`, which encodes them into a single
 * SizeFactory multicall (with automatic authorization wrapping when any op
 * targets a market).
 *
 * Compared to v1.8/v1.7 this version drops `liquidateWithReplacement` and
 * uses `maturity` (absolute unix seconds) in place of the v1.8 `tenor` on
 * market-order params. Limit orders supply parallel `maturities[]` /
 * `aprs[]` arrays for fixed-maturity offers.
 *
 * @module v1.9/actions/market
 */

import { BigNumberish } from "ethers";
import { Address } from "../../index";
import {
  DepositParamsStruct,
  WithdrawParamsStruct,
  BuyCreditLimitParamsStruct,
  BuyCreditMarketParamsStruct,
  SellCreditLimitParamsStruct,
  SellCreditMarketParamsStruct,
  SelfLiquidateParamsStruct,
  SetUserConfigurationParamsStruct,
  SetCopyLimitOrderConfigsParamsStruct,
  SetVaultParamsStruct,
  RepayParamsStruct,
  ClaimParamsStruct,
  LiquidateParamsStruct,
  CompensateParamsStruct,
} from "../types/ethers-contracts/Rheo";

/**
 * Union of every market function name exposed by the v1.9 ABI. Used as the
 * discriminator on {@link MarketOperation}.
 */
export type MarketFunctionName =
  | "deposit"
  | "withdraw"
  | "buyCreditLimit"
  | "buyCreditMarket"
  | "sellCreditLimit"
  | "sellCreditMarket"
  | "selfLiquidate"
  | "setUserConfiguration"
  | "setCopyLimitOrderConfigs"
  | "setVault"
  | "repay"
  | "claim"
  | "liquidate"
  | "compensate";

/**
 * Union of every parameter struct accepted by a v1.9 market function. The
 * concrete struct is determined by the sibling `functionName` on
 * {@link MarketOperation}.
 */
export type MarketOperationParams =
  | DepositParamsStruct
  | WithdrawParamsStruct
  | BuyCreditLimitParamsStruct
  | BuyCreditMarketParamsStruct
  | SellCreditLimitParamsStruct
  | SellCreditMarketParamsStruct
  | SelfLiquidateParamsStruct
  | SetUserConfigurationParamsStruct
  | SetCopyLimitOrderConfigsParamsStruct
  | SetVaultParamsStruct
  | RepayParamsStruct
  | ClaimParamsStruct
  | LiquidateParamsStruct
  | CompensateParamsStruct;

/**
 * Tagged description of a single v1.9 market call. Produced by every
 * {@link MarketActions} method and consumed by `TxBuilder.build`, which
 * routes it through the factory's `callMarket` wrapper (wrapping it in the
 * matching `*OnBehalfOf` variant with automatic authorization).
 *
 * @typeParam T - The specific parameter struct for the function. Defaults
 *   to the full {@link MarketOperationParams} union when unparameterized.
 */
export type MarketOperation<
  T extends MarketOperationParams = MarketOperationParams,
> = {
  /** Address of the Rheo market contract this call targets. */
  market: Address;
  /** Solidity function name to invoke on the market. */
  functionName: MarketFunctionName;
  /** Parameter struct matching `functionName`. */
  params: T;
  /** Native-asset value to forward with the call (e.g. wrapping ETH on deposit). */
  value?: BigNumberish;
};

/**
 * Stateless factory for v1.9 {@link MarketOperation} objects. Accessed
 * through `sdk.market` when the SDK is constructed with `version: "v1.9"`.
 */
export class MarketActions {
  constructor() {}

  /**
   * Deposits `amount` of `token` into the market, crediting the caller's
   * balance inside the market (not an onchain wallet transfer to `to`).
   *
   * @remarks
   * The ERC-20 allowance for the SizeFactory must already be in place — add
   * a leading `sdk.erc20.approve(token, sdk.sizeFactory, amount)` operation
   * if the user has not approved yet. The `value` parameter is only used
   * when depositing the native asset (e.g. ETH auto-wrapped to WETH on
   * deposit): pass the ETH amount as `value`, keep `token` as the wrapped
   * token address, and no ERC-20 approval is needed for that deposit.
   *
   * Because the SizeFactory route is nonpayable, a deposit carrying a
   * nonzero `value` is emitted by `sdk.tx.build` as its own stand-alone
   * transaction calling the market's payable `deposit` directly — placed
   * after any ERC-20 approvals and before the factory multicall holding
   * the rest of the batch. The signer supplies `msg.value`.
   *
   * @param market - Rheo market contract address.
   * @param params - `{ token, amount, to }` — `to` is the onchain identity
   *   whose market-internal balance gets credited.
   * @param value - Native-asset value to attach to the call (0 for pure
   *   ERC-20 deposits). @defaultValue `undefined`
   * @returns A {@link MarketOperation} tagged with `functionName: "deposit"`.
   *
   * @example
   * ```ts
   * // ERC-20 deposit
   * sdk.market.deposit(market, {
   *   token: "0x4200000000000000000000000000000000000006", // WETH
   *   amount: 100n,
   *   to: alice,
   * });
   *
   * // Native ETH deposit (auto-wrapped by the market)
   * sdk.market.deposit(
   *   market,
   *   { token: "0x4200000000000000000000000000000000000006", amount: 100n, to: alice },
   *   100n, // msg.value
   * );
   * ```
   */
  deposit(
    market: Address,
    params: DepositParamsStruct,
    value?: BigNumberish,
  ): MarketOperation<DepositParamsStruct> {
    return {
      market,
      functionName: "deposit",
      params,
      value,
    };
  }

  /**
   * Withdraws `amount` of `token` from the market's internal balance to
   * `to` as an onchain transfer.
   *
   * @param market - Rheo market contract address.
   * @param params - `{ token, amount, to }`. Set `amount: ethers.constants.MaxUint256`
   *   to withdraw the full balance.
   * @returns A {@link MarketOperation} tagged with `functionName: "withdraw"`.
   *
   * @example
   * ```ts
   * sdk.market.withdraw(market, {
   *   token: "0x4200000000000000000000000000000000000006",
   *   amount: ethers.constants.MaxUint256, // withdraw everything
   *   to: alice,
   * });
   * ```
   */
  withdraw(
    market: Address,
    params: WithdrawParamsStruct,
  ): MarketOperation<WithdrawParamsStruct> {
    return {
      market,
      functionName: "withdraw",
      params,
    };
  }

  /**
   * Places the caller's fixed-maturity **loan offer** (resting liquidity on
   * the buy-credit side). The order is expressed as two parallel arrays:
   * `maturities[i]` pairs with `aprs[i]` to define one fixed-maturity rate
   * curve point. Replaces any existing loan offer.
   *
   * @remarks
   * Use this when the user wants to *lend* at specific rates — takers match
   * against these orders by calling `sellCreditMarket`. To remove the
   * offer, pass empty arrays. `maturities` are absolute unix seconds.
   *
   * @param market - Rheo market contract address.
   * @param params - `{ maturities: BigNumberish[], aprs: BigNumberish[] }`
   *   where each array index is one (maturity, APR) point. Arrays must be
   *   the same length.
   * @returns A {@link MarketOperation} tagged with `functionName: "buyCreditLimit"`.
   *
   * @example
   * ```ts
   * sdk.market.buyCreditLimit(market, {
   *   maturities: [1893456000n, 1893542400n],
   *   aprs: [500n, 600n],
   * });
   * ```
   */
  buyCreditLimit(
    market: Address,
    params: BuyCreditLimitParamsStruct,
  ): MarketOperation<BuyCreditLimitParamsStruct> {
    return {
      market,
      functionName: "buyCreditLimit",
      params,
    };
  }

  /**
   * Taker side: **buys credit** from a specific `borrower`, matching an
   * existing resting borrow offer. Opens a new credit position for the
   * caller (as lender) unless `creditPositionId` points at an existing one
   * the caller has already bought into.
   *
   * @remarks
   * Pass `creditPositionId: ethers.constants.MaxUint256` to open a new
   * position. `minAPR` protects against rate slippage — the call reverts if
   * the matched rate is below it. `deadline` must be a future unix
   * timestamp; prefer `sdk.helpers.deadline(60)`. When `collectionId` is
   * `0`, the market does not route through a collection and `rateProvider`
   * should be `ethers.constants.AddressZero`.
   *
   * @param market - Rheo market contract address.
   * @param params - `{ borrower, creditPositionId, amount, maturity,
   *   deadline, minAPR, exactAmountIn, collectionId, rateProvider }`.
   *   - `maturity` is absolute unix seconds (not a tenor duration).
   *   - `exactAmountIn: true` spends exactly `amount`; `false` receives
   *     exactly `amount`.
   * @returns A {@link MarketOperation} tagged with `functionName: "buyCreditMarket"`.
   *
   * @example
   * ```ts
   * sdk.market.buyCreditMarket(market, {
   *   borrower: bob,
   *   creditPositionId: ethers.constants.MaxUint256, // open a new position
   *   amount: 1000n,
   *   maturity: 1893456000n,
   *   deadline: sdk.helpers.deadline(60),
   *   minAPR: 0n,
   *   exactAmountIn: true,
   *   collectionId: 0n,
   *   rateProvider: ethers.constants.AddressZero,
   * });
   * ```
   */
  buyCreditMarket(
    market: Address,
    params: BuyCreditMarketParamsStruct,
  ): MarketOperation<BuyCreditMarketParamsStruct> {
    return {
      market,
      functionName: "buyCreditMarket",
      params,
    };
  }

  /**
   * Places the caller's fixed-maturity **borrow offer** (resting liquidity
   * on the sell-credit side). Mirror of {@link buyCreditLimit}: takers
   * match by calling `buyCreditMarket`. Replaces any existing borrow offer.
   *
   * @param market - Rheo market contract address.
   * @param params - `{ maturities: BigNumberish[], aprs: BigNumberish[] }`
   *   — same shape as `buyCreditLimit`.
   * @returns A {@link MarketOperation} tagged with `functionName: "sellCreditLimit"`.
   *
   * @example
   * ```ts
   * sdk.market.sellCreditLimit(market, {
   *   maturities: [1893456000n],
   *   aprs: [700n],
   * });
   * ```
   */
  sellCreditLimit(
    market: Address,
    params: SellCreditLimitParamsStruct,
  ): MarketOperation<SellCreditLimitParamsStruct> {
    return {
      market,
      functionName: "sellCreditLimit",
      params,
    };
  }

  /**
   * Taker side: **sells credit** to a specific `lender`, matching an
   * existing resting loan offer. Mirror of {@link buyCreditMarket} — the
   * caller takes on debt to receive tokens now.
   *
   * @remarks
   * Pass `creditPositionId: ethers.constants.MaxUint256` for a new
   * position. `maxAPR` caps the interest rate (reverts on higher). See
   * {@link buyCreditMarket} for the rest of the param semantics.
   *
   * @param market - Rheo market contract address.
   * @param params - `{ lender, creditPositionId, amount, maturity,
   *   deadline, maxAPR, exactAmountIn, collectionId, rateProvider }`.
   * @returns A {@link MarketOperation} tagged with `functionName: "sellCreditMarket"`.
   *
   * @example
   * ```ts
   * sdk.market.sellCreditMarket(market, {
   *   lender: alice,
   *   creditPositionId: ethers.constants.MaxUint256,
   *   amount: 500n,
   *   maturity: 1893456000n,
   *   deadline: sdk.helpers.deadline(60),
   *   maxAPR: ethers.constants.MaxUint256,
   *   exactAmountIn: false,
   *   collectionId: 0n,
   *   rateProvider: ethers.constants.AddressZero,
   * });
   * ```
   */
  sellCreditMarket(
    market: Address,
    params: SellCreditMarketParamsStruct,
  ): MarketOperation<SellCreditMarketParamsStruct> {
    return {
      market,
      functionName: "sellCreditMarket",
      params,
    };
  }

  /**
   * Closes an underwater credit position owned by the caller, forfeiting
   * the credit in exchange for the debtor's collateral. Only valid when
   * the linked debt position is flagged self-liquidatable by the market.
   *
   * @param market - Rheo market contract address.
   * @param params - `{ creditPositionId }` — the lender-side position to
   *   burn.
   * @returns A {@link MarketOperation} tagged with `functionName: "selfLiquidate"`.
   *
   * @example
   * ```ts
   * sdk.market.selfLiquidate(market, { creditPositionId: 42n });
   * ```
   */
  selfLiquidate(
    market: Address,
    params: SelfLiquidateParamsStruct,
  ): MarketOperation<SelfLiquidateParamsStruct> {
    return {
      market,
      functionName: "selfLiquidate",
      params,
    };
  }

  /**
   * Updates per-user risk and marketplace settings on a market.
   *
   * @remarks
   * - `openingLimitBorrowCR` — minimum collateralization ratio (WAD scale)
   *   the user will accept when opening new borrow positions.
   * - `allCreditPositionsForSaleDisabled` — global kill-switch: when `true`,
   *   none of the user's credit positions are offered for sale regardless
   *   of other flags.
   * - `creditPositionIdsForSale` — if provided with `creditPositionIds`,
   *   marks only those IDs as for sale (`true`) or not (`false`).
   * - `creditPositionIds` — subset of IDs to apply the `creditPositionIdsForSale`
   *   flag to.
   *
   * @param market - Rheo market contract address.
   * @param params - `{ openingLimitBorrowCR, allCreditPositionsForSaleDisabled,
   *   creditPositionIdsForSale, creditPositionIds }`.
   * @returns A {@link MarketOperation} tagged with `functionName: "setUserConfiguration"`.
   *
   * @example
   * ```ts
   * sdk.market.setUserConfiguration(market, {
   *   openingLimitBorrowCR: 0n,
   *   allCreditPositionsForSaleDisabled: false,
   *   creditPositionIdsForSale: false,
   *   creditPositionIds: [],
   * });
   * ```
   */
  setUserConfiguration(
    market: Address,
    params: SetUserConfigurationParamsStruct,
  ): MarketOperation<SetUserConfigurationParamsStruct> {
    return {
      market,
      functionName: "setUserConfiguration",
      params,
    };
  }

  /**
   * Configures automated copying of another user's resting orders on this
   * market. Separate configs are supplied for loan offers (credit the user
   * buys) and borrow offers (credit the user sells).
   *
   * @remarks
   * Use the presets in `sdk.constants` — {@link FullCopy} mirrors the
   * source unchanged, {@link NoCopy} disables one side while leaving the
   * other intact, {@link NullCopy} is the neutral initializer. This method
   * only sets the **market-level** config; per-collection overrides are
   * set via `sdk.factory.setUserCollectionCopyLimitOrderConfigs`.
   *
   * @param market - Rheo market contract address.
   * @param params - `{ copyLoanOfferConfig, copyBorrowOfferConfig }`.
   * @returns A {@link MarketOperation} tagged with `functionName: "setCopyLimitOrderConfigs"`.
   *
   * @example
   * ```ts
   * sdk.market.setCopyLimitOrderConfigs(market, {
   *   copyLoanOfferConfig: sdk.constants.FullCopy,
   *   copyBorrowOfferConfig: sdk.constants.NoCopy,
   * });
   * ```
   */
  setCopyLimitOrderConfigs(
    market: Address,
    params: SetCopyLimitOrderConfigsParamsStruct,
  ): MarketOperation<SetCopyLimitOrderConfigsParamsStruct> {
    return {
      market,
      functionName: "setCopyLimitOrderConfigs",
      params,
    };
  }

  /**
   * Designates an ERC-4626 vault to route the user's market-internal
   * balances through. When `forfeitOldShares` is `false`, existing shares
   * are migrated to the new vault; when `true`, they are left behind and
   * only future flows land in the new vault.
   *
   * @param market - Rheo market contract address.
   * @param params - `{ vault, forfeitOldShares }`. Pass
   *   `ethers.constants.AddressZero` to unset the vault.
   * @returns A {@link MarketOperation} tagged with `functionName: "setVault"`.
   *
   * @example
   * ```ts
   * sdk.market.setVault(market, {
   *   vault: "0x…",
   *   forfeitOldShares: false,
   * });
   * ```
   */
  setVault(
    market: Address,
    params: SetVaultParamsStruct,
  ): MarketOperation<SetVaultParamsStruct> {
    return {
      market,
      functionName: "setVault",
      params,
    };
  }

  /**
   * Repays an outstanding debt position on behalf of `borrower`. Anyone may
   * repay — the caller funds the principal + interest owed from their own
   * market-internal balance.
   *
   * @param market - Rheo market contract address.
   * @param params - `{ debtPositionId, borrower }`.
   * @returns A {@link MarketOperation} tagged with `functionName: "repay"`.
   *
   * @example
   * ```ts
   * sdk.market.repay(market, {
   *   debtPositionId: 7n,
   *   borrower: bob,
   * });
   * ```
   */
  repay(
    market: Address,
    params: RepayParamsStruct,
  ): MarketOperation<RepayParamsStruct> {
    return {
      market,
      functionName: "repay",
      params,
    };
  }

  /**
   * Claims a matured credit position, transferring the underlying borrow
   * tokens from the market's internal balance to the position's current
   * lender.
   *
   * @param market - Rheo market contract address.
   * @param params - `{ creditPositionId }`.
   * @returns A {@link MarketOperation} tagged with `functionName: "claim"`.
   *
   * @example
   * ```ts
   * sdk.market.claim(market, { creditPositionId: 42n });
   * ```
   */
  claim(
    market: Address,
    params: ClaimParamsStruct,
  ): MarketOperation<ClaimParamsStruct> {
    return {
      market,
      functionName: "claim",
      params,
    };
  }

  /**
   * Liquidates an undercollateralized debt position. The caller pays the
   * position's outstanding debt and receives the underlying collateral plus
   * the liquidation reward.
   *
   * @remarks
   * `minimumCollateralProfit` protects the liquidator against unfavorable
   * settlement: the call reverts if the collateral payout (net of the debt
   * repaid) is below it. `deadline` must be a future unix timestamp; prefer
   * `sdk.helpers.deadline(60)`.
   *
   * @param market - Rheo market contract address.
   * @param params - `{ debtPositionId, minimumCollateralProfit, deadline }`.
   * @returns A {@link MarketOperation} tagged with `functionName: "liquidate"`.
   *
   * @example
   * ```ts
   * sdk.market.liquidate(market, {
   *   debtPositionId: 7n,
   *   minimumCollateralProfit: 0n,
   *   deadline: sdk.helpers.deadline(60),
   * });
   * ```
   */
  liquidate(
    market: Address,
    params: LiquidateParamsStruct,
  ): MarketOperation<LiquidateParamsStruct> {
    return {
      market,
      functionName: "liquidate",
      params,
    };
  }

  /**
   * Swaps credit between two positions the caller controls, repaying (part
   * of) the debt on `creditPositionWithDebtToRepayId` by forfeiting credit
   * from `creditPositionToCompensateId`.
   *
   * @param market - Rheo market contract address.
   * @param params - `{ creditPositionWithDebtToRepayId,
   *   creditPositionToCompensateId, amount }`. Pass
   *   `ethers.constants.MaxUint256` for `amount` to compensate the maximum
   *   available. Pass `ethers.constants.MaxUint256` for
   *   `creditPositionToCompensateId` to mint fresh credit instead of
   *   burning an existing position.
   * @returns A {@link MarketOperation} tagged with `functionName: "compensate"`.
   *
   * @example
   * ```ts
   * sdk.market.compensate(market, {
   *   creditPositionWithDebtToRepayId: 7n,
   *   creditPositionToCompensateId: 9n,
   *   amount: 500n,
   * });
   * ```
   */
  compensate(
    market: Address,
    params: CompensateParamsStruct,
  ): MarketOperation<CompensateParamsStruct> {
    return {
      market,
      functionName: "compensate",
      params,
    };
  }
}
