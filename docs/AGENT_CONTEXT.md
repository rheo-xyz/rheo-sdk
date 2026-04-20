# Rheo SDK — AI Agent Context

## What this file is

This document is context for **rheo-ai-agent**. It describes `@rheo/sdk` so the agent can compose onchain transactions the user will sign. It does **not** describe market pricing, user positions, or balances — **those come from the backend**. The agent never invents rates, maturities, creditPositionIds, or addresses. It takes backend-supplied values and threads them into the SDK's operation builders.

Use this file as the composition contract: it specifies what operations exist, what parameters they need, what shape the result has, and what the common recipes look like. Everything outside this contract — user intent parsing, quote lookup, balance checks, explanation text — belongs elsewhere.

Also available as `import { agentContext } from "@rheo/sdk"` or `SDK.agentContext` — the same content shipped as a string constant.

---

## Domain glossary

- **Market** — a deployed Rheo contract bound to one `(collateralToken, borrowToken)` pair. Addresses are per-deployment; the backend supplies them.
- **SizeFactory** — the single onchain entry point. It is used for **all** Rheo markets as well as the legacy Size markets (v1.7, v1.8). There is **no** separate `RheoFactory`. Every `sdk.tx.build(...)` run ultimately produces a call to this address (plus any ERC-20 approvals).
- **Maturity** — absolute unix timestamp in seconds at which a credit position's debt is due. Passed in v1.9 market-order params as `maturity: BigNumberish`. Not a duration.
- **Tenor** — duration in seconds (maturity − now). v1.9 does **not** use tenor in market orders. It only appears as range bounds (`minTenor`, `maxTenor`) inside `CopyLimitOrderConfig`.
- **Credit position** — the lender's side of a loan. Holds a claim on a future repayment.
- **Debt position** — the borrower's side. Linked to the credit position by `debtPositionId`.
- **Limit order** — resting liquidity. A user's `buyCreditLimit` offer is a list of `(maturity, APR)` points at which they are willing to lend; `sellCreditLimit` is the mirror for borrowing. Fixed-maturity only in v1.9 — expressed as two parallel arrays `maturities[]` and `aprs[]`.
- **Market order** — taker side. `buyCreditMarket` matches an existing borrow offer; `sellCreditMarket` matches an existing loan offer. These take a specific `borrower` or `lender` address.
- **APR** — `BigNumberish`, opaque to the SDK. By convention the onchain representation is 18-decimal WAD (e.g. `5e16` ≈ 5%), but the agent **never computes, compares, or formats APR values** — always thread backend-supplied values through unchanged.
- **Action bitmap** — a `uint256` / `bigint` with one bit per `Action` enum member. Used onchain by `setAuthorization` to grant a delegate a specific set of permissions. `TxBuilder.build` assembles and clears the bitmap automatically; agents do not touch it directly.
- **onBehalfOf** — the identity whose positions are being modified. Usually the end user's EOA. Flow: the signing EOA grants the SizeFactory an action-bitmap authorization, the SizeFactory calls the market's `*OnBehalfOf` variant carrying `onBehalfOf`, and the market credits/debits that identity.
- **recipient** — the address that receives tokens on taker-side ops (`buyCreditMarket`, `sellCreditMarket`, `selfLiquidate`). Defaults to `onBehalfOf` when omitted. Only override when a third party should receive funds.
- **Collection** — a curated group of rate providers the user can subscribe to. When a taker specifies a non-zero `collectionId` in a market order, the matching routes through that collection's rate provider. `collectionId: 0` means "no collection."
- **Copy-limit-order config** — per-user (and per-collection) rules for automatically mirroring another user's resting orders. Built from the three presets in `sdk.constants` unless custom tenor/APR ranges are needed.

---

## SDK shape

### Instantiation

```ts
import SDK from "@rheo/sdk";

const sdk = new SDK({
  sizeFactory: "0xSizeFactoryAddress", // same contract for v1.7/v1.8/v1.9
  version: "v1.9",
  labels: {
    "0xSizeFactoryAddress": "SizeFactory", // optional; used by calldata decoder
  },
});
```

### Top-level surface

```ts
sdk.sizeFactory      // Address — SizeFactory
sdk.version          // "v1.9" (or "v1.8" / "v1.7")
sdk.market           // v1.9 MarketActions — builds market operations
sdk.factory          // v1.9 FactoryActions — builds factory operations
sdk.erc20            // ERC20Actions — builds ERC-20 approvals
sdk.tx.build(...)    // compiles operations into TxArgs[]
sdk.helpers          // { deadline, selector, Authorization }
sdk.decode           // { error(data), calldata(data) }
sdk.constants        // { FullCopy, NoCopy, NullCopy }
```

