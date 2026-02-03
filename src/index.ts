import {
  MarketActions as MarketActionsV1_8,
  MarketOperation as MarketOperationV1_8,
} from "./v1.8/actions/market";
import {
  MarketActions as MarketActionsFM_V1_8,
  MarketOperation as MarketOperationFM_V1_8,
} from "./fm-v1.8/actions/market";
import {
  FactoryActions as FactoryActionsV1_8,
  FactoryOperation as FactoryOperationV1_8,
} from "./v1.8/actions/factory";
import {
  FactoryActions as FactoryActionsFM_V1_8,
  FactoryOperation as FactoryOperationFM_V1_8,
} from "./fm-v1.8/actions/factory";
import {
  FactoryActions as FactoryActionsV1_7,
  FactoryOperation as FactoryOperationV1_7,
} from "./v1.7/actions/factory";
import {
  MarketActions as MarketActionsV1_7,
  MarketOperation as MarketOperationV1_7,
} from "./v1.7/actions/market";
import { TxBuilder as TxBuilderV1_8 } from "./v1.8/tx/build";
import { TxBuilder as TxBuilderFM_V1_8 } from "./fm-v1.8/tx/build";
import { TxBuilder as TxBuilderV1_7 } from "./v1.7/tx/build";

import { FullCopy, NoCopy, NullCopy } from "./constants";
import { ERC20Actions, ERC20Operation } from "./erc20/actions";
import { ErrorDecoder } from "./decoder/error";
import { CalldataDecoder } from "./decoder/calldata";
import selector from "./helpers/selector";
import deadline from "./helpers/deadline";
import { BigNumberish, ethers } from "ethers";
import Authorization from "./Authorization";

export type Address = `0x${string}`;

export interface TxArgs {
  target: Address;
  data: string;
  value?: BigNumberish;
}

export type Version = "v1.7" | "v1.8" | "FM-v1.8";

interface SDKParamsCommon {
  labels?: Record<string, string>;
  sizeFactory: Address;
}

export interface SDKParamsV1_8 extends SDKParamsCommon {
  version: "v1.8";
}

export interface SDKParamsFM_V1_8 extends SDKParamsCommon {
  version: "FM-v1.8";
}

export interface SDKParamsV1_7 extends SDKParamsCommon {
  version: "v1.7";
}

export type SDKParams = SDKParamsV1_7 | SDKParamsV1_8 | SDKParamsFM_V1_8;

export type MarketActionsByVersion<T extends Version> = T extends "v1.8"
  ? MarketActionsV1_8
  : T extends "FM-v1.8"
    ? MarketActionsFM_V1_8
  : MarketActionsV1_7;
export type FactoryActionsByVersion<T extends Version> = T extends "v1.8"
  ? FactoryActionsV1_8
  : T extends "FM-v1.8"
    ? FactoryActionsFM_V1_8
  : FactoryActionsV1_7;
export type TxBuilderByVersion<T extends Version> = T extends "v1.8"
  ? TxBuilderV1_8
  : T extends "FM-v1.8"
    ? TxBuilderFM_V1_8
  : TxBuilderV1_7;

export type OperationV1_8 =
  | MarketOperationV1_8
  | FactoryOperationV1_8
  | ERC20Operation;
export type OperationFM_V1_8 =
  | MarketOperationFM_V1_8
  | FactoryOperationFM_V1_8
  | ERC20Operation;
export type OperationV1_7 =
  | MarketOperationV1_7
  | FactoryOperationV1_7
  | ERC20Operation;

class SDK<T extends Version> {
  public readonly sizeFactory: Address;

  public readonly version: T;

  public readonly market: MarketActionsByVersion<T>;
  public readonly factory: FactoryActionsByVersion<T>;
  public readonly erc20: ERC20Actions;
  public readonly errorDecoder: ErrorDecoder;
  public readonly calldataDecoder: CalldataDecoder;

  private readonly txBuilder: TxBuilderByVersion<T>;

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
    } else if (params.version === "FM-v1.8") {
      this.factory =
        new FactoryActionsFM_V1_8() as FactoryActionsByVersion<T>;
      this.market = new MarketActionsFM_V1_8() as MarketActionsByVersion<T>;

      this.txBuilder = new TxBuilderFM_V1_8(
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

  get tx(): T extends "v1.8"
    ? {
        build: (
          onBehalfOf: Address,
          operations: OperationV1_8[],
          recipient?: Address,
        ) => TxArgs[];
      }
    : T extends "FM-v1.8"
      ? {
          build: (
            onBehalfOf: Address,
            operations: OperationFM_V1_8[],
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
          : T extends "FM-v1.8"
            ? OperationFM_V1_8[]
            : OperationV1_7[],
        recipient?: Address,
      ) => this.txBuilder.build(onBehalfOf, operations as any, recipient),
    } as any;
  }

  get helpers() {
    return {
      deadline,
      selector,
      Authorization,
    };
  }

  get decode() {
    return {
      error: (data: string) => this.errorDecoder.decode(data),
      calldata: (data: string) => this.calldataDecoder.decode(data),
    };
  }

  get constants() {
    return {
      FullCopy,
      NoCopy,
      NullCopy,
    };
  }
}

export default SDK;
