import { describe, expect, test } from "@jest/globals";
import { ethers } from "ethers";
import SDK from "../src";
import RheoABI from "../src/v1.9/abi/Rheo.json";
import SizeFactoryABI from "../src/v1.9/abi/SizeFactory.json";

describe("creditMarketWithCR helpers", () => {
  const sizeFactory =
    "0x000000000000000000000000000000000000ffff" as `0x${string}`;
  const market =
    "0x0000000000000000000000000000000000000123" as `0x${string}`;
  const alice =
    "0x0000000000000000000000000000000000010000" as `0x${string}`;

  const IRheo = new ethers.utils.Interface(RheoABI.abi);
  const ISizeFactory = new ethers.utils.Interface(SizeFactoryABI.abi);

  const sdk = new SDK({ sizeFactory, version: "v1.9" });

  const buyParams = {
    borrower: alice,
    creditPositionId: ethers.constants.MaxUint256,
    amount: 100n,
    maturity: 1893456000n,
    deadline: 1893457000n,
    minAPR: 0n,
    exactAmountIn: true,
    collectionId: 0,
    rateProvider: ethers.constants.AddressZero,
  };

  const sellParams = {
    lender: alice,
    creditPositionId: ethers.constants.MaxUint256,
    amount: 100n,
    maturity: 1893456000n,
    deadline: 1893457000n,
    maxAPR: ethers.constants.MaxUint256,
    exactAmountIn: false,
    collectionId: 0,
    rateProvider: ethers.constants.AddressZero,
  };

  test("buyCreditMarketWithCR returns 3 operations in correct order", () => {
    const ops = sdk.helpers.buyCreditMarketWithCR(market, buyParams, 1500000n);

    expect(ops).toHaveLength(3);
    expect(ops[0].functionName).toBe("setUserConfiguration");
    expect(ops[0].params).toEqual({
      openingLimitBorrowCR: 0,
      allCreditPositionsForSaleDisabled: false,
      creditPositionIdsForSale: false,
      creditPositionIds: [],
    });
    expect(ops[1].functionName).toBe("buyCreditMarket");
    expect(ops[1].params).toEqual(buyParams);
    expect(ops[2].functionName).toBe("setUserConfiguration");
    expect(ops[2].params).toEqual({
      openingLimitBorrowCR: 1500000n,
      allCreditPositionsForSaleDisabled: false,
      creditPositionIdsForSale: false,
      creditPositionIds: [],
    });
  });

  test("sellCreditMarketWithCR returns 3 operations in correct order", () => {
    const ops = sdk.helpers.sellCreditMarketWithCR(
      market,
      sellParams,
      1500000n,
    );

    expect(ops).toHaveLength(3);
    expect(ops[0].functionName).toBe("setUserConfiguration");
    expect(ops[0].params).toEqual({
      openingLimitBorrowCR: 0,
      allCreditPositionsForSaleDisabled: false,
      creditPositionIdsForSale: false,
      creditPositionIds: [],
    });
    expect(ops[1].functionName).toBe("sellCreditMarket");
    expect(ops[1].params).toEqual(sellParams);
    expect(ops[2].functionName).toBe("setUserConfiguration");
    expect(ops[2].params).toEqual({
      openingLimitBorrowCR: 1500000n,
      allCreditPositionsForSaleDisabled: false,
      creditPositionIdsForSale: false,
      creditPositionIds: [],
    });
  });

  test("buyCreditMarketWithCR builds valid multicall via tx.build", () => {
    const ops = sdk.helpers.buyCreditMarketWithCR(market, buyParams, 1500000n);
    const txs = sdk.tx.build(alice, ops as any);

    // Should produce a single sizeFactory multicall transaction
    expect(txs).toHaveLength(1);
    expect(txs[0].target).toBe(sizeFactory);

    // Decode the outer multicall
    const decoded = ISizeFactory.decodeFunctionData("multicall", txs[0].data);
    const datas = decoded[0] as string[];

    // Should contain: setAuthorization + callMarket (with inner multicall of 3 ops) + nullAuthorization
    expect(datas).toHaveLength(3);

    // First: setAuthorization
    const authFragment = ISizeFactory.getFunction("setAuthorization");
    expect(datas[0].startsWith(ISizeFactory.getSighash(authFragment))).toBe(
      true,
    );

    // Middle: callMarket wrapping inner multicall of 3 operations
    const callMarketFragment = ISizeFactory.getFunction("callMarket");
    expect(
      datas[1].startsWith(ISizeFactory.getSighash(callMarketFragment)),
    ).toBe(true);

    // Last: null setAuthorization
    expect(datas[2].startsWith(ISizeFactory.getSighash(authFragment))).toBe(
      true,
    );
  });

  test("sellCreditMarketWithCR builds valid multicall via tx.build", () => {
    const ops = sdk.helpers.sellCreditMarketWithCR(
      market,
      sellParams,
      1500000n,
    );
    const txs = sdk.tx.build(alice, ops as any);

    expect(txs).toHaveLength(1);
    expect(txs[0].target).toBe(sizeFactory);
  });

  test("all operations target the same market", () => {
    const ops = sdk.helpers.buyCreditMarketWithCR(market, buyParams, 1500000n);
    for (const op of ops) {
      expect(op.market).toBe(market);
    }
  });
});
