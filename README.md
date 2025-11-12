# @rheo-xyz/sdk [![Coverage Status](https://coveralls.io/repos/github/rheo-xyz/sdk/badge.svg?branch=main)](https://coveralls.io/github/rheo-xyz/sdk?branch=main) [![npm version](https://img.shields.io/npm/v/@rheo-xyz/sdk)](https://www.npmjs.com/package/rheo/sdk)

Rheo TypeScript SDK

## Installation

```bash
npm install @rheo-xyz/sdk
```

## Usage

```ts
import { ethers } from "ethers";
import SDK from "@rheo-xyz/sdk";

// Initialize the SDK with the Size Factory address and market addresses
const sdk = new SDK({
  sizeFactory: "<SIZE_FACTORY_ADDRESS>",
  version: "v1.8", // or "v1.7"
  labels: {
    "<SIZE_FACTORY_ADDRESS>": "SizeFactory",
  },
});
```

## Features

### Build the transaction target and calldata from an array of operations

```ts
const txs = size.tx.build(alice, [
  size.market.setUserConfiguration(market2, {
    vault: "0x000000000000000000000000000000000000eeee",
    openingLimitBorrowCR: 0,
    allCreditPositionsForSaleDisabled: false,
    creditPositionIdsForSale: false,
    creditPositionIds: [],
  }),
  size.market.deposit(market1, {
    amount: BigNumber.from(100),
    to: "0x0000000000000000000000000000000000001337",
    token: "0x4200000000000000000000000000000000000006",
  }),
  size.market.copyLimitOrders(market1, {
    copyLoanOfferConfig: size.constants.FullCopy,
    copyBorrowOfferConfig: size.constants.NoCopy,
  }),
  size.factory.subscribeToCollections([42n]),
]);

// The SDK will automatically:
// 1. Combine operations into a single transaction when possible
// 2. Handle authorization for operations that require it
// 3. Use multicall for batch operations
// 4. Handle ERC20 approvals separately
```

### Error Decoding

```ts
try {
  await tx.wait();
} catch (error) {
  const decodedError = size.errorDecoder.decode(error.data);
  console.log(decodedError);
  // Example outputs:
  // - "ERC20InsufficientBalance(0x123..., 1000000, 2000000)"
  // - "MUST_IMPROVE_COLLATERAL_RATIO(0x123..., 1500000, 1400000)"
  // - "INVALID_APR_RANGE(500000, 1000000)"
  // - "LOAN_NOT_SELF_LIQUIDATABLE(123, 1500000, 1)"
}
```

### Calldata Decoding

```ts
const decodedCalldata = size.calldataDecoder.decode(tx.data);
console.log(decodedCalldata);
// Example output:
// multicall(
//   [
//     setAuthorization(
//       SizeFactory,
//       [DEPOSIT,WITHDRAW,SELL_CREDIT_MARKET]
//     ),
//     callMarket(
//       0x0000000000000000000000000000000000000123,
//       depositOnBehalfOf(
//         {
//           params: {
//             token: 0x4200000000000000000000000000000000000006,
//             amount: 300,
//             to: 0x0000000000000000000000000000000000010000
//           },
//           onBehalfOf: 0x0000000000000000000000000000000000010000
//         }
//       )
//     ),
//     callMarket(
//       0x0000000000000000000000000000000000000123,
//       sellCreditMarketOnBehalfOf(
//         {
//           params: {
//             lender: 0x0000000000000000000000000000000000020000,
//             creditPositionId: type(uint256).max,
//             amount: 100,
//             tenor: 31536000,
//             deadline: 1893456000,
//             maxAPR: type(uint256).max,
//             exactAmountIn: false,
//             collectionId: 0,
//             rateProvider: address(0)
//           },
//           onBehalfOf: 0x0000000000000000000000000000000000010000,
//           recipient: 0x0000000000000000000000000000000000010000
//         }
//       )
//     ),
//     callMarket(
//       0x0000000000000000000000000000000000000456,
//       depositOnBehalfOf(
//         {
//           params: {
//             token: 0x0000000000000000000000000000000000007777,
//             amount: 400,
//             to: 0x0000000000000000000000000000000000010000
//           },
//           onBehalfOf: 0x0000000000000000000000000000000000010000
//         }
//       )
//     ),
//     callMarket(
//       0x0000000000000000000000000000000000000456,
//       sellCreditMarketOnBehalfOf(
//         {
//           params: {
//             lender: 0x0000000000000000000000000000000000030000,
//             creditPositionId: type(uint256).max,
//             amount: 100,
//             tenor: 31536000,
//             deadline: 1893456000,
//             maxAPR: type(uint256).max,
//             exactAmountIn: false,
//             collectionId: 0,
//             rateProvider: address(0)
//           },
//           onBehalfOf: 0x0000000000000000000000000000000000010000,
//           recipient: 0x0000000000000000000000000000000000010000
//         }
//       )
//     ),
//     callMarket(
//       0x0000000000000000000000000000000000000123,
//       withdrawOnBehalfOf(
//         {
//           params: {
//             token: 0x0000000000000000000000000000000000008888,
//             amount: type(uint256).max,
//             to: 0x0000000000000000000000000000000000010000
//           },
//           onBehalfOf: 0x0000000000000000000000000000000000010000
//         }
//       )
//     ),
//     setAuthorization(
//       SizeFactory,
//       []
//     )
//   ]
// ),
```

## Testing

```bash
npm test
```

## Publishing

```bash
# 1. Make sure tests pass
npm run test
# 2. Build
npm build
# 3. Publish
npm publish
```

## Disclaimer

This code is provided "as is" and has not undergone a formal security audit.

Use it at your own risk. The author(s) assume no liability for any damages or losses resulting from the use of this code. It is your responsibility to thoroughly review, test, and validate its security and functionality before deploying or relying on it in any environment.
