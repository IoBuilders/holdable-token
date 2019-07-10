# Holdable Token

[![Build Status](https://travis-ci.org/IoBuilders/holdable-token.svg?branch=master)](https://travis-ci.org/IoBuilders/holdable-token)
[![Coverage Status](https://coveralls.io/repos/github/IoBuilders/holdable-token/badge.svg?branch=master)](https://coveralls.io/github/IoBuilders/holdable-token?branch=master)
[![npm](https://img.shields.io/npm/v/eip1996.svg)](https://www.npmjs.com/package/eip1996)

This is the reference implementation of [EIP Holdable Token](https://github.com/IoBuilders/EIPs/blob/eip-holdable-token/EIPS/eip-holdable-token.md). This implementation will change over time with the token standard and is not stable at the moment.

Feedback is appreciated and can given at [the discussion of the EIP](https://github.com/IoBuilders/EIPs/pull/1).

## Summary

An extension to the ERC-20 standard token that allows tokens to be put on hold. This guarantees a future transfer and makes the held tokens unavailable for transfer in the mean time. Holds are similar to escrows in that are firm and lead to final settlement.

## Abstract
A hold specifies a payer, a payee, a maximum amount, a notary and an expiration time. When the hold is created, the specified token balance from the payer is put on hold. A held balance cannot be transferred until the hold is either executed or released. The hold can only be executed by the notary, which triggers the transfer of the tokens from the payer to the payee. If a hold is released, either by the notary at any time, or by anyone after the expiration, no transfer is carried out and the amount is available again for the payer.

A hold can be partially executed, if the execution specifies an amount less than the maximum amount. In this case the specified amount is transferred to the payee and the remaining amount is available again to the payer.

Holds can be specified to be perpetual. In this case, the hold cannot be released upon expiration, and thus can only be executed by the notary or released by the notary or payee.

## Sequence diagrams

### Hold executed

The following diagram shows the sequence of the hold creation and execution.

![Holdable Token: Hold executed](http://www.plantuml.com/plantuml/png/SoWkIImgAStDuGejJYroLD2rKr3ooCz9IKpAILK8oSzEpLEoKiW02cYKv5ifWDGuQNAXgm3fyii76bHffG2ISYvAJIn9JU62Y64nKi5A8RKYDRcq91Ka0RSQOhwLGabHObvnMceHLel0YY7sk4BCIE5oICrB0Ve10000)

### Hold released by notary

The following diagram shows the sequence of a hold creation and release by the notary.

![Holdable Token: Hold released by notary](http://www.plantuml.com/plantuml/png/SoWkIImgAStDuGejJYroLD2rKr3ooCz9IKpAILK8oSzEpLEoKiW02cYKv5ifWDGuQNAXgm3fyii76bHffG2ISYvAJIn9JU62Y64nKi5AeIWr9pMnE1KaWTKyi7CWnWL1bE9H1pTE8ICr9qKXCJU_DA-4oo4rBmNeCm00)

### Hold released by payee

The following diagram shows the sequence of a hold creation and release by the payee.

![Holdable Token: Hold released by notary](http://www.plantuml.com/plantuml/png/SoWkIImgAStDuGejJYroLD2rKr3ooCz9IKpAILK8oSzEpLEoKiW02cYKv5ifWDGuQNAXgm3fyii76bHffG2ISYvAJIn9JU42AyTYeeALGb5gJcfYSIf80gjnODV0bIbafEQaA2JcvfVcbU1J3f89WcX9uN98pKi1UWm0)

### Hold released on expiration

The following diagram shows the sequence of a hold creation and release after it has expired. After a hold has expired it can be released by anobody. Here in the sequence by a not involved third-party user UserC

![Holdable Token: Hold released on expiration](http://www.plantuml.com/plantuml/png/SoWkIImgAStDuGejJYroLD2rKr3ooCz9IKpAILK8oSzEpLEoKiW02cYKv5ifWDGuQNAXgm3fyii76bHffG2ISYvAJIn9JG4RwOpDI0KhXQBKdDJ4ubIG15RpmCw1ArF8ICr9KKZCpI_DAy6d72GJ1D6ImkMGcfS2z1a0)

## State diagram

![Holdable Token: State Diagram](http://www.plantuml.com/plantuml/png/TOx1Jkj034Nt-GgldzGVU0jKWIgnegXRnCAfRvG8rrDv7EZyFTD0YaheAXdVu-Expi4Uuq6Rbt-lj5hTqTO53lbFZqdbmS41QRw7Is07mySlO7F2VeoPc5_DPI_I6onJwkZ81Kxie1ugn2PaAOZVUL1k5TGbft2stC6R7s_qDHfLgSPSBHu3wmMadZErW94a0rrrsq716N9VdbAmbw-EyxHPndisIgQb2kk_AeJQCXMmYRXXV-O2t9BFwMttyGpygTxQvdGSd6D8jlGlaUd8bP-jj4dgjmluTAsl5XeouRnMHMkOZ0Vz1000)

## Install

```
npm install eip1996
```

## Usage

To write your custom contracts, import it and extend it through inheritance.

```solidity
pragma solidity ^0.5.0;

import 'eip1996/contracts/Holdable.sol';

contract MyHoldable is Holdable {
    // your custom code
}
```

> You need an ethereum development framework for the above import statements to work! Check out these guides for [Truffle], [Embark] or [Buidler].

## Tests

To run the unit tests a local blockchain, like [Ganache](https://www.trufflesuite.com/ganache) has to be running.  Once it does execute `npm test` to run the tests.

## Code coverage

To run the code coverage simply execute `npm run coverage`

[Truffle]: https://truffleframework.com/docs/truffle/quickstart
[Embark]: https://embark.status.im/docs/quick_start.html
[Buidler]: https://buidler.dev/guides/#getting-started
