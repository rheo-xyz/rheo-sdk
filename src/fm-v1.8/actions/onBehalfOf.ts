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
} from "../types/ethers-contracts/Size";
import {
  MarketFunctionName,
  MarketOperation,
  MarketOperationParams,
} from "./market";

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

export type OnBehalfOfOperation<
  T extends OnBehalfOfOperationParams = OnBehalfOfOperationParams,
> = {
  market: Address;
  functionName: OnBehalfOfFunctionName;
  action: Action;
  externalParams: T;
};

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
