/**
 * Decodes Rheo / Size / ERC-20 transaction calldata into a
 * multi-line, indented, human-readable form suitable for logs, previews,
 * and test snapshots. Used by `sdk.decode.calldata(data)`.
 *
 * Unlike {@link ErrorDecoder}, which only unwraps reverts, this decoder
 * also recurses into `multicall`, `callMarket`, and any bytes argument
 * that itself looks like an ABI-encoded function call — producing a
 * tree-shaped view of a composed SizeFactory transaction.
 *
 * @module decoder/calldata
 */

import { ethers } from "ethers";
import { Result } from "@ethersproject/abi";

import SizeFactoryV1_8 from "../v1.8/abi/SizeFactory.json";
import SizeFactoryV1_9 from "../v1.9/abi/SizeFactory.json";
import SizeFactoryV1_7 from "../v1.7/abi/SizeFactory.json";
import SizeV1_7 from "../v1.7/abi/Size.json";
import SizeV1_8 from "../v1.8/abi/Size.json";
import RheoV1_9 from "../v1.9/abi/Rheo.json";
import CollectionsManagerV1_8 from "../v1.8/abi/CollectionsManager.json";
import CollectionsManagerV1_9 from "../v1.9/abi/CollectionsManager.json";
import ERC20 from "../erc20/abi/ERC20.json";

import { Action, isActionSet } from "../Authorization";

/**
 * Calldata decoder that unions every Rheo / Size ABI across versions and
 * recursively formats nested calls (multicall, callMarket, bytes-encoded
 * arguments). Uses a configurable `labels` map to substitute
 * human-readable names for well-known addresses and sentinel values (e.g.
 * `type(uint256).max`, `address(0)`).
 */
export class CalldataDecoder {
  private readonly abi: ethers.utils.Interface;
  private readonly labels: Record<string, string>;

  /**
   * @param labels - Map from a lowercased string form of an address or
   *   sentinel value to the display name it should render as. The SDK
   *   default passes in `type(uint256).max`, `type(int256).max/min`, and
   *   `address(0)` substitutions; callers can extend it with named
   *   contract/EOA labels at SDK-construction time via `new SDK({ labels })`.
   */
  constructor(labels: Record<string, string> = {}) {
    const abis = [
      ...CollectionsManagerV1_8.abi,
      ...CollectionsManagerV1_9.abi,
      ...SizeFactoryV1_8.abi,
      ...SizeFactoryV1_9.abi,
      ...SizeFactoryV1_7.abi,
      ...SizeV1_7.abi,
      ...SizeV1_8.abi,
      ...RheoV1_9.abi,
      ...ERC20.abi,
    ];

    this.abi = CalldataDecoder.buildInterface(abis);
    this.labels = Object.fromEntries(
      Object.entries(labels).map(([key, value]) => [key.toLowerCase(), value]),
    );
  }

  /** @internal Indentation helper for recursive formatting. */
  private indent(level: number): string {
    return "  ".repeat(level);
  }

  /**
   * @internal Builds a single ethers `Interface` over the full merged ABI,
   * deduplicating function fragments by canonical signature so overlapping
   * cross-version definitions don't error.
   */
  private static buildInterface(abi: any[]): ethers.utils.Interface {
    const seen = new Set<string>();
    const deduped = abi
      .filter((item) => item.type === "function")
      .filter((item) => {
        const sig = `${item.name}(${item.inputs
          .map((e: any) => CalldataDecoder.formatType(e))
          .join(",")})`;
        if (seen.has(sig)) return false;
        seen.add(sig);
        return true;
      });
    return new ethers.utils.Interface(deduped);
  }

  /**
   * Decodes a transaction calldata string into a human-readable,
   * indented tree.
   *
   * @remarks
   * Recurses into:
   * - `multicall(bytes[])` — each inner calldata is decoded and nested.
   * - `callMarket(address, bytes)` — the inner bytes are decoded as a
   *   market function call.
   * - Any `bytes` argument that itself parses as a known function call.
   *
   * Also specializes `setAuthorization`'s `uint256` argument: instead of
   * printing the raw bitmap, it renders `[ACTION_A,ACTION_B,…]` using the
   * {@link Action} enum names.
   *
   * Does not throw on unknown calldata — returns the literal string
   * `"Unknown function call or invalid calldata"` so it is safe to call on
   * arbitrary blobs (e.g. for tx-preview UIs).
   *
   * @param data - Transaction calldata hex string.
   * @returns Indented multi-line string representation of the call.
   *
   * @example
   * ```ts
   * console.log(sdk.decode.calldata(txs[0].data));
   * // multicall(
   * //   [
   * //     setAuthorization(SizeFactory, [DEPOSIT,BUY_CREDIT_LIMIT]),
   * //     callMarket(0x…, multicall([ depositOnBehalfOf(…), buyCreditLimitOnBehalfOf(…) ])),
   * //     setAuthorization(SizeFactory, [])
   * //   ]
   * // )
   * ```
   */
  decode(data: string): string {
    try {
      const tx = this.abi.parseTransaction({ data });
      return this.recursiveFormat(
        tx.name,
        tx.args,
        tx.functionFragment.inputs,
        0,
      );
    } catch {
      return "Unknown function call or invalid calldata";
    }
  }

