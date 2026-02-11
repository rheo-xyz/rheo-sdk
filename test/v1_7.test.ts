import { JSDOM } from "jsdom";
import { describe, expect, test, beforeAll } from "@jest/globals";
import SDK from "../src";
import { BigNumber, ethers } from "ethers";
import selector from "../src/helpers/selector";

describe("@sizecredit/sdk v1.7", () => {
  let window: any;
  let sdk: SDK<"v1.7">;

  const sizeFactory = "0x000000000000000000000000000000000000ffff";

  const alice = "0x0000000000000000000000000000000000011111";
  const bob = "0x0000000000000000000000000000000000022222";
  const charlie = "0x0000000000000000000000000000000000033333";

  const market1 = "0x0000000000000000000000000000000000000123";
  const market2 = "0x0000000000000000000000000000000000000456";

  const weth = "0x4200000000000000000000000000000000000006";
  const collateral2 = "0x0000000000000000000000000000000000007777";
  const usdc = "0x0000000000000000000000000000000000008888";

  beforeAll(() => {
    const html = "<!DOCTYPE html><html><body></body></html>";
    const dom = new JSDOM(html, { runScripts: "outside-only" });
    window = dom.window;
    window.ethereum = {};

    sdk = new SDK({
      version: "v1.7",
      sizeFactory,
    });
    window.sdk = sdk;
  });

  test("should expose size factory on window", () => {
    expect(window.sdk).toBeInstanceOf(Object);
  });

  test("size.tx.build should return converted output", async () => {
    const txs = sdk.tx.build(alice, [
      sdk.market.deposit(market1, {
        amount: "100",
        to: "0x0000000000000000000000000000000000001337",
        token: "0x4200000000000000000000000000000000000006",
      }),
    ]);
    expect(txs.length).toBe(1);
    expect(txs[0].target).toBe(market1);
    expect(txs[0].data).toBe(
      "0x0cf8542f000000000000000000000000420000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000640000000000000000000000000000000000000000000000000000000000001337",
    );
  });

  test("size.tx.build should accept BigInt", async () => {
    const txs = sdk.tx.build(alice, [
      sdk.market.deposit(market1, {
        amount: BigInt(100),
        to: "0x0000000000000000000000000000000000001337",
        token: "0x4200000000000000000000000000000000000006",
      }),
    ]);
    expect(txs.length).toBe(1);
    expect(txs[0].target).toBe(market1);
    expect(txs[0].data).toBe(
      "0x0cf8542f000000000000000000000000420000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000640000000000000000000000000000000000000000000000000000000000001337",
    );
  });

  test("size.tx.build should accept bigint", async () => {
    const txs = sdk.tx.build(alice, [
      sdk.market.deposit(market1, {
        amount: 100n,
        to: "0x0000000000000000000000000000000000001337",
        token: "0x4200000000000000000000000000000000000006",
      }),
    ]);
    expect(txs.length).toBe(1);
    expect(txs[0].target).toBe(market1);
    expect(txs[0].data).toBe(
      "0x0cf8542f000000000000000000000000420000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000640000000000000000000000000000000000000000000000000000000000001337",
    );
  });

  test("size.tx.build should accept BigNumber", async () => {
    const txs = sdk.tx.build(alice, [
      sdk.market.deposit(market1, {
        amount: BigNumber.from(100),
        to: "0x0000000000000000000000000000000000001337",
        token: "0x4200000000000000000000000000000000000006",
      }),
    ]);
    expect(txs.length).toBe(1);
    expect(txs[0].target).toBe(market1);
    expect(txs[0].data).not.toContain(alice);
    expect(txs[0].data).toBe(
      "0x0cf8542f000000000000000000000000420000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000640000000000000000000000000000000000000000000000000000000000001337",
    );
  });

  test("ideal flow but under v1.7", async () => {
    const txs = sdk.tx.build(alice, [
      sdk.market.setUserConfiguration(market2, {
        openingLimitBorrowCR: 0,
        allCreditPositionsForSaleDisabled: false,
        creditPositionIdsForSale: false,
        creditPositionIds: [],
      }),
      sdk.market.deposit(market1, {
        amount: BigNumber.from(100),
        to: "0x0000000000000000000000000000000000001337",
        token: "0x4200000000000000000000000000000000000006",
      }),
      sdk.market.copyLimitOrders(market1, {
        copyAddress: charlie,
        copyLoanOffer: sdk.constants.FullCopy,
        copyBorrowOffer: sdk.constants.FullCopy,
      }),
    ]);
    expect(txs.length).toBe(2);
    txs.forEach((tx) => {
      expect(tx.data).not.toContain(
        sdk.helpers.selector("setAuthorization(address,uint256)"),
      );
      expect(tx.data).not.toContain(
        sdk.helpers.selector(
          "depositOnBehalfOf(((address,uint256,address),address))",
        ),
      );
    });
    expect(txs[1].data).toContain(sdk.helpers.selector("multicall(bytes[])"));
    expect(txs[1].data).toContain(
      sdk.helpers.selector("deposit((address,uint256,address))"),
    );
    expect(txs[1].data).toContain(
      sdk.helpers.selector(
        "copyLimitOrders((address,(uint256,uint256,uint256,uint256,int256),(uint256,uint256,uint256,uint256,int256)))",
      ),
    );

    expect(txs[0].target).toBe(market2);
    expect(txs[1].target).toBe(market1);
  });

  test("v1.7 borrow from multiple markets", async () => {
    const wethAmount = 300n;
    const collateral2Amount = 400n;
    const usdcAmount = 100n;
    const tenor = 365n * 24n * 60n * 60n;
    const deadline = 1893456000n;

    const txs = sdk.tx.build(alice, [
      sdk.market.deposit(market1, {
        amount: wethAmount,
        to: alice,
        token: weth,
      }),
      sdk.market.sellCreditMarket(market1, {
        lender: bob,
        creditPositionId: ethers.constants.MaxUint256,
        amount: usdcAmount,
        tenor: tenor,
        deadline: deadline,
        maxAPR: ethers.constants.MaxUint256,
        exactAmountIn: false,
      }),
      sdk.market.deposit(market2, {
        amount: collateral2Amount,
        to: alice,
        token: collateral2,
      }),
      sdk.market.sellCreditMarket(market2, {
        lender: charlie,
        creditPositionId: ethers.constants.MaxUint256,
        amount: usdcAmount,
        tenor: tenor,
        deadline: deadline,
        maxAPR: ethers.constants.MaxUint256,
        exactAmountIn: false,
      }),
      sdk.market.withdraw(market1, {
        token: usdc,
        amount: ethers.constants.MaxUint256,
        to: alice,
      }),
    ]);

    expect(txs.length).toBe(3);
    txs.forEach((tx) => {
      expect(tx.data).not.toContain(
        sdk.helpers.selector("setAuthorization(address,uint256)"),
      );
      expect(tx.data).not.toContain(
        sdk.helpers.selector("callMarket(address,bytes)"),
      );
      expect(tx.data).not.toContain(
        sdk.helpers.selector(
          "depositOnBehalfOf(((address,uint256,address),address))",
        ),
      );
      expect(tx.data).not.toContain(
        sdk.helpers.selector(
          "sellCreditMarket((address,uint256,uint256,uint256,uint256,uint256,bool,uint256,address))",
        ),
      );
      expect(tx.data).not.toContain(
        sdk.helpers.selector(
          "withdrawOnBehalfOf(((address,uint256,address),address))",
        ),
      );
    });
  });

  test("approve + deposit + borrow + setAuthorization", async () => {
    const txs = sdk.tx.build(alice, [
      sdk.erc20.approve(usdc, market1, 100n),
      sdk.market.deposit(market1, {
        amount: 100n,
        to: alice,
        token: usdc,
      }),
      sdk.market.sellCreditMarket(market1, {
        lender: bob,
        creditPositionId: ethers.constants.MaxUint256,
        amount: 100n,
        tenor: 365n * 24n * 60n * 60n,
        deadline: 1893456000n,
        maxAPR: ethers.constants.MaxUint256,
        exactAmountIn: false,
      }),
      sdk.factory.setAuthorization([
        bob,
        sdk.helpers.Authorization.getActionsBitmap([
          sdk.helpers.Authorization.Action.DEPOSIT,
        ]),
      ]),
    ]);

    expect(txs.length).toBe(3);

    expect(txs[0].target).toBe(usdc);
    expect(txs[0].data).toContain(
      sdk.helpers.selector("approve(address,uint256)"),
    );
    expect(txs[1].target).toBe(market1);
    expect(txs[1].data).toContain(sdk.helpers.selector("multicall(bytes[])"));
    expect(txs[1].data).toContain(
      sdk.helpers.selector("deposit((address,uint256,address))"),
    );
    expect(txs[1].data).toContain(
      sdk.helpers.selector(
        "sellCreditMarket((address,uint256,uint256,uint256,uint256,uint256,bool))",
      ),
    );
    expect(txs[2].target).toBe(sizeFactory);
    expect(txs[2].data).toContain(
      sdk.helpers.selector("setAuthorization(address,uint256)"),
    );
    expect(txs[2].data).toEqual(
      "0x91c769ce00000000000000000000000000000000000000000000000000000000000222220000000000000000000000000000000000000000000000000000000000000001",
    );
  });

  test("deposit with value then borrow", async () => {
    const value = ethers.utils.parseEther("0.1");
    const txs = sdk.tx.build(alice, [
      sdk.market.deposit(
        market1,
        {
          amount: value,
          to: alice,
          token: weth,
        },
        value,
      ),
      sdk.market.sellCreditMarket(market1, {
        lender: bob,
        creditPositionId: ethers.constants.MaxUint256,
        amount: 100n,
        tenor: 365n * 24n * 60n * 60n,
        deadline: 1893456000n,
        maxAPR: ethers.constants.MaxUint256,
        exactAmountIn: false,
      }),
    ]);

    expect(txs.length).toBe(1);
    expect(txs[0].target).toBe(market1);
    expect(txs[0].value?.toString()).toBe(value.toString());
  });

  test("tx.build should throw on empty operations", () => {
    expect(() => sdk.tx.build(alice, [])).toThrow(
      "[@rheo/sdk] no operations to execute",
    );
  });
});
