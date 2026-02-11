import { BigNumberish } from "ethers";
import { Address } from "../..";
import { CopyLimitOrderConfigStruct } from "../types/ethers-contracts/SizeFactory";

type FactoryFunctionName =
  | "subscribeToCollections"
  | "unsubscribeFromCollections"
  | "setAuthorization"
  | "revokeAllAuthorizations"
  | "setUserCollectionCopyLimitOrderConfigs";

export type FactoryOperation = {
  functionName: FactoryFunctionName;
  params:
    | BigNumberish[]
    | [Address, BigNumberish]
    | [BigNumberish, CopyLimitOrderConfigStruct, CopyLimitOrderConfigStruct]
    | [];
};

export class FactoryActions {
  constructor() {}

  subscribeToCollections(params: BigNumberish[]): FactoryOperation {
    return {
      functionName: "subscribeToCollections",
      params,
    };
  }

  unsubscribeFromCollections(params: BigNumberish[]): FactoryOperation {
    return {
      functionName: "unsubscribeFromCollections",
      params,
    };
  }

  setAuthorization(params: [Address, BigNumberish]): FactoryOperation {
    return {
      functionName: "setAuthorization",
      params,
    };
  }

  revokeAllAuthorizations(): FactoryOperation {
    return {
      functionName: "revokeAllAuthorizations",
      params: [],
    };
  }

  setUserCollectionCopyLimitOrderConfigs(
    params: [
      BigNumberish,
      CopyLimitOrderConfigStruct,
      CopyLimitOrderConfigStruct,
    ],
  ): FactoryOperation {
    return {
      functionName: "setUserCollectionCopyLimitOrderConfigs",
      params,
    };
  }
}
