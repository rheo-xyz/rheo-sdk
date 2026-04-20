/**
 * ERC-20 token operations. Currently only `approve` is exposed — the SDK
 * needs approvals to pull tokens into markets during `deposit`, and
 * `TxBuilder.build` emits these approvals as separate leading transactions
 * rather than folding them into the SizeFactory multicall (the user must
 * approve before the factory can move their funds).
 *
 * @module erc20/actions
 */

import { BigNumberish } from "ethers";
import { Address } from "../index";

/**
 * Tagged ERC-20 operation produced by {@link ERC20Actions.approve}. The
 * `TxBuilder` recognizes this shape via its `functionName === "approve"`
 * marker and routes it to a stand-alone transaction targeting `token`.
 */
export interface ERC20Operation {
  /** Address of the ERC-20 token contract the operation targets. */
  token: Address;
  /** ERC-20 function to invoke — only `approve` is supported today. */
  functionName: "approve";
  /** Positional args `[spender, amount]` for `approve`. */
  params: [Address, BigNumberish];
}

/**
 * Factory for ERC-20 operations. Instances have no state; methods are
 * pure constructors that return {@link ERC20Operation} objects for
 * `TxBuilder.build` to consume.
 */
export class ERC20Actions {
  constructor() {}

  /**
   * Builds an `approve(spender, amount)` operation for an ERC-20 token.
   *
   * @remarks
   * When included in a `sdk.tx.build(...)` call, ERC-20 approvals come out
   * as their own leading `TxArgs` entries (one per approval), ordered before
   * the single SizeFactory multicall. This matches the runtime requirement
   * that allowances be in place before the factory attempts to `pull` from
   * the user.
   *
   * @param token - ERC-20 token address to approve.
   * @param spender - Address that will be allowed to spend — usually the
   *   `sizeFactory` address so it can move funds into markets.
   * @param amount - Amount in token base units. Use
   *   `ethers.constants.MaxUint256` for unlimited approval.
   * @returns An {@link ERC20Operation} describing the approval.
   *
   * @example
   * ```ts
   * import { ethers } from "ethers";
   *
   * const usdc = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;
   * const txs = sdk.tx.build(alice, [
   *   sdk.erc20.approve(usdc, sdk.sizeFactory, ethers.constants.MaxUint256),
   *   sdk.market.deposit(market, { token: usdc, amount: 1_000_000n, to: alice }),
   * ]);
   * // txs[0] → approve transaction to usdc
   * // txs[1] → multicall to sizeFactory with the deposit
   * ```
   */
  approve(
    token: Address,
    spender: Address,
    amount: BigNumberish,
  ): ERC20Operation {
    return {
      token,
      functionName: "approve",
      params: [spender, amount],
    };
  }
}
