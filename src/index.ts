/**
 * `@rheo/sdk` public entry point. Exports the {@link SDK} class (default),
 * the version-specific operation/action types, and the {@link agentContext}
 * string built from `docs/AGENT_CONTEXT.md` for consumption by LLM tooling.
 *
 * @module @rheo/sdk
 */

import {
  MarketActions as MarketActionsV1_8,
  MarketOperation as MarketOperationV1_8,
} from "./v1.8/actions/market";
import {
  FactoryActions as FactoryActionsV1_8,
  FactoryOperation as FactoryOperationV1_8,
} from "./v1.8/actions/factory";
import {
  FactoryActions as FactoryActionsV1_7,
  FactoryOperation as FactoryOperationV1_7,
} from "./v1.7/actions/factory";
import {
  MarketActions as MarketActionsV1_7,
  MarketOperation as MarketOperationV1_7,
} from "./v1.7/actions/market";
import { TxBuilder as TxBuilderV1_8 } from "./v1.8/tx/build";
import { TxBuilder as TxBuilderV1_7 } from "./v1.7/tx/build";
import {
  FactoryActions as FactoryActionsV1_9,
  FactoryOperation as FactoryOperationV1_9,
} from "./v1.9/actions/factory";
import {
  MarketActions as MarketActionsV1_9,
  MarketOperation as MarketOperationV1_9,
} from "./v1.9/actions/market";
import { TxBuilder as TxBuilderV1_9 } from "./v1.9/tx/build";

import { FullCopy, NoCopy, NullCopy } from "./constants";
import { ERC20Actions, ERC20Operation } from "./erc20/actions";
import { ErrorDecoder } from "./decoder/error";
import { CalldataDecoder } from "./decoder/calldata";
import selector from "./helpers/selector";
import deadline from "./helpers/deadline";
import {
  parseRiskConfig,
  type ParsedRiskConfig,
} from "./helpers/riskConfig";
import {
  buyCreditMarketWithCR,
  sellCreditMarketWithCR,
} from "./helpers/creditMarketWithCR";
import { BigNumberish, ethers } from "ethers";
import Authorization from "./Authorization";
import { agentContext } from "./agentContext.generated";

export { agentContext };

/** Ethereum address as a `0x`-prefixed hex string literal. */
export type Address = `0x${string}`;

/**
 * An unsigned transaction produced by `sdk.tx.build(...)`. Each entry is
 * ready to be signed and submitted as-is.
 */
export interface TxArgs {
  /** Contract address the transaction targets. */
  target: Address;
  /** ABI-encoded calldata (hex string starting with `0x`). */
  data: string;
  /** Native-asset value (wei) to attach to the call. */
  value?: BigNumberish;
}

/** Supported Rheo / Size protocol versions. */
export type Version = "v1.7" | "v1.8" | "v1.9";

interface SDKParamsCommon {
  /**
   * Optional address-to-label map consulted by {@link CalldataDecoder}
   * when rendering transactions. Labels are matched case-insensitively.
   */
  labels?: Record<string, string>;
  /**
   * Factory address for the deployment. The same `SizeFactory` contract
   * handles v1.7, v1.8, and v1.9 markets — there is no separate
   * RheoFactory.
   */
  sizeFactory: Address;
}

/** `SDKParams` specialized for `version: "v1.8"`. */
export interface SDKParamsV1_8 extends SDKParamsCommon {
  version: "v1.8";
}

/** `SDKParams` specialized for `version: "v1.9"` (Rheo). */
export interface SDKParamsV1_9 extends SDKParamsCommon {
  version: "v1.9";
}

/** `SDKParams` specialized for `version: "v1.7"`. */
export interface SDKParamsV1_7 extends SDKParamsCommon {
  version: "v1.7";
}

/** Union of version-specific SDK parameter shapes. */
export type SDKParams = SDKParamsV1_7 | SDKParamsV1_8 | SDKParamsV1_9;

/** Resolves the `MarketActions` class that matches version `T`. */
export type MarketActionsByVersion<T extends Version> = T extends "v1.8"
  ? MarketActionsV1_8
  : T extends "v1.9"
    ? MarketActionsV1_9
    : MarketActionsV1_7;
/** Resolves the `FactoryActions` class that matches version `T`. */
export type FactoryActionsByVersion<T extends Version> = T extends "v1.8"
  ? FactoryActionsV1_8
  : T extends "v1.9"
    ? FactoryActionsV1_9
    : FactoryActionsV1_7;