### The build contract

```ts
sdk.tx.build(
  onBehalfOf: Address,
  operations: OperationV1_9[],
  recipient?: Address,   // defaults to onBehalfOf on taker ops
): TxArgs[]
```

`TxArgs` is:

```ts
{ target: Address; data: string; value?: BigNumberish }
```

These are **unsigned** transactions. Each entry is submitted in order. ERC-20 approvals (when present) come out first as stand-alone transactions; everything else collapses into a single SizeFactory multicall.

The agent's job ends with producing the `sdk.tx.build(...)` call. The host application signs and submits.

---

## v1.9 parameter shapes

All fields are `BigNumberish` (accepts `number`, `bigint`, `BigNumber`, or decimal string) unless noted. Addresses are `\`0x${string}\``.

### Market operations

#### `sdk.market.deposit(market, params, value?)`

```ts
params: {
  token: Address,     // ERC-20 to deposit; or the wrapped-native token
  amount: BigNumberish, // token base units, respect decimals
  to: Address,        // whose market-internal balance to credit (usually the user)
}
// value?: native-asset value, only when the token is native
```

Remember to precede with `sdk.erc20.approve(token, sdk.sizeFactory, amount)` if allowance is not already in place.

#### `sdk.market.withdraw(market, params)`

```ts
params: {
  token: Address,
  amount: BigNumberish, // use ethers.constants.MaxUint256 for "all"
  to: Address,          // recipient of the onchain transfer
}
```

#### `sdk.market.buyCreditLimit(market, params)` — place loan offer

```ts
params: {
  maturities: BigNumberish[], // unix seconds, parallel with aprs
  aprs: BigNumberish[],       // from backend quote; opaque WAD
}
```

Replaces any prior loan offer. Pass empty arrays to remove.

#### `sdk.market.buyCreditMarket(market, params)` — take a borrow offer

```ts
params: {
  borrower: Address,             // from backend quote
  creditPositionId: BigNumberish, // ethers.constants.MaxUint256 to open a new position
  amount: BigNumberish,
  maturity: BigNumberish,        // unix seconds, absolute
  deadline: BigNumberish,        // unix seconds, prefer sdk.helpers.deadline(60)
  minAPR: BigNumberish,          // slippage floor; from backend or 0n for "any"
  exactAmountIn: boolean,        // true = spend exactly `amount`, false = receive exactly `amount`
  collectionId: BigNumberish,    // 0n for no collection
  rateProvider: Address,         // ethers.constants.AddressZero when collectionId === 0
}
```

#### `sdk.market.sellCreditLimit(market, params)` — place borrow offer

```ts
params: {
  maturities: BigNumberish[], // unix seconds, parallel with aprs
  aprs: BigNumberish[],       // from backend quote
}
```

Replaces any prior borrow offer. Pass empty arrays to remove.

#### `sdk.market.sellCreditMarket(market, params)` — take a loan offer

```ts
params: {
  lender: Address,               // from backend quote
  creditPositionId: BigNumberish, // ethers.constants.MaxUint256 to open a new position
  amount: BigNumberish,
  maturity: BigNumberish,
  deadline: BigNumberish,        // prefer sdk.helpers.deadline(60)
  maxAPR: BigNumberish,          // slippage cap; ethers.constants.MaxUint256 for "any"
  exactAmountIn: boolean,
  collectionId: BigNumberish,
  rateProvider: Address,
}
```

#### `sdk.market.selfLiquidate(market, params)`

```ts
params: {
  creditPositionId: BigNumberish, // the user's lender-side position to burn
}
```

Valid only when the linked debt is flagged self-liquidatable.

#### `sdk.market.setUserConfiguration(market, params)`

```ts
params: {
  openingLimitBorrowCR: BigNumberish,       // min CR for new borrows; WAD-like
  allCreditPositionsForSaleDisabled: boolean,
  creditPositionIdsForSale: boolean,        // applies to creditPositionIds
  creditPositionIds: BigNumberish[],
}
```

#### `sdk.market.setCopyLimitOrderConfigs(market, params)`

```ts
params: {
  copyLoanOfferConfig: CopyLimitOrderConfigStruct,   // sdk.constants.FullCopy / NoCopy / NullCopy
  copyBorrowOfferConfig: CopyLimitOrderConfigStruct,
}
```

`CopyLimitOrderConfig` has fields `{ minTenor, maxTenor, minAPR, maxAPR, offsetAPR }`. Prefer the presets unless the user wants a custom range.

#### `sdk.market.setVault(market, params)`

