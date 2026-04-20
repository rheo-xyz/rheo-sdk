/**
 * Decodes contract revert calldata into a human-readable string by trying,
 * in order, the standard `Error(string)` and `Panic(uint256)` shapes and
 * then the deduped merger of every error ABI shipped with the SDK (v1.7 /
 * v1.8 / v1.9 market errors, CollectionsManager errors, and ERC-20/721/1155
 * interface errors). Used by `sdk.decode.error(data)`.
 *
 * @module decoder/error
 */

import { ethers } from "ethers";
import ErrorsV1_8 from "../v1.8/abi/Errors.json";
import ErrorsV1_9 from "../v1.9/abi/Errors.json";
import ErrorsV1_7 from "../v1.7/abi/Errors.json";
import CollectionsManagerV1_8 from "../v1.8/abi/CollectionsManager.json";
import CollectionsManagerV1_9 from "../v1.9/abi/CollectionsManager.json";
import IERC20Errors from "../erc20/abi/IERC20Errors.json";
import IERC20ErrorsV1_8 from "../v1.8/abi/IERC20Errors.json";
import IERC20ErrorsV1_9 from "../v1.9/abi/IERC20Errors.json";
import IERC721ErrorsV1_8 from "../v1.8/abi/IERC721Errors.json";
import IERC721ErrorsV1_9 from "../v1.9/abi/IERC721Errors.json";
import IERC1155ErrorsV1_8 from "../v1.8/abi/IERC1155Errors.json";
import IERC1155ErrorsV1_9 from "../v1.9/abi/IERC1155Errors.json";
import selector from "../helpers/selector";

/**
 * Version-agnostic decoder for Rheo/Size revert calldata. Instances are
 * constructed once and reused; the merged interface is built in the
 * constructor, so `decode` calls are cheap.
 */
export class ErrorDecoder {
  private readonly abi: ethers.utils.Interface;

  /**
   * Builds a single `ethers.utils.Interface` that unions the error
   * fragments from every version's ABI, deduplicating by `name(types...)`
   * signature so overlapping error definitions across v1.7/v1.8/v1.9 don't
   * raise ethers' "duplicate" warnings.
   */
  constructor() {
    const set = new Set();
    const abi = [
      ...ErrorsV1_9.abi,
      ...ErrorsV1_8.abi,
      ...ErrorsV1_7.abi,
      ...CollectionsManagerV1_9.abi,
      ...CollectionsManagerV1_8.abi,
      ...IERC20Errors.abi,
      ...IERC20ErrorsV1_9.abi,
      ...IERC20ErrorsV1_8.abi,
      ...IERC721ErrorsV1_9.abi,
      ...IERC721ErrorsV1_8.abi,
      ...IERC1155ErrorsV1_9.abi,
      ...IERC1155ErrorsV1_8.abi,
    ];
    const deduped = abi
      .filter((abiItem) => abiItem.type === "error")
      .filter((abiItem) => {
        const errSelector = `${abiItem.name}(${abiItem.inputs.map((input) => input.type).join(",")})`;
        if (set.has(errSelector)) return false;
        set.add(errSelector);
        return true;
      });
    this.abi = new ethers.utils.Interface(deduped);
  }

  /**
   * Decodes a revert calldata string (the `.data` on an ethers error) into
   * a human-readable `Name(arg1,arg2,...)` form.
   *
   * @remarks
   * Three code paths:
   * 1. If the data starts with the `Error(string)` selector, returns the
   *    embedded string directly.
   * 2. If it starts with the `Panic(uint256)` selector, returns the panic
   *    code as a string.
   * 3. Otherwise the merged interface parses the error and the result is
   *    stringified as `Name(...args)`.
   *
   * Throws if the calldata does not match any known error (via ethers'
   * internal `parseError`). Call this inside a `try/catch` when handling
   * arbitrary wallet errors.
   *
   * @param data - Revert calldata (hex string starting with `0x`).
   * @returns Human-readable error string.
   * @throws When the calldata does not match any known error fragment.
   *
   * @example
   * ```ts
   * try {
   *   await tx.wait();
   * } catch (err: any) {
   *   const decoded = sdk.decode.error(err.data);
   *   // e.g. "ERC20InsufficientBalance(0x123…, 1000000, 2000000)"
   *   //      "MUST_IMPROVE_COLLATERAL_RATIO(0x123…, 1500000, 1400000)"
   *   console.log(decoded);
   * }
   * ```
   */
  decode(data: string): string {
    if (data.startsWith(`0x${selector("Error(string)")}`)) {
      const [decoded] = ethers.utils.defaultAbiCoder.decode(
        ["string"],
        "0x" + data.substring(10),
      );
      return decoded;
    } else if (data.startsWith(`0x${selector("Panic(uint256)")}`)) {
      const [decoded] = ethers.utils.defaultAbiCoder.decode(
        ["uint256"],
        "0x" + data.substring(10),
      );
      return decoded;
    } else {
      const decodedError = this.abi.parseError(data);
      const stringifyError = (decodedError: any) => {
        const args = decodedError.args
          .map((arg: any) => {
            return typeof arg === "object" ? arg.toString() : arg;
          })
          .join(",");
        return `${decodedError.name}(${args})`;
      };

      return stringifyError(decodedError);
    }
  }
}