/** Resolves the `TxBuilder` class that matches version `T`. */
export type TxBuilderByVersion<T extends Version> = T extends "v1.8"
  ? TxBuilderV1_8
  : T extends "v1.9"
    ? TxBuilderV1_9
    : TxBuilderV1_7;

/** Union of every v1.8 operation accepted by `tx.build`. */
export type OperationV1_8 =
  | MarketOperationV1_8
  | FactoryOperationV1_8
  | ERC20Operation;
/** Union of every v1.9 (Rheo) operation accepted by `tx.build`. */
export type OperationV1_9 =
  | MarketOperationV1_9
  | FactoryOperationV1_9
  | ERC20Operation;
/** Union of every v1.7 operation accepted by `tx.build`. */
export type OperationV1_7 =
  | MarketOperationV1_7
  | FactoryOperationV1_7
  | ERC20Operation;

/**
 * Entry point for composing onchain Rheo / Size transactions. Construct
 * one per version you need to target; the instance dispatches to the
 * correct `MarketActions`, `FactoryActions`, and `TxBuilder` based on the
 * `version` you pass.
 *
 * The SDK is write-focused: all `sdk.market.*` and `sdk.factory.*` methods
 * return tagged {@link OperationV1_9} (or V1_7 / V1_8) objects with no
 * side effects. Composition happens in `sdk.tx.build(onBehalfOf, ops)`
 * which returns {@link TxArgs}[] ready to sign. Read access (balances,
 * positions, rates) lives in the backend — not this SDK.
 *
 * @typeParam T - Protocol version (`"v1.7"`, `"v1.8"`, or `"v1.9"`).
 *
 * @example
 * ```ts
 * import SDK from "@rheo/sdk";
 * import { ethers } from "ethers";
 *
 * const sdk = new SDK({
 *   sizeFactory: "0xYourSizeFactoryAddress",
 *   version: "v1.9",
 *   labels: { "0xYourSizeFactoryAddress": "SizeFactory" },
 * });
 *
 * const txs = sdk.tx.build(alice, [
 *   sdk.erc20.approve(usdc, sdk.sizeFactory, ethers.constants.MaxUint256),
 *   sdk.market.deposit(market, { token: usdc, amount: 1_000_000n, to: alice }),
 * ]);
 * ```
 */
class SDK<T extends Version> {
  /**
   * Markdown-formatted context for LLM tooling, lifted verbatim from
   * `docs/AGENT_CONTEXT.md` at build time. Same value as the top-level
   * {@link agentContext} export — exposed here for ergonomic access from
   * an `sdk` instance.
   */
  public static readonly agentContext: string = agentContext;

  /** SizeFactory address passed at construction. */
  public readonly sizeFactory: Address;

  /** Protocol version this SDK instance targets. */
  public readonly version: T;

  /** Version-specific market-action factory. */
  public readonly market: MarketActionsByVersion<T>;
  /** Version-specific factory-action factory. */
  public readonly factory: FactoryActionsByVersion<T>;
  /** ERC-20 operation factory (shared across versions). */
  public readonly erc20: ERC20Actions;
  /** Contract revert decoder (shared across versions). */
  public readonly errorDecoder: ErrorDecoder;
  /** Calldata decoder (shared across versions). */
  public readonly calldataDecoder: CalldataDecoder;

  private readonly txBuilder: TxBuilderByVersion<T>;

