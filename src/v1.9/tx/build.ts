/**
 * Transaction builder for the v1.9 (Rheo) surface. Converts a list of
 * tagged {@link MarketOperation}, {@link FactoryOperation}, and
 * {@link ERC20Operation} values into a minimal array of
 * {@link TxArgs} ready to sign.
 *
 * @module v1.9/tx/build
 */

import { BigNumberish, ethers } from "ethers";
import RheoABI from "../abi/Rheo.json";
import SizeFactoryABI from "../abi/SizeFactory.json";
import ERC20ABI from "../../erc20/abi/ERC20.json";
import { MarketOperation } from "../actions/market";
import { FactoryOperation } from "../actions/factory";
import { ERC20Operation } from "../../erc20/actions";
import Authorization, { ActionsBitmap, type Action } from "../../Authorization";
import { onBehalfOfOperation } from "../actions/onBehalfOf";
import { TxArgs, Address, OperationV1_9 } from "../../index";

function isMarketOperation(
  operation: OperationV1_9,
): operation is MarketOperation {
  return "market" in operation;
}

function isERC20Operation(
  operation: OperationV1_9,
): operation is ERC20Operation {
  return "functionName" in operation && operation.functionName === "approve";
}

interface Subcall {
  target: Address;
  calldata: string;
  value?: BigNumberish;
  isERC20: boolean;
  onBehalfOfCalldata?: string;
  action?: Action;
}

/**
 * @internal True when the subcall forwards a nonzero native-asset value.
 * Such calls cannot be routed through the SizeFactory `multicall`/
 * `callMarket` path — both are nonpayable — so the builder emits them as
 * stand-alone transactions targeting the market directly (the market's
 * `deposit` is payable).
 */
function hasNativeValue(subcall: Subcall): boolean {
  return (
    subcall.value !== undefined &&
    !ethers.BigNumber.from(subcall.value).isZero()
  );
}

/**
 * Encodes a batch of v1.9 operations into unsigned transactions the caller
 * can submit. Instantiated by the {@link SDK} when `version === "v1.9"` —
 * consumers access it through `sdk.tx.build(...)` rather than constructing
 * one directly.
 */
export class TxBuilder {
  private readonly sizeFactory: Address;
  private readonly IRheo: ethers.utils.Interface;
  private readonly ISizeFactory: ethers.utils.Interface;
  private readonly IERC20: ethers.utils.Interface;

  constructor(sizeFactory: Address) {
    this.sizeFactory = sizeFactory;
    this.IRheo = new ethers.utils.Interface(RheoABI.abi);
    this.ISizeFactory = new ethers.utils.Interface(SizeFactoryABI.abi);
    this.IERC20 = new ethers.utils.Interface(ERC20ABI.abi);
  }

  /** @internal Maps raw operations to intermediate `Subcall` records. */
  private getSubcalls(
    operations: (MarketOperation | FactoryOperation | ERC20Operation)[],
    onBehalfOf: Address,
    recipient?: Address,
  ): Subcall[] {
    return operations.map((operation) => {
      if (isMarketOperation(operation)) {
        const { market, functionName, params, value } = operation;
        const onBehalfOfOp = onBehalfOfOperation(
          market,
          functionName,
          params,
          onBehalfOf,
          recipient,
        );
        return {
          target: market,
          calldata: this.IRheo.encodeFunctionData(functionName, [params]),
          value: value,
          isERC20: false,
          onBehalfOfCalldata: onBehalfOfOp
            ? this.IRheo.encodeFunctionData(onBehalfOfOp.functionName, [
                onBehalfOfOp.externalParams,
              ])
            : undefined,
          action: onBehalfOfOp?.action,
        };
      } else if (isERC20Operation(operation)) {
        const { token, functionName, params } = operation;
        return {
          target: token,
          calldata: this.IERC20.encodeFunctionData(functionName, params),
          value: undefined,
          isERC20: true,
          onBehalfOfCalldata: undefined,
          action: undefined,
        };
      } /*isFactoryOperation*/ else {
        const { functionName, params } = operation;

        const functionFragment = this.ISizeFactory.getFunction(functionName);
        const shouldWrapArray =
          functionFragment.inputs.length === 1 &&
          functionFragment.inputs[0].type.endsWith("[]");
        const factoryParams = shouldWrapArray ? [params] : params;
        const calldata = this.ISizeFactory.encodeFunctionData(
          functionName,
          factoryParams,
        );
        return {
          target: this.sizeFactory,
          calldata: calldata,
          value: undefined,
          isERC20: false,
          onBehalfOfCalldata: undefined,
          action: undefined,
        };
      }
    });
  }

