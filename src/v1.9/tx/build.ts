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

  private getERC20Subcalls(subcalls: Subcall[]): TxArgs[] {
    return subcalls
      .filter((op) => op.isERC20)
      .map((op) => ({
        target: op.target,
        data: op.calldata,
        value: undefined,
      }));
  }

  private requiresAuthorization(subcalls: Subcall[]): boolean {
    return subcalls
      .map((op) => op.action)
      .some((action): action is Action => action !== undefined);
  }

  private getActionsBitmap(subcalls: Subcall[]): ActionsBitmap {
    const actions = subcalls
      .map((op) => op.action)
      .filter((action): action is Action => action !== undefined);
    return Authorization.getActionsBitmap(actions);
  }

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
      const sizeFactorySubcallsDatas =
        this.getSizeFactorySubcallsDatas(subcalls);
      const [maybeAuth, maybeNullAuth] =
        this.getAuthorizationSubcallsDatas(subcalls);

      const multicall = this.ISizeFactory.encodeFunctionData("multicall", [
        [maybeAuth, ...sizeFactorySubcallsDatas, maybeNullAuth].filter(Boolean),
      ]);
      return [
        ...erc20Subcalls,
        {
          target: this.sizeFactory,
          data: multicall,
          value: undefined,
        },
      ];
    }
  }
}