  /**
   * Constructs an SDK instance for the given protocol version.
   *
   * @param params - Version-discriminated config: `sizeFactory`,
   *   `version`, and optional `labels` consumed by the calldata decoder.
   *
   * @example
   * ```ts
   * const sdk = new SDK({
   *   sizeFactory: "0x…",
   *   version: "v1.9",
   * });
   * ```
   */
  constructor(params: SDKParams & { version: T }) {
    this.sizeFactory = params.sizeFactory;
    this.version = params.version;
    this.erc20 = new ERC20Actions();
    this.errorDecoder = new ErrorDecoder();
    this.calldataDecoder = new CalldataDecoder({
      [ethers.constants.MaxUint256.toString()]: "type(uint256).max",
      [ethers.constants.MaxInt256.toString()]: "type(int256).max",
      [ethers.constants.MinInt256.toString()]: "type(int256).min",
      [ethers.constants.AddressZero.toString()]: "address(0)",
      ...(params.labels || {}),
    });

    if (params.version === "v1.8") {
      this.factory = new FactoryActionsV1_8() as FactoryActionsByVersion<T>;
      this.market = new MarketActionsV1_8() as MarketActionsByVersion<T>;

      this.txBuilder = new TxBuilderV1_8(
        this.sizeFactory,
      ) as TxBuilderByVersion<T>;
    } else if (params.version === "v1.9") {
      this.factory = new FactoryActionsV1_9() as FactoryActionsByVersion<T>;
      this.market = new MarketActionsV1_9() as MarketActionsByVersion<T>;

      this.txBuilder = new TxBuilderV1_9(
        this.sizeFactory,
      ) as TxBuilderByVersion<T>;
    } else {
      this.factory =
        new FactoryActionsV1_7() as unknown as FactoryActionsByVersion<T>;
      this.market = new MarketActionsV1_7() as MarketActionsByVersion<T>;

      this.txBuilder = new TxBuilderV1_7(
        this.sizeFactory,
      ) as TxBuilderByVersion<T>;
    }
  }

  /**
   * Transaction-composition namespace. Exposes `build(onBehalfOf, ops,
   * recipient?)` typed against the SDK's configured version — see the
   * version-specific {@link TxBuilder} (v1.9) documentation for the
   * detailed semantics around grouping, authorization wrapping, and
   * ERC-20 handling.
   *
   * @example
   * ```ts
   * const txs = sdk.tx.build(alice, [
   *   sdk.market.deposit(market, { token: usdc, amount: 1n, to: alice }),
   * ]);
   * ```
   */
  get tx(): T extends "v1.8"
    ? {
        build: (
          onBehalfOf: Address,
          operations: OperationV1_8[],
          recipient?: Address,
        ) => TxArgs[];
      }
    : T extends "v1.9"
      ? {
          build: (
            onBehalfOf: Address,
            operations: OperationV1_9[],
            recipient?: Address,
          ) => TxArgs[];
        }
      : {
          build: (
            onBehalfOf: Address,
            operations: OperationV1_7[],
            recipient?: Address,
          ) => TxArgs[];
        } {
    return {
      build: (
        onBehalfOf: Address,
        operations: T extends "v1.8"
          ? OperationV1_8[]
          : T extends "v1.9"
            ? OperationV1_9[]
            : OperationV1_7[],
        recipient?: Address,
      ) => this.txBuilder.build(onBehalfOf, operations as any, recipient),
    } as any;
  }

  /**
   * Pure utilities that don't produce operations: `deadline` for computing
   * future unix timestamps, `selector` for deriving 4-byte function
   * selectors, and `Authorization` for building and inspecting action
   * bitmaps (used internally by `tx.build`).
   *
   * @example
   * ```ts
   * sdk.helpers.deadline(60);                // → now + 60s (bigint)
   * sdk.helpers.selector("transfer(address,uint256)"); // → "a9059cbb"
   * sdk.helpers.Authorization.getActionsBitmap([
   *   sdk.helpers.Authorization.Action.DEPOSIT,
   * ]);
   * ```
   */
  get helpers() {
    return {
      deadline,
      selector,
      Authorization,
      parseRiskConfig,
      buyCreditMarketWithCR,
      sellCreditMarketWithCR,
    };
  }

  /**
   * Decoders for revert calldata and transaction calldata. `error(data)`
   * unwraps a failed-transaction revert into a readable `Name(args)`
   * string; `calldata(data)` pretty-prints an outgoing calldata hex blob
   * as an indented multi-line tree. Both share the merged cross-version
   * ABI.
   *
   * @example
   * ```ts
   * try { await tx.wait(); }
   * catch (err: any) { console.log(sdk.decode.error(err.data)); }
   *
   * console.log(sdk.decode.calldata(txs[0].data));
   * ```
   */
  get decode() {
    return {
      error: (data: string) => this.errorDecoder.decode(data),
      calldata: (data: string) => this.calldataDecoder.decode(data),
    };
  }

  /**
   * Canonical `CopyLimitOrderConfig` presets. See {@link FullCopy},
   * {@link NoCopy}, and {@link NullCopy} for the specific semantics of
   * each preset.
   */
  get constants() {
    return {
      FullCopy,
      NoCopy,
      NullCopy,
    };
  }
}

export { parseRiskConfig, type ParsedRiskConfig };
export default SDK;