  /** @internal Extracts ERC-20 subcalls into stand-alone `TxArgs`. */
  private getERC20Subcalls(subcalls: Subcall[]): TxArgs[] {
    return subcalls
      .filter((op) => op.isERC20)
      .map((op) => ({
        target: op.target,
        data: op.calldata,
        value: undefined,
      }));
  }

  /**
   * @internal Extracts native-value subcalls (e.g. ETH deposits) into
   * stand-alone `TxArgs` calling the market directly, since the nonpayable
   * SizeFactory route cannot forward value. The raw (non-`OnBehalfOf`)
   * calldata is used: the signer is `msg.sender` and supplies `msg.value`,
   * while the params' `to` still controls who gets credited.
   */
  private getNativeValueSubcalls(subcalls: Subcall[]): TxArgs[] {
    return subcalls.filter(hasNativeValue).map((op) => ({
      target: op.target,
      data: op.calldata,
      value: op.value,
    }));
  }

  /** @internal True when at least one subcall needs an authorization bit. */
  private requiresAuthorization(subcalls: Subcall[]): boolean {
    return subcalls
      .map((op) => op.action)
      .some((action): action is Action => action !== undefined);
  }

  /** @internal Combines all required action bits into one {@link ActionsBitmap}. */
  private getActionsBitmap(subcalls: Subcall[]): ActionsBitmap {
    const actions = subcalls
      .map((op) => op.action)
      .filter((action): action is Action => action !== undefined);
    return Authorization.getActionsBitmap(actions);
  }

  /**
   * @internal Groups per-market subcalls and returns the factory-level
   * calldatas (`callMarket(market, multicall(...))` or direct factory
   * functions) that the outer multicall will execute.
   */
  private getSizeFactorySubcallsDatas(subcalls: Subcall[]): string[] {
    const ops = subcalls.filter((op) => !op.isERC20);

    type Group = { target: Address; ops: Subcall[] };

    const groups = ops.reduce<Group[]>((acc, op) => {
      if (op.target === this.sizeFactory) {
        acc.push({ target: op.target, ops: [op] });
        return acc;
      }

      const last = acc[acc.length - 1];
      if (
        last &&
        last.target === op.target &&
        last.target !== this.sizeFactory
      ) {
        last.ops.push(op);
      } else {
        acc.push({ target: op.target, ops: [op] });
      }
      return acc;
    }, []);

    return groups.map((group) => {
      if (group.target === this.sizeFactory) {
        return group.ops[0].calldata;
      }

      if (group.ops.length === 1) {
        return this.ISizeFactory.encodeFunctionData("callMarket", [
          group.target,
          group.ops[0].onBehalfOfCalldata ?? group.ops[0].calldata,
        ]);
      }

      const calldatas = group.ops.map(
        (g) => g.onBehalfOfCalldata ?? g.calldata,
      );
      const multicall = this.IRheo.encodeFunctionData("multicall", [calldatas]);
      return this.ISizeFactory.encodeFunctionData("callMarket", [
        group.target,
        multicall,
      ]);
    });
  }

  /**
   * @internal Returns the `[setAuthorization(bitmap), setAuthorization(0)]`
   * pair that wraps the factory multicall, or `[]` when the batch needs no
   * authorization.
   */
  private getAuthorizationSubcallsDatas(
    subcalls: Subcall[],
  ): [string, string] | [] {
    if (this.requiresAuthorization(subcalls)) {
      const auth = this.ISizeFactory.encodeFunctionData("setAuthorization", [
        this.sizeFactory,
        this.getActionsBitmap(subcalls),
      ]);
      const nullAuth = this.ISizeFactory.encodeFunctionData(
        "setAuthorization",
        [this.sizeFactory, Authorization.nullActionsBitmap()],
      );
      return [auth, nullAuth];
    } else {
      return [];
    }
  }

