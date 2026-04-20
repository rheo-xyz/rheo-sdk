/**
 * Internal wrappers that lift a direct market {@link MarketOperation} into
 * its `*OnBehalfOf` counterpart — the form the SizeFactory consumes when
 * executing a delegated call through `callMarket`. Produced and consumed
 * by {@link TxBuilder.build}; **not part of the public SDK surface**.
 *
 * @module v1.9/actions/onBehalfOf
 * @internal
 */

import { Action, FunctionNameToAction } from "../../Authorization";
import { Address } from "../../index";
import {
  DepositOnBehalfOfParamsStruct,
  SetUserConfigurationOnBehalfOfParamsStruct,
  SetCopyLimitOrderConfigsOnBehalfOfParamsStruct,
  SelfLiquidateOnBehalfOfParamsStruct,
  SellCreditMarketOnBehalfOfParamsStruct,
  SellCreditLimitOnBehalfOfParamsStruct,
  BuyCreditMarketOnBehalfOfParamsStruct,
  BuyCreditLimitOnBehalfOfParamsStruct,
  WithdrawOnBehalfOfParamsStruct,
  DepositParamsStruct,
  WithdrawParamsStruct,
  BuyCreditLimitParamsStruct,
  BuyCreditMarketParamsStruct,
  SellCreditLimitParamsStruct,
  SellCreditMarketParamsStruct,
  SelfLiquidateParamsStruct,
  SetUserConfigurationParamsStruct,
  SetCopyLimitOrderConfigsParamsStruct,
  SetVaultOnBehalfOfParamsStruct,
  SetVaultParamsStruct,
} from "../types/ethers-contracts/Rheo";
import {
  MarketFunctionName,
  MarketOperation,
  MarketOperationParams,
} from "./market";

/** @internal Union of every v1.9 `*OnBehalfOf` function name. */
export type OnBehalfOfFunctionName =
  | "depositOnBehalfOf"
  | "withdrawOnBehalfOf"
  | "buyCreditLimitOnBehalfOf"
  | "buyCreditMarketOnBehalfOf"
  | "sellCreditLimitOnBehalfOf"
  | "sellCreditMarketOnBehalfOf"
  | "selfLiquidateOnBehalfOf"
  | "setUserConfigurationOnBehalfOf"
  | "setCopyLimitOrderConfigsOnBehalfOf"
  | "setVaultOnBehalfOf";

/** @internal Direct-to-delegated function name mapping. */
export const MarketFunctionNameToOnBehalfOfFunctionName: Record<
  Exclude<MarketFunctionName, "repay" | "liquidate">,
  OnBehalfOfFunctionName
> = {
  deposit: "depositOnBehalfOf",
  withdraw: "withdrawOnBehalfOf",
  buyCreditLimit: "buyCreditLimitOnBehalfOf",
  buyCreditMarket: "buyCreditMarketOnBehalfOf",
  sellCreditLimit: "sellCreditLimitOnBehalfOf",
  sellCreditMarket: "sellCreditMarketOnBehalfOf",
  selfLiquidate: "selfLiquidateOnBehalfOf",
  setUserConfiguration: "setUserConfigurationOnBehalfOf",
  setCopyLimitOrderConfigs: "setCopyLimitOrderConfigsOnBehalfOf",
  setVault: "setVaultOnBehalfOf",
};

/** @internal Union of every v1.9 `*OnBehalfOf` parameter struct. */
export type OnBehalfOfOperationParams =
  | DepositOnBehalfOfParamsStruct
  | WithdrawOnBehalfOfParamsStruct
  | BuyCreditLimitOnBehalfOfParamsStruct
  | BuyCreditMarketOnBehalfOfParamsStruct
  | SellCreditLimitOnBehalfOfParamsStruct
  | SellCreditMarketOnBehalfOfParamsStruct
  | SelfLiquidateOnBehalfOfParamsStruct
  | SetUserConfigurationOnBehalfOfParamsStruct
  | SetCopyLimitOrderConfigsOnBehalfOfParamsStruct
  | SetVaultOnBehalfOfParamsStruct;

