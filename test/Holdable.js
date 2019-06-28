const truffleAssert = require('truffle-assertions');
const randomString = require("randomstring");

const Holdable = artifacts.require('HoldableMock');

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

contract('Holdable', (accounts) => {
    let holdable;
    let operationId;

    const owner = accounts[0];
    const payer = accounts[1];
    const payee = accounts[2];
    const authorizedOperator = accounts[3];
    const unauthorizedOperator = accounts[4];
    const notary = accounts[5];
    const userC = accounts[6];

    const RELEASED_BY_NOTARY = 3;
    const RELEASED_BY_PAYEE = 4;
    const RELEASED_BY_EXPIRATION = 5;
    const ONE_DAY = 60 * 60 *24;

    beforeEach(async() => {
        holdable = await Holdable.new({from: owner});
        await holdable.mint(payer, 3);

        operationId = randomString.generate();
    });

    describe('hold', async() => {
        it('should revert if operation ID is empty', async() => {
            await truffleAssert.reverts(
                holdable.hold(
                    '',
                    payee,
                    notary,
                    1,
                    0,
                    {from: payer}
                ),
                'Operation ID must not be empty'
            );
        });

        it('should revert if value is zero', async() => {
            await truffleAssert.reverts(
                holdable.hold(
                    operationId,
                    payee,
                    notary,
                    0,
                    0,
                    {from: payer}
                ),
                'Value must be greater than zero'
            );
        });

        it('should revert if operation ID is already used', async() => {
            await holdable.hold(
                operationId,
                payee,
                notary,
                1,
                0,
                {from: payer}
            );

            await truffleAssert.reverts(
                holdable.hold(
                    operationId,
                    payee,
                    notary,
                    1,
                    0,
                    {from: payer}
                ),
                'This operationId already exists'
            );
        });

        it('should revert if payee address is zero', async() => {
            await truffleAssert.reverts(
                holdable.hold(
                    operationId,
                    ZERO_ADDRESS,
                    notary,
                    1,
                    0,
                    {from: payer}
                ),
                'Payee address must not be zero address'
            );
        });

        it('should revert if notary address is zero', async() => {
            await truffleAssert.reverts(
                holdable.hold(
                    operationId,
                    payee,
                    ZERO_ADDRESS,
                    1,
                    0,
                    {from: payer}
                ),
                'Notary address must not be zero address'
            );
        });

        it('should revert if value id greater than balance', async() => {
            await truffleAssert.reverts(
                holdable.hold(
                    operationId,
                    payee,
                    notary,
                    4,
                    0,
                    {from: payer}
                )
            );
        });

        it('should successfully create a hold and emit a HoldCreated event', async() => {
              const tx = await holdable.hold(
                  operationId,
                  payee,
                  notary,
                  1,
                  0,
                  {from: payer}
              );

            truffleAssert.eventEmitted(tx, 'HoldCreated', (_event) => {
                return _event.holdIssuer === payer &&
                    _event.operationId === operationId &&
                    _event.from === payer &&
                    _event.to === payee &&
                    _event.notary === notary &&
                    _event.value.toNumber() === 1 &&
                    _event.expiration.toNumber() === 0
                ;
            });
        });
    });

    describe('holdFrom', async() => {
        beforeEach(async() => {
            await holdable.authorizeHoldOperator(
                authorizedOperator,
                {from: payer}
            );
        });

        it('should revert if operation ID is empty', async() => {
            await truffleAssert.reverts(
                holdable.holdFrom(
                    '',
                    payer,
                    payee,
                    notary,
                    1,
                    0,
                    {from: authorizedOperator}
                ),
                'Operation ID must not be empty'
            );
        });

        it('should revert if value is zero', async() => {
            await truffleAssert.reverts(
                holdable.holdFrom(
                    operationId,
                    payer,
                    payee,
                    notary,
                    0,
                    0,
                    {from: authorizedOperator}
                ),
                'Value must be greater than zero'
            );
        });

        it('should revert if operation ID is already used', async() => {
            await holdable.holdFrom(
                operationId,
                payer,
                payee,
                notary,
                1,
                0,
                {from: authorizedOperator}
            );

            await truffleAssert.reverts(
                holdable.holdFrom(
                    operationId,
                    payer,
                    payee,
                    notary,
                    1,
                    0,
                    {from: authorizedOperator}
                ),
                'This operationId already exists'
            );
        });

        it('should revert if payer address is zero', async() => {
            await truffleAssert.reverts(
                holdable.holdFrom(
                    operationId,
                    ZERO_ADDRESS,
                    payee,
                    notary,
                    1,
                    0,
                    {from: authorizedOperator}
                ),
                'Payer address must not be zero address'
            );
        });

        it('should revert if payee address is zero', async() => {
            await truffleAssert.reverts(
                holdable.holdFrom(
                    operationId,
                    payer,
                    ZERO_ADDRESS,
                    notary,
                    1,
                    0,
                    {from: authorizedOperator}
                ),
                'Payee address must not be zero address'
            );
        });

        it('should revert if notary address is zero', async() => {
            await truffleAssert.reverts(
                holdable.holdFrom(
                    operationId,
                    payer,
                    payee,
                    ZERO_ADDRESS,
                    1,
                    0,
                    {from: authorizedOperator}
                ),
                'Notary address must not be zero address'
            );
        });

        it('should revert if value id greater than balance', async() => {
            await truffleAssert.reverts(
                holdable.holdFrom(
                    operationId,
                    payer,
                    payee,
                    notary,
                    4,
                    0,
                    {from: authorizedOperator}
                )
            );
        });

        it('should revert if operator is not authorized', async() => {
            await truffleAssert.reverts(
                holdable.holdFrom(
                    operationId,
                    payer,
                    payee,
                    notary,
                    1,
                    0,
                    {from: unauthorizedOperator}
                )
            );
        });

        it('should successfully create a hold and emit a HoldCreated event', async() => {
            const tx = await holdable.holdFrom(
                operationId,
                payer,
                payee,
                notary,
                1,
                0,
                {from: authorizedOperator}
            );

            truffleAssert.eventEmitted(tx, 'HoldCreated', (_event) => {
                return _event.holdIssuer === authorizedOperator &&
                    _event.operationId === operationId &&
                    _event.from === payer &&
                    _event.to === payee &&
                    _event.notary === notary &&
                    _event.value.toNumber() === 1 &&
                    _event.expiration.toNumber() === 0
                ;
            });
        });
    });

    describe('releaseHold', async() => {
        beforeEach(async() => {
            await holdable.hold(
                operationId,
                payee,
                notary,
                1,
                ONE_DAY,
                {from: payer}
            );
        });

        it('should revert if a non existing hold id is used', async() => {
            await truffleAssert.reverts(
                holdable.releaseHold(
                    randomString.generate(),
                    {from: notary}
                ),
                'A hold can only be released in status Ordered'
            );
        });

        it('should revert if anybody else instead of the notary or the payee call it while not expired', async() => {
            await truffleAssert.reverts(
                holdable.releaseHold(
                    operationId,
                    {from: payer}
                ),
                'A not expired hold can only be released by the notary or the payee'
            );
        });

        it('should be releasable by the notary and emit a HoldReleased event', async() => {
            const tx = await holdable.releaseHold(
                  operationId,
                  {from: notary}
            );

            truffleAssert.eventEmitted(tx, 'HoldReleased', (_event) => {
                return _event.holdIssuer === payer &&
                    _event.operationId === operationId &&
                    _event.status.toNumber() === RELEASED_BY_NOTARY
                ;
            });

           assert.strictEqual((await holdable.balanceOf(payer)).toNumber(), 3);
        });

        it('should be releasable by the payee and emit a HoldReleased event', async() => {
            const tx = await holdable.releaseHold(
                operationId,
                {from: payee}
            );

            truffleAssert.eventEmitted(tx, 'HoldReleased', (_event) => {
                return _event.holdIssuer === payer &&
                    _event.operationId === operationId &&
                    _event.status.toNumber() === RELEASED_BY_PAYEE
                    ;
            });

            assert.strictEqual((await holdable.balanceOf(payer)).toNumber(), 3);
        });

        it('should be releasable by anybody after a HoldReleased event', async() => {
            const hold = await holdable.retrieveHoldData(operationId);
            await holdable.setBlockTimeStamp(hold.expiration + 1);

            const tx = await holdable.releaseHold(
                operationId,
                {from: userC}
            );

            truffleAssert.eventEmitted(tx, 'HoldReleased', (_event) => {
                return _event.holdIssuer === payer &&
                    _event.operationId === operationId &&
                    _event.status.toNumber() === RELEASED_BY_EXPIRATION
                    ;
            });

            assert.strictEqual((await holdable.balanceOf(payer)).toNumber(), 3);
        });

        it('should revert if it has been already released', async() => {
            await holdable.releaseHold(
                operationId,
                {from: notary}
            );

            await truffleAssert.reverts(
                holdable.releaseHold(
                    operationId,
                    {from: notary}
                ),
                'A hold can only be released in status Ordered'
            );
        });
    });

    describe('executeHold', async() => {
        beforeEach(async() => {
            await holdable.hold(
                operationId,
                payee,
                notary,
                3,
                ONE_DAY,
                {from: payer}
            );
        });

        it('should revert if a non existing hold id is used', async() => {
            await truffleAssert.reverts(
                holdable.executeHold(
                    randomString.generate(),
                    1,
                    {from: notary}
                ),
                'A hold can only be executed in status Ordered'
            );
        });

        it('should revert if value is zero', async() => {
            await truffleAssert.reverts(
                holdable.executeHold(
                    operationId,
                    0,
                    {from: notary}
                ),
                'Value must be greater than zero'
            );
        });

        it('should revert if the hold has expired', async() => {
            const hold = await holdable.retrieveHoldData(operationId);
            await holdable.setBlockTimeStamp(hold.expiration + 1);

            await truffleAssert.reverts(
                holdable.executeHold(
                    operationId,
                    1,
                    {from: notary}
                ),
                'The hold has already expired'
            );
        });

        it('should revert if called by the payer', async() => {
            await truffleAssert.reverts(
                holdable.executeHold(
                    operationId,
                    1,
                    {from: payer}
                ),
                'The hold can only be executed by the notary'
            );
        });

        it('should revert if called by the payee', async() => {
            await truffleAssert.reverts(
                holdable.executeHold(
                    operationId,
                    1,
                    {from: payee}
                ),
                'The hold can only be executed by the notary'
            );
        });

        it('should revert if value is greater than the hold value', async() => {
            await truffleAssert.reverts(
                holdable.executeHold(
                    operationId,
                    4,
                    {from: notary}
                ),
                'The value should be equal or less than the held amount'
            );
        });

        it('should revert if the hold has been released', async() => {
            await holdable.releaseHold(
                operationId,
                {from: notary}
            );

            await truffleAssert.reverts(
                holdable.executeHold(
                    operationId,
                    1,
                    {from: notary}
                ),
                'A hold can only be executed in status Ordered'
            );
        });

        it('should execute the hold and emit a HoldExecuted event with the full amount', async() => {
            const tx = await holdable.executeHold(
                operationId,
                3,
                {from: notary}
            );

            const balanceOfPayer = await holdable.balanceOf(payer);
            const balanceOfPayee = await holdable.balanceOf(payee);

           assert.strictEqual(balanceOfPayer.toNumber(), 0);
           assert.strictEqual(balanceOfPayee.toNumber(), 3);

            truffleAssert.eventEmitted(tx, 'HoldExecuted', (_event) => {
                return _event.holdIssuer === payer &&
                    _event.operationId === operationId &&
                    _event.notary === notary &&
                    _event.heldValue.toNumber() === 3 &&
                    _event.transferredValue.toNumber() === 3
                ;
            });
        });

        it('should execute the hold and emit a HoldExecuted event with a partial amount', async() => {
            const tx = await holdable.executeHold(
                operationId,
                1,
                {from: notary}
            );

            const balanceOfPayer = await holdable.balanceOf(payer);
            const balanceOfPayee = await holdable.balanceOf(payee);

            assert.strictEqual(balanceOfPayer.toNumber(), 2);
            assert.strictEqual(balanceOfPayee.toNumber(), 1);

            truffleAssert.eventEmitted(tx, 'HoldExecuted', (_event) => {
                return _event.holdIssuer === payer &&
                    _event.operationId === operationId &&
                    _event.notary === notary &&
                    _event.heldValue.toNumber() === 3 &&
                    _event.transferredValue.toNumber() === 1
                    ;
            });
        });

        it('should revert if the hold has been partially executed before', async() => {
            await holdable.executeHold(
                operationId,
                1,
                {from: notary}
            );

            await truffleAssert.reverts(
                holdable.executeHold(
                    operationId,
                    1,
                    {from: notary}
                ),
                'A hold can only be executed in status Ordered'
            );
        });
    });

    describe('renewHold', async() => {
        beforeEach(async() => {
            await holdable.hold(
                operationId,
                payee,
                notary,
                1,
                ONE_DAY,
                {from: payer}
            );
        });

        it('should revert if a non existing hold id is used', async() => {
            await truffleAssert.reverts(
                holdable.renewHold(
                    randomString.generate(),
                    ONE_DAY,
                    {from: payer}
                ),
                'A hold can only be renewed in status Ordered'
            );
        });

        it('should revert if the hold has been released', async() => {
            await holdable.releaseHold(
                operationId,
                {from: notary}
            );

            await truffleAssert.reverts(
                holdable.renewHold(
                    operationId,
                    ONE_DAY,
                    {from: payer}
                ),
                'A hold can only be renewed in status Ordered'
            );
        });

        it('should revert if the hold has been executed', async() => {
            await holdable.executeHold(
                operationId,
                1,
                {from: notary}
            );

            await truffleAssert.reverts(
                holdable.renewHold(
                    operationId,
                    ONE_DAY,
                    {from: notary}
                ),
                'A hold can only be renewed in status Ordered'
            );
        });

        it('should revert if the hold has expired', async() => {
            const hold = await holdable.retrieveHoldData(operationId);
            await holdable.setBlockTimeStamp(hold.expiration + 1);

            await truffleAssert.reverts(
                holdable.renewHold(
                    operationId,
                    ONE_DAY,
                    {from: payer}
                ),
                'An expired hold can not be renewed'
            );
        });

        it('should revert if a notary calls it', async() => {
            await truffleAssert.reverts(
                holdable.renewHold(
                    operationId,
                    ONE_DAY,
                    {from: notary}
                ),
                'The hold can only be renewed by the issuer or the payer'
            );
        });

        it('should renew and emit a HoldRenewed when called by the payer with a non zero value', async() => {
            const originalHold = await holdable.retrieveHoldData(operationId);
            await holdable.setBlockTimeStamp(originalHold.expiration - 1);

            const tx = await holdable.renewHold(
                operationId,
                ONE_DAY,
                {from: payer}
            );

            const renewedHold = await holdable.retrieveHoldData(operationId);
            assert.strictEqual(
                renewedHold.expiration.toNumber(),
                originalHold.expiration.toNumber() - 1 + ONE_DAY,
                'Hold was not renewed correctly'
            );

            truffleAssert.eventEmitted(tx, 'HoldRenewed', (_event) => {
                return _event.holdIssuer === payer &&
                    _event.operationId === operationId &&
                    _event.oldExpiration.toNumber() === originalHold.expiration.toNumber() &&
                    _event.newExpiration.toNumber() === renewedHold.expiration.toNumber()
                ;
            });
        });

        it('should renew and emit a HoldRenewed when called by the payer with a zero value', async() => {
            const originalHold = await holdable.retrieveHoldData(operationId);

            const tx = await holdable.renewHold(
                operationId,
                0,
                {from: payer}
            );

            const renewedHold = await holdable.retrieveHoldData(operationId);
            assert.strictEqual(
                renewedHold.expiration.toNumber(),
                0,
                'Hold was not renewed correctly'
            );

            truffleAssert.eventEmitted(tx, 'HoldRenewed', (_event) => {
                return _event.holdIssuer === payer &&
                    _event.operationId === operationId &&
                    _event.oldExpiration.toNumber() === originalHold.expiration.toNumber() &&
                    _event.newExpiration.toNumber() === 0
                ;
            });
        });
    });

    describe('balanceOnHold', async() => {
        beforeEach(async() => {
            await holdable.hold(
                operationId,
                payee,
                notary,
                1,
                ONE_DAY,
                {from: payer}
            );
        });

        it('should return the held balance of a user', async() => {
            let balanceOnHold = await holdable.balanceOnHold(payer);
            assert.strictEqual(balanceOnHold.toNumber(), 1, 'balanceOnHold not correct after one hold');

            await holdable.hold(
                randomString.generate(),
                payee,
                notary,
                2,
                ONE_DAY,
                {from: payer}
            );

            balanceOnHold = await holdable.balanceOnHold(payer);
            assert.strictEqual(balanceOnHold.toNumber(), 3, 'balanceOnHold not correct after two holds');
        });
    });

    describe('netBalanceOf', async() => {
        beforeEach(async() => {
            await holdable.hold(
                operationId,
                payee,
                notary,
                1,
                ONE_DAY,
                {from: payer}
            );
        });

        it('should return the balance including the held balance of a user', async() => {
            let netBalance = await holdable.netBalanceOf(payer);
            assert.strictEqual(netBalance.toNumber(), 3, 'netBalanceOf not correct after one hold');

            await holdable.hold(
                randomString.generate(),
                payee,
                notary,
                2,
                ONE_DAY,
                {from: payer}
            );

            netBalance = await holdable.netBalanceOf(payer);
            assert.strictEqual(netBalance.toNumber(), 3, 'netBalanceOf not correct after two holds');
        });
    });

    describe('totalSupplyOnHold', async() => {
        beforeEach(async() => {
            await holdable.hold(
                operationId,
                payee,
                notary,
                3,
                ONE_DAY,
                {from: payer}
            );

            await holdable.mint(userC, 3);
        });

        it('should return the balance including the held balance of a user', async() => {
            let totalSupplyOnHold = await holdable.totalSupplyOnHold();
            assert.strictEqual(totalSupplyOnHold.toNumber(), 3, 'totalSupplyOnHold not correct after one hold');

            await holdable.hold(
                randomString.generate(),
                payee,
                notary,
                2,
                ONE_DAY,
                {from: userC}
            );

            totalSupplyOnHold = await holdable.totalSupplyOnHold();
            assert.strictEqual(totalSupplyOnHold.toNumber(), 5, 'totalSupplyOnHold not correct after two holds');
        });
    });

    describe('revokeHoldOperator', async() => {
        it('should revert if an operator has not been authorized', async() => {
            await truffleAssert.reverts(
                holdable.revokeHoldOperator(unauthorizedOperator, {from: payer}),
                'The operator is already not authorized'
            );
        });

        it('should revoke the authorization of an operator and emit a RevokedHoldOperator event', async() => {
            await holdable.authorizeHoldOperator(unauthorizedOperator, {from: payer});

            const tx = await holdable.revokeHoldOperator(unauthorizedOperator, {from: payer});

            const isAuthorized = await holdable.isHoldOperatorFor(authorizedOperator, payer);
            assert.strictEqual(isAuthorized, false, 'Operator authorization has not been revoked');

            truffleAssert.eventEmitted(tx, 'RevokedHoldOperator', (_event) => {
                return _event.operator === unauthorizedOperator && _event.account === payer;
            });
        });
    });

    describe('authorizeHoldOperator', async() => {
        it('should authorize an operator and emit a AuthorizedHoldOperator event', async() => {
            const tx = await holdable.authorizeHoldOperator(authorizedOperator, {from: payer});

            const isAuthorized = await holdable.isHoldOperatorFor(authorizedOperator, payer);
            assert.strictEqual(isAuthorized, true, 'Operator has not been authorized');

            truffleAssert.eventEmitted(tx, 'AuthorizedHoldOperator', (_event) => {
                return _event.operator === authorizedOperator && _event.account === payer;
            });
        });

        it('should revert if an operator has already been authorized', async() => {
            await holdable.authorizeHoldOperator(authorizedOperator, {from: payer});

            await truffleAssert.reverts(
                holdable.authorizeHoldOperator(authorizedOperator, {from: payer}),
                'The operator is already authorized'
            );
        });
    });

    describe('isHoldOperatorFor', async() => {
        it('should return false if account is not a hold operator', async() => {
            const isHoldOperator = await holdable.isHoldOperatorFor(authorizedOperator, payer);

            assert.strictEqual(isHoldOperator, false, 'isHoldOperatorFor should return false');
        });

        it('should return true if account is a hold operator', async() => {
            await holdable.authorizeHoldOperator(authorizedOperator, {from: payer});
            await holdable.authorizeHoldOperator(unauthorizedOperator, {from: payer});

            let isHoldOperator = await holdable.isHoldOperatorFor(authorizedOperator, payer);
            assert.strictEqual(isHoldOperator, true, 'isHoldOperatorFor should return true for first operator');

            isHoldOperator = await holdable.isHoldOperatorFor(unauthorizedOperator, payer);
            assert.strictEqual(isHoldOperator, true, 'isHoldOperatorFor should return true for second operator');
        });
    });

    describe('transfer', async() => {
        beforeEach(async() => {
            await holdable.hold(
                operationId,
                payee,
                notary,
                1,
                ONE_DAY,
                {from: payer}
            );
        });

        it('should revert if available balance is less than amount to be transferred', async() => {
            await truffleAssert.reverts(
                holdable.transfer(
                    payee,
                    3,
                    {from: payer}
                ),
                'Not enough available balance'
            );
        });

        it('should use the ERC-20 transfer function successfully if available balance is sufficient', async() => {
            const tx = await holdable.transfer(
                payee,
                2,
                {from: payer}
            );

            const balanceOfPayer = await holdable.balanceOf(payer);
            assert.strictEqual(balanceOfPayer.toNumber(), 0, 'Balance of payer not updated after transfer');

            const balanceOfPayee = await holdable.balanceOf(payee);
            assert.strictEqual(balanceOfPayee.toNumber(), 2, 'Balance of payee not updated after transfer');

            truffleAssert.eventEmitted(tx, 'Transfer', (_event) => {
                return _event.from === payer &&
                    _event.to === payee &&
                    _event.value.toNumber() === 2
                ;
            });
        });
    });

    describe('transferFrom', async() => {
        beforeEach(async() => {
            await holdable.hold(
                operationId,
                payee,
                notary,
                1,
                ONE_DAY,
                {from: payer}
            );

            await holdable.approve(userC, 3, {from: payer});
        });

        it('should revert if available balance is less than amount to be transferred', async() => {
            await truffleAssert.reverts(
                holdable.transferFrom(
                    payer,
                    payee,
                    3,
                    {from: userC}
                ),
                'Not enough available balance'
            );
        });

        it('should use the ERC-20 transferFrom function successfully if available balance is sufficient', async() => {
            const tx = await holdable.transferFrom(
                payer,
                payee,
                2,
                {from: userC}
            );

            const balanceOfPayer = await holdable.balanceOf(payer);
            assert.strictEqual(balanceOfPayer.toNumber(), 0, 'Balance of payer not updated after transfer');

            const balanceOfPayee = await holdable.balanceOf(payee);
            assert.strictEqual(balanceOfPayee.toNumber(), 2, 'Balance of payee not updated after transfer');

            truffleAssert.eventEmitted(tx, 'Transfer', (_event) => {
                return _event.from === payer &&
                    _event.to === payee &&
                    _event.value.toNumber() === 2
                    ;
            });
        });
    });
});