  /**
   * Encodes `operations` into one or more unsigned transactions.
   *
   * @remarks
   * The returned `TxArgs[]` is ordered and complete: sign and submit each
   * entry in order. The builder does the following, in this order:
   *
   * 1. **ERC-20 approvals come out first** as stand-alone transactions
   *    (one `TxArgs` per approve), targeting the token contract directly.
   *    The user must sign these before the SizeFactory can pull funds.
   * 2. **Native-value operations come out next**, also as stand-alone
   *    transactions targeting the market directly. The SizeFactory
   *    `multicall`/`callMarket` functions are nonpayable, so an operation
   *    carrying a nonzero `value` (e.g. a native ETH deposit) cannot ride
   *    the factory route — it is emitted as a direct, payable market call
   *    (raw function, no `*OnBehalfOf` wrapping, no authorization) placed
   *    before the factory multicall so later operations can rely on the
   *    deposited funds. The signer supplies `msg.value`; the params' `to`
   *    controls who is credited.
   * 3. **The remaining operations are merged into a single SizeFactory
   *    multicall.** Market operations targeting the same market are
   *    grouped under one `callMarket(market, multicall(...))`; market
   *    operations targeting different markets become separate `callMarket`
   *    entries; factory-level calls (subscribe/unsubscribe/etc.) appear
   *    inline in the outer multicall.
   * 4. **Authorization is automatic.** If any market operation is present,
   *    the builder prepends `setAuthorization(sizeFactory, bitmap)` and
   *    appends `setAuthorization(sizeFactory, 0)` inside the outer
   *    multicall so the grant is established and cleared in the same
   *    transaction. Do not emit `setAuthorization` operations yourself —
   *    doing so will double-grant. Native-value operations hoisted in
   *    step 2 contribute no authorization bits.
   * 5. **Direct-to-`*OnBehalfOf` rewriting.** Each market call is replaced
   *    by its delegated counterpart (see
   *    {@link onBehalfOfOperation}); `onBehalfOf` is threaded into every
   *    one, and `recipient` (when applicable) defaults to `onBehalfOf`.
   *
   * Single-operation edge case: when exactly one operation is passed, the
   * builder returns a single `TxArgs` targeting the relevant contract
   * directly (no multicall wrapping, no auth pair) — this is the common
   * "approve only" or "subscribe only" case.
   *
   * @param onBehalfOf - The user whose positions are being modified. The
   *   EOA signing the returned transactions can be the same address or a
   *   delegate; either way, the market will credit/debit `onBehalfOf`.
   * @param operations - Array of tagged operations to batch.
   * @param recipient - Optional token-recipient override for taker and
   *   self-liquidation operations. @defaultValue `onBehalfOf`
   * @returns Array of unsigned {@link TxArgs} in the order they must be
   *   submitted.
   * @throws If `operations` is empty.
   *
   * @example
   * ```ts
   * const txs = sdk.tx.build(alice, [
   *   sdk.erc20.approve(usdc, sdk.sizeFactory, ethers.constants.MaxUint256),
   *   sdk.market.deposit(market, { token: usdc, amount: 1_000_000n, to: alice }),
   *   sdk.market.buyCreditLimit(market, {
   *     maturities: [1893456000n],
   *     aprs: [500n],
   *   }),
   * ]);
   * // txs[0] → approve on usdc
   * // txs[1] → SizeFactory multicall(setAuth, callMarket(market, multicall(deposit, buyCreditLimit)), nullAuth)
   * ```
   */
  build(
    onBehalfOf: Address,
    operations: (MarketOperation | FactoryOperation | ERC20Operation)[],
    recipient?: Address,
  ): TxArgs[] {
    const subcalls = this.getSubcalls(operations, onBehalfOf, recipient);

    if (subcalls.length === 0) {
      throw new Error("[@rheo/sdk] no operations to execute");
    } else if (subcalls.length == 1) {
      return [
        {
          target: subcalls[0].target,
          data: subcalls[0].calldata,
          value: subcalls[0].value,
        },
      ];
    } else {
      const erc20Subcalls = this.getERC20Subcalls(subcalls);
      const nativeValueSubcalls = this.getNativeValueSubcalls(subcalls);
      const factorySubcalls = subcalls.filter((op) => !hasNativeValue(op));
      const sizeFactorySubcallsDatas =
        this.getSizeFactorySubcallsDatas(factorySubcalls);

      if (sizeFactorySubcallsDatas.length === 0) {
        return [...erc20Subcalls, ...nativeValueSubcalls];
      }

      const [maybeAuth, maybeNullAuth] =
        this.getAuthorizationSubcallsDatas(factorySubcalls);

      const multicall = this.ISizeFactory.encodeFunctionData("multicall", [
        [maybeAuth, ...sizeFactorySubcallsDatas, maybeNullAuth].filter(Boolean),
      ]);
      return [
        ...erc20Subcalls,
        ...nativeValueSubcalls,
        {
          target: this.sizeFactory,
          data: multicall,
          value: undefined,
        },
      ];
    }
  }
}