```ts
params: {
  vault: Address,             // ERC-4626 vault; ethers.constants.AddressZero to unset
  forfeitOldShares: boolean,  // false = migrate existing shares, true = leave behind
}
```

### Factory operations

#### `sdk.factory.subscribeToCollections(collectionIds)`

```ts
collectionIds: BigNumberish[]
```

#### `sdk.factory.unsubscribeFromCollections(collectionIds)`

```ts
collectionIds: BigNumberish[]
```

#### `sdk.factory.setAuthorization([operator, bitmap])`

**Agents almost never emit this.** `tx.build` handles authorization automatically around market operations. Only use for standalone flows where a persistent authorization is needed.

#### `sdk.factory.revokeAllAuthorizations()`

No params. Clears every authorization the user has granted.

#### `sdk.factory.setUserCollectionCopyLimitOrderConfigs([collectionId, loanConfig, borrowConfig])`

Per-collection override for copy-trading config — takes precedence over market-level configs set via `sdk.market.setCopyLimitOrderConfigs`.

### ERC-20 operations

#### `sdk.erc20.approve(token, spender, amount)`

```ts
token: Address    // ERC-20 token to approve
spender: Address  // usually sdk.sizeFactory
amount: BigNumberish // often ethers.constants.MaxUint256 for convenience
```

---

## Recipes

Every recipe returns a `TxArgs[]` the host can sign and submit in order.

### Recipe 1 — Deposit and place a loan offer

The user wants to deposit borrow-token into a market and advertise a loan offer at specific maturities and APRs (backend-supplied).

```ts
import SDK from "@rheo/sdk";
import { ethers } from "ethers";

const sdk = new SDK({ sizeFactory: "0xSizeFactory", version: "v1.9" });

const alice = "0xUserAddress" as const;
const market = "0xMarketAddress" as const;
const usdc = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;

const txs = sdk.tx.build(alice, [
  sdk.erc20.approve(usdc, sdk.sizeFactory, ethers.constants.MaxUint256),
  sdk.market.deposit(market, {
    token: usdc,
    amount: 1_000_000_000n, // 1000 USDC (6 decimals)
    to: alice,
  }),
  sdk.market.buyCreditLimit(market, {
    maturities: [1893456000n, 1893542400n], // from backend
    aprs: [500000000000000000n, 600000000000000000n], // from backend (WAD)
  }),
]);

// txs[0] → approve on USDC
// txs[1] → SizeFactory multicall with setAuthorization + deposit + buyCreditLimit + clearAuth
```

### Recipe 2 — Take a loan offer (market order)

The user wants to borrow against a specific lender's resting offer. The backend has supplied `lender`, `maturity`, and a quote (`maxAPR`).

```ts
const txs = sdk.tx.build(alice, [
  sdk.market.sellCreditMarket(market, {
    lender: "0xLenderFromBackend",
    creditPositionId: ethers.constants.MaxUint256, // new position
    amount: 500_000_000n,          // 500 USDC worth of credit to sell
    maturity: 1893456000n,         // from backend quote
    deadline: sdk.helpers.deadline(60), // compute at send-time
    maxAPR: 800000000000000000n,   // from backend (WAD)
    exactAmountIn: false,
    collectionId: 0n,
    rateProvider: ethers.constants.AddressZero,
  }),
]);
```

