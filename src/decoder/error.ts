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

export class ErrorDecoder {
  private readonly abi: ethers.utils.Interface;

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