  /**
   * @internal Canonicalizes a ParamType to its string form, handling the
   * tuple and tuple-array edge cases ethers' default stringifier mangles.
   */
  private static formatType(input: any): string {
    if (input.type === "tuple") {
      const components = input.components
        .map((e: any) => CalldataDecoder.formatType(e))
        .join(",");
      return `(${components})${input.type.endsWith("[]") ? "[]" : ""}`;
    }

    if (input.type.startsWith("tuple") && input.type.endsWith("]")) {
      const components = input.components
        .map((e: any) => CalldataDecoder.formatType(e))
        .join(",");
      const arrayPart = input.type.slice("tuple".length);
      return `(${components})${arrayPart}`;
    }

    return input.type;
  }

  /**
   * @internal Stringifies a leaf value, substituting through the `labels`
   * map so well-known addresses and sentinel values render as their
   * symbolic names.
   */
  private toString(value: any): string {
    const str = value.toString();
    if (Array.isArray(value)) {
      return `[${value.map((item: any) => this.toString(item)).join(",")}]`;
    } else {
      return this.labels[str.toLowerCase()] || str;
    }
  }

  /**
   * @internal Renders an {@link Authorization} bitmap as a list of enum
   * member names.
   */
  private decodeAuthorizationBitmap(bitmap: bigint): string {
    const actions: Action[] = [];
    for (let i = 0; i < Action.NUMBER_OF_ACTIONS; i++) {
      if (isActionSet(bitmap, i)) {
        actions.push(i);
      }
    }
    return `[${actions.map((a) => Action[a]).join(",")}]`;
  }

  /**
   * @internal Formats a function call recursively: indents by `level`,
   * specializes `setAuthorization` bitmaps, expands `bytes` / `bytes[]`
   * args as nested calls when parseable, and delegates tuples to
   * {@link formatTuple}.
   */
  private recursiveFormat(
    name: string,
    args: Result,
    inputs: ethers.utils.ParamType[],
    level: number,
  ): string {
    const formattedArgs = args.map((arg, i) => {
      const input = inputs[i];

      // Special handling for setAuthorization function
      if (name === "setAuthorization" && input.type === "uint256") {
        return this.decodeAuthorizationBitmap(BigInt(arg.toString()));
      }

      if (
        input.type === "bytes" &&
        typeof arg === "string" &&
        arg.startsWith("0x")
      ) {
        return this.tryDecodeNested(arg, level + 1);
      }

      if (input.type === "bytes[]" && Array.isArray(arg)) {
        const inner = arg.map((innerData: string) =>
          this.tryDecodeNested(innerData, level + 2),
        );
        return (
          "[\n" +
          this.indent(level + 2) +
          inner.join(",\n" + this.indent(level + 2)) +
          "\n" +
          this.indent(level + 1) +
          "]"
        );
      }

      if (input.type.startsWith("tuple") && typeof arg === "object") {
        return this.formatTuple(arg, input, level);
      }

      if (Array.isArray(arg)) {
        return (
          "[" + arg.map((item: any) => this.toString(item)).join(", ") + "]"
        );
      }

      return this.toString(arg);
    });

    return `${name}(\n${this.indent(level + 1)}${formattedArgs.join(",\n" + this.indent(level + 1))}\n${this.indent(level)})`;
  }

  /**
   * @internal Formats a Solidity tuple (struct) as `{ field: value, ... }`,
   * recursing through nested tuples and tuple arrays.
   */
  private formatTuple(
    arg: any,
    input: ethers.utils.ParamType,
    level: number,
  ): string {
    const components = input.components || [];

    const namedArgs = components.map((component) => {
      const value = arg[component.name];

      // If the component is a tuple, recursively format it
      if (component.type.startsWith("tuple") && typeof value === "object") {
        return `${component.name}: ${this.formatTuple(value, component, level + 1)}`;
      }

      // If the component is an array of tuples, format each tuple
      if (component.type.startsWith("tuple[]") && Array.isArray(value)) {
        const formattedTuples = value.map((item: any) => {
          const arrayComponent = component.arrayChildren;
          if (!arrayComponent) {
            return this.toString(item);
          }
          return this.formatTuple(item, arrayComponent, level + 2);
        });
        return `${component.name}: [\n${this.indent(level + 2)}${formattedTuples.join(",\n" + this.indent(level + 2))}\n${this.indent(level + 1)}]`;
      }

      return `${component.name}: ${this.toString(value)}`;
    });

    return (
      "{\n" +
      this.indent(level + 2) +
      namedArgs.join(",\n" + this.indent(level + 2)) +
      "\n" +
      this.indent(level + 1) +
      "}"
    );
  }

  /**
   * @internal Attempts to parse nested calldata; falls back to the raw
   * hex string when parsing fails, so arbitrary `bytes` args don't blow
   * up the decode of the outer call.
   */
  private tryDecodeNested(data: string, level: number): string {
    try {
      const nested = this.abi.parseTransaction({ data });
      return this.recursiveFormat(
        nested.name,
        nested.args,
        nested.functionFragment.inputs,
        level,
      );
    } catch {
      return data;
    }
  }
}
