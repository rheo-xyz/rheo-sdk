import { describe, expect, test } from "@jest/globals";
import { ethers } from "ethers";
import SDK from "../src";
import SizeABI from "../src/fm-v1.8/abi/Size.json";
import ErrorsABI from "../src/fm-v1.8/abi/Errors.json";

describe("@rheo/sdk FM-v1.8", () => {
  const sizeFactory = "0x000000000000000000000000000000000000ffff";
  const market = "0x0000000000000000000000000000000000000123";
  const alice = "0x0000000000000000000000000000000000010000";

  const ISize = new ethers.utils.Interface(SizeABI.abi);
  const IErrors = new ethers.utils.Interface(ErrorsABI.abi);

  test("builds fixed-maturity buyCreditLimit", () => {
    const sdk = new SDK({
      sizeFactory,
      version: "FM-v1.8",
    });

    const maturities = [1893456000n, 1893542400n];
    const aprs = [500n, 600n];

    const txs = sdk.tx.build(alice, [
      sdk.market.buyCreditLimit(market, {
        maturities,
        aprs,
      }),
    ]);

    expect(txs[0].target).toBe(market);
    expect(txs[0].data).toBe(
      ISize.encodeFunctionData("buyCreditLimit", [{ maturities, aprs }]),
    );
  });

  test("builds buyCreditMarket with maturity", () => {
    const sdk = new SDK({
      sizeFactory,
      version: "FM-v1.8",
    });

    const params = {
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

    const txs = sdk.tx.build(alice, [sdk.market.buyCreditMarket(market, params)]);

    expect(txs[0].target).toBe(market);
    expect(txs[0].data).toBe(
      ISize.encodeFunctionData("buyCreditMarket", [params]),
    );
  });

  test("removes liquidateWithReplacement from interface", () => {
    expect(() => ISize.getFunction("liquidateWithReplacement")).toThrow();
  });

  test("decodes INVALID_MATURITY error", () => {
    const sdk = new SDK({
      sizeFactory,
      version: "FM-v1.8",
    });

    const errorData = IErrors.encodeErrorResult("INVALID_MATURITY", [123n]);
    expect(sdk.decode.error(errorData)).toBe("INVALID_MATURITY(123)");
  });

  test("market actions omit liquidateWithReplacement", () => {
    const sdk = new SDK({
      sizeFactory,
      version: "FM-v1.8",
    });

    expect("liquidateWithReplacement" in sdk.market).toBe(false);
  });
});