/**
 * @internal Tagged delegated operation. `action` is the {@link Action} bit
 * {@link TxBuilder} must include in the authorization bitmap wrapping the
 * call.
 */
export type OnBehalfOfOperation<
  T extends OnBehalfOfOperationParams = OnBehalfOfOperationParams,
> = {
  market: Address;
  functionName: OnBehalfOfFunctionName;
  action: Action;
  externalParams: T;
};

/** @internal Wraps a `deposit` operation as `depositOnBehalfOf`. */
export function depositOnBehalfOf(
  deposit: MarketOperation<DepositParamsStruct>,
  onBehalfOf: Address,
): OnBehalfOfOperation<DepositOnBehalfOfParamsStruct> {
  return {
    market: deposit.market,
    functionName: "depositOnBehalfOf",
    action: Action.DEPOSIT,
    externalParams: {
      params: deposit.params,
      onBehalfOf,
    },
  };
}

/** @internal Wraps a `withdraw` operation as `withdrawOnBehalfOf`. */
export function withdrawOnBehalfOf(
  withdraw: MarketOperation<WithdrawParamsStruct>,
  onBehalfOf: Address,
): OnBehalfOfOperation<WithdrawOnBehalfOfParamsStruct> {
  return {
    market: withdraw.market,
    functionName: "withdrawOnBehalfOf",
    action: Action.WITHDRAW,
    externalParams: {
      params: withdraw.params,
      onBehalfOf,
    },
  };
}

/** @internal Wraps a `buyCreditLimit` operation as `buyCreditLimitOnBehalfOf`. */
export function buyCreditLimitOnBehalfOf(
  buyCreditLimit: MarketOperation<BuyCreditLimitParamsStruct>,
  onBehalfOf: Address,
): OnBehalfOfOperation<BuyCreditLimitOnBehalfOfParamsStruct> {
  return {
    market: buyCreditLimit.market,
    functionName: "buyCreditLimitOnBehalfOf",
    action: Action.BUY_CREDIT_LIMIT,
    externalParams: {
      params: buyCreditLimit.params,
      onBehalfOf,
    },
  };
}

/**
 * @internal Wraps a `buyCreditMarket` operation as
 * `buyCreditMarketOnBehalfOf`. `recipient` defaults to `onBehalfOf`.
 */
export function buyCreditMarketOnBehalfOf(
  params: MarketOperation<BuyCreditMarketParamsStruct>,
  onBehalfOf: Address,
  recipient?: Address,
): OnBehalfOfOperation<BuyCreditMarketOnBehalfOfParamsStruct> {
  return {
    market: params.market,
    functionName: "buyCreditMarketOnBehalfOf",
    action: Action.BUY_CREDIT_MARKET,
    externalParams: {
      params: params.params,
      onBehalfOf,
      recipient: recipient ?? onBehalfOf,
    },
  };
}

/** @internal Wraps a `sellCreditLimit` operation as `sellCreditLimitOnBehalfOf`. */
export function sellCreditLimitOnBehalfOf(
  sellCreditLimit: MarketOperation<SellCreditLimitParamsStruct>,
  onBehalfOf: Address,
): OnBehalfOfOperation<SellCreditLimitOnBehalfOfParamsStruct> {
  return {
    market: sellCreditLimit.market,
    functionName: "sellCreditLimitOnBehalfOf",
    action: Action.SELL_CREDIT_LIMIT,
    externalParams: {
      params: sellCreditLimit.params,
      onBehalfOf,
    },
  };
}

/**
 * @internal Wraps a `sellCreditMarket` operation as
 * `sellCreditMarketOnBehalfOf`. `recipient` defaults to `onBehalfOf`.
 */
export function sellCreditMarketOnBehalfOf(
  params: MarketOperation<SellCreditMarketParamsStruct>,
  onBehalfOf: Address,
  recipient?: Address,
): OnBehalfOfOperation<SellCreditMarketOnBehalfOfParamsStruct> {
  return {
    market: params.market,
    functionName: "sellCreditMarketOnBehalfOf",
    action: Action.SELL_CREDIT_MARKET,
    externalParams: {
      params: params.params,
      onBehalfOf,
      recipient: recipient ?? onBehalfOf,
    },
  };
}

