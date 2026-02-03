import { ethers } from "ethers";
import { Result } from "@ethersproject/abi";

import SizeFactoryV1_8 from "../v1.8/abi/SizeFactory.json";
import SizeFactoryFM_V1_8 from "../fm-v1.8/abi/SizeFactory.json";
import SizeFactoryV1_7 from "../v1.7/abi/SizeFactory.json";
import SizeV1_7 from "../v1.7/abi/Size.json";
import SizeV1_8 from "../v1.8/abi/Size.json";
import SizeFM_V1_8 from "../fm-v1.8/abi/Size.json";
import CollectionsManagerV1_8 from "../v1.8/abi/CollectionsManager.json";
import CollectionsManagerFM_V1_8 from "../fm-v1.8/abi/CollectionsManager.json";
import ERC20 from "../erc20/abi/ERC20.json";

import { Action, isActionSet } from "../Authorization";

export class CalldataDecoder {
  private readonly abi: ethers.utils.Interface;
  private readonly labels: Record<string, string>;

  constructor(labels: Record<string, string> = {}) {
    const abis = [
      ...CollectionsManagerV1_8.abi,
      ...CollectionsManagerFM_V1_8.abi,
      ...SizeFactoryV1_8.abi,
      ...SizeFactoryFM_V1_8.abi,
      ...SizeFactoryV1_7.abi,
      ...SizeV1_7.abi,
      ...SizeV1_8.abi,
      ...SizeFM_V1_8.abi,
      ...ERC20.abi,
    ];

    this.abi = CalldataDecoder.buildInterface(abis);
    this.labels = Object.fromEntries(
      Object.entries(labels).map(([key, value]) => [key.toLowerCase(), value]),
    );
  }

  private indent(level: number): string {
    return "  ".repeat(level);
  }

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

  private toString(value: any): string {
    const str = value.toString();
    if (Array.isArray(value)) {
      return `[${value.map((item: any) => this.toString(item)).join(",")}]`;
    } else {
      return this.labels[str.toLowerCase()] || str;
    }
  }

  private decodeAuthorizationBitmap(bitmap: bigint): string {
    const actions: Action[] = [];
    for (let i = 0; i < Action.NUMBER_OF_ACTIONS; i++) {
      if (isActionSet(bitmap, i)) {
        actions.push(i);
      }
    }
    return `[${actions.map((a) => Action[a]).join(",")}]`;
  }

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
