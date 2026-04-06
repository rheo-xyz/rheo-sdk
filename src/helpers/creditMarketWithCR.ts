import { BigNumberish } from "ethers";
import { Address } from "../index";

interface MarketOperation<T = unknown> {
  market: Address;
  functionName: string;
  params: T;
  value?: BigNumberish;
}

function setUserConfigurationOp(
  market: Address,
  openingLimitBorrowCR: BigNumberish,
): MarketOperation {
  return {
    market,
    functionName: "setUserConfiguration",
    params: {
      openingLimitBorrowCR,
      allCreditPositionsForSaleDisabled: false,
      creditPositionIdsForSale: false,
      creditPositionIds: [],
    },
  };
}

export function buyCreditMarketWithCR<T>(
  market: Address,
  params: T,
  openingLimitBorrowCR: BigNumberish,
): MarketOperation[] {
  return [
    setUserConfigurationOp(market, 0),
    {
      market,
      functionName: "buyCreditMarket",
      params,
    },
    setUserConfigurationOp(market, openingLimitBorrowCR),
  ];
}

export function sellCreditMarketWithCR<T>(
  market: Address,
  params: T,
  openingLimitBorrowCR: BigNumberish,
): MarketOperation[] {
  return [
    setUserConfigurationOp(market, 0),
    {
      market,
      functionName: "sellCreditMarket",
      params,
    },
    setUserConfigurationOp(market, openingLimitBorrowCR),
  ];
}