A single market op produces a single `TxArgs` targeting the SizeFactory (no ERC-20 txs since there's no deposit here; but the user must already have collateral + authorization on the market side — verify via the backend).

### Recipe 3 — Self-liquidate a creditor position

The user's credit position (say id `42`) has become underwater and is flagged self-liquidatable. The user wants to burn it to collect the debtor's collateral.

```ts
const txs = sdk.tx.build(alice, [
  sdk.market.selfLiquidate(market, {
    creditPositionId: 42n,
  }),
]);
```

### Recipe 4 — Subscribe to a collection and configure copy-trading

The user wants to subscribe to collection `7` and mirror every loan offer it publishes but ignore borrow offers.

```ts
const txs = sdk.tx.build(alice, [
  sdk.factory.subscribeToCollections([7n]),
  sdk.factory.setUserCollectionCopyLimitOrderConfigs([
    7n,
    sdk.constants.FullCopy, // copy loan offers unchanged
    sdk.constants.NoCopy,   // ignore borrow offers
  ]),
]);
```

Both ops are factory-level, so they appear inline in the SizeFactory multicall. No market ops → no authorization wrapping.

### Recipe 5 — Withdraw and revoke all authorizations

The user is exiting and wants to pull tokens out and clear any standing grants.

```ts
const txs = sdk.tx.build(alice, [
  sdk.market.withdraw(market, {
    token: usdc,
    amount: ethers.constants.MaxUint256, // everything
    to: alice,
  }),
  sdk.factory.revokeAllAuthorizations(),
]);
```

---

## Gotchas

These are the edge cases an agent will get wrong without explicit instruction.

1. **Compute `deadline` inline, at send-time.** The LLM will have a stale clock relative to whoever signs the transaction. Always emit `sdk.helpers.deadline(60)` inside the `build` expression — never a literal unix timestamp.
2. **ERC-20 approvals come out as separate leading `TxArgs`.** Do not try to fold approvals inside the SizeFactory multicall or wrap them in a market call. Let `TxBuilder` split them out; just include the `sdk.erc20.approve(...)` operation at the start of the ops list.
3. **`sdk.tx.build` throws on empty `operations[]`.** Never emit an empty array. If the user's request boils down to "do nothing," explain that instead of producing a tx.
4. **Authorization is automatic.** `TxBuilder.build` prepends `setAuthorization(bitmap)` and appends `setAuthorization(0)` inside the multicall whenever any market operation is present. **Do not emit `sdk.factory.setAuthorization(...)` alongside market operations** — you will double-grant and the SizeFactory may reject or leave residual authorization.
5. **`collectionId: 0n` means "no collection," not "collection #0."** When `collectionId === 0n`, `rateProvider` must be `ethers.constants.AddressZero`. When using a real collection, both values come from the backend.
6. **`creditPositionId: ethers.constants.MaxUint256` means "open a new position"** on market orders. To match into a specific existing position, use the backend-supplied id.
7. **APRs are opaque.** Never compute, compare, or adjust APR values. The backend is the only source of truth; thread its values into params unchanged.
8. **`maturities`/`aprs` arrays must be parallel.** Array lengths must match in `buyCreditLimit` and `sellCreditLimit`. Empty arrays remove the offer entirely.
9. **`maturity` is an absolute unix timestamp in v1.9, not a duration.** The old Size v1.8 `tenor` field (duration in seconds) no longer exists on market-order params.
10. **One SizeFactory address covers every version.** There is no `RheoFactory`. `sdk.sizeFactory` is the single target for the outer multicall regardless of whether the user is on v1.7, v1.8, or v1.9.
11. **`recipient` on taker ops defaults to `onBehalfOf`.** Only pass a distinct `recipient` when the end user wants tokens routed somewhere other than their own address.
12. **`amount` is in token base units**, not human units. USDC (6 decimals) "1000" is `1_000_000_000n`. The backend typically returns pre-scaled values — do not re-scale.
13. **Native-asset value.** The `value` parameter on `deposit(market, params, value?)` is only used for native-token deposits (wrapped on the way in). Omit it for ERC-20 deposits.

---

## Decoder usage

These are helpers, not transaction-building steps — an agent may surface them when the user's flow includes post-tx inspection.

### Decode a failed transaction

```ts
try {
  await tx.wait();
} catch (err: any) {
  const decoded = sdk.decode.error(err.data);
  // e.g. "MUST_IMPROVE_COLLATERAL_RATIO(0xUser, 1500000, 1400000)"
  //      "ERC20InsufficientBalance(0xUser, 1000000, 2000000)"
}
```

### Preview outgoing calldata

```ts
for (const t of txs) {
  console.log(sdk.decode.calldata(t.data));
}
// multicall(
//   [
//     setAuthorization(SizeFactory, [DEPOSIT,BUY_CREDIT_LIMIT]),
//     callMarket(0xMarket, multicall([
//       depositOnBehalfOf({ params: {...}, onBehalfOf: 0xUser }),
//       buyCreditLimitOnBehalfOf({ params: {...}, onBehalfOf: 0xUser }),
//     ])),
//     setAuthorization(SizeFactory, [])
//   ]
// )
```

The decoder uses the `labels` map from the SDK constructor to substitute friendly names for well-known addresses.

---

## What this file doesn't tell you

- **Current rates, maturities, borrowers, lenders, collectionIds, or rateProviders** — all from the backend.
- **User balances and position state** — from the backend.
- **Whether a particular action is authorized/allowed onchain** — simulate via the host wallet, or verify via backend state. The SDK does not perform preflight checks.
- **How to sign or broadcast.** The agent's responsibility ends at returning `TxArgs[]`. The host application handles signing via the user's wallet and submits to the network.
- **Gas estimation** — use the host's provider (`provider.estimateGas`) or the wallet's built-in estimator.
- **Migrations between versions.** If the backend says a market is v1.8, the agent must use a `version: "v1.8"` SDK; the shapes differ (notably `tenor` vs `maturity`) and are not documented here.