/**
 * @internal Wraps a `selfLiquidate` operation as
 * `selfLiquidateOnBehalfOf`. `recipient` defaults to `onBehalfOf`.
 */
export function selfLiquidateOnBehalfOf(
  selfLiquidate: MarketOperation<SelfLiquidateParamsStruct>,
  onBehalfOf: Address,
  recipient?: Address,
): OnBehalfOfOperation<SelfLiquidateOnBehalfOfParamsStruct> {
  return {
    market: selfLiquidate.market,
    functionName: "selfLiquidateOnBehalfOf",
    action: Action.SELF_LIQUIDATE,
    externalParams: {
      params: selfLiquidate.params,
      onBehalfOf,
      recipient: recipient ?? onBehalfOf,
    },
  };
}

/** @internal Wraps a `setUserConfiguration` operation as `setUserConfigurationOnBehalfOf`. */
export function setUserConfigurationOnBehalfOf(
  setUserConfiguration: MarketOperation<SetUserConfigurationParamsStruct>,
  onBehalfOf: Address,
): OnBehalfOfOperation<SetUserConfigurationOnBehalfOfParamsStruct> {
  return {
    market: setUserConfiguration.market,
    functionName: "setUserConfigurationOnBehalfOf",
    action: Action.SET_USER_CONFIGURATION,
    externalParams: {
      params: setUserConfiguration.params,
      onBehalfOf,
    },
  };
}

/** @internal Wraps a `setCopyLimitOrderConfigs` operation as `setCopyLimitOrderConfigsOnBehalfOf`. */
export function setCopyLimitOrderConfigsOnBehalfOf(
  setCopyLimitOrderConfigs: MarketOperation<SetCopyLimitOrderConfigsParamsStruct>,
  onBehalfOf: Address,
): OnBehalfOfOperation<SetCopyLimitOrderConfigsOnBehalfOfParamsStruct> {
  return {
    market: setCopyLimitOrderConfigs.market,
    functionName: "setCopyLimitOrderConfigsOnBehalfOf",
    action: Action.SET_COPY_LIMIT_ORDER_CONFIGS,
    externalParams: {
      params: setCopyLimitOrderConfigs.params,
      onBehalfOf,
    },
  };
}

/** @internal Wraps a `setVault` operation as `setVaultOnBehalfOf`. */
export function setVaultOnBehalfOf(
  setVault: MarketOperation<SetVaultParamsStruct>,
  onBehalfOf: Address,
): OnBehalfOfOperation<SetVaultOnBehalfOfParamsStruct> {
  return {
    market: setVault.market,
    functionName: "setVaultOnBehalfOf",
    action: Action.SET_VAULT,
    externalParams: {
      params: setVault.params,
      onBehalfOf,
    },
  };
}

/**
 * @internal Dynamic dispatcher: given a market function name and its
 * params, returns the matching {@link OnBehalfOfOperation}. Returns
 * `undefined` if the function has no delegated variant (e.g. legacy
 * functions excluded from the mapping). Used by {@link TxBuilder.build} to
 * convert each user-supplied {@link MarketOperation} into the form the
 * SizeFactory's `callMarket` path expects.
 */
export function onBehalfOfOperation(
  market: Address,
  functionName: MarketFunctionName,
  params: MarketOperationParams,
  onBehalfOf: Address,
  recipient?: Address,
): OnBehalfOfOperation<OnBehalfOfOperationParams> | undefined {
  const onBehalfOfFunctionName: OnBehalfOfFunctionName | undefined =
    MarketFunctionNameToOnBehalfOfFunctionName[
      functionName as keyof typeof MarketFunctionNameToOnBehalfOfFunctionName
    ];
  if (!onBehalfOfFunctionName) {
    return undefined;
  } else {
    return {
      market,
      functionName: onBehalfOfFunctionName,
      action: FunctionNameToAction[functionName],
      externalParams: {
        params,
        onBehalfOf,
        recipient: recipient ?? onBehalfOf,
      } as OnBehalfOfOperationParams,
    };
  }
}
