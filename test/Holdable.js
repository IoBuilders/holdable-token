const truffleAssert = require('truffle-assertions');
const randomString = require("randomstring");

const Holdable = artifacts.require('HoldableMock');

contract('Holdable', (accounts) => {
    let holdable;
    let operationId;

    const owner = accounts[0];
    const payer = accounts[1];
    const payee = accounts[2];
    const operator1 = accounts[3];
    const operator2 = accounts[4];
    const notary = accounts[5];
    const userC = accounts[6];

    const RELEASED_BY_NOTARY = 3;
    const RELEASED_BY_PAYEE = 4;
    const RELEASED_BY_EXPIRATION = 5;
    const ONE_DAY = 60 * 60 *24;

    beforeEach(async() => {
        holdable = await Holdable.new({from: owner});
        holdable.mint(payer, 3);

        operationId = randomString.generate();
    });

    describe('hold', async() => {
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

    describe(' HoldFrom', async() => {
        it('should successfully authorize 2 operators, revoke 1, fail a holdFrom from revoked operator and create a valid one with the authorized operator', async() => {
            const tx1 = await holdable.authorizeHoldOperator(
                operator1,
                {from: payer}

            );

            const tx2 = await holdable.authorizeHoldOperator(
                    operator2,
                    {from: payer}
              );

            const tx3 = await holdable.revokeHoldOperator(
                    operator2,
                    {from: payer}
              );

            await truffleAssert.reverts(
                holdable.holdFrom(
                    operationId,
                    payer,
                    payee,
                    notary,
                    1,
                    0,
                    {from: operator2}
                ),
            truffleAssert.ErrorType.REVERT,
            'The operator is not authorized'
            );

            const tx4 = await holdable.holdFrom(
                  operationId,
                  payer,
                  payee,
                  notary,
                  1,
                  0,
                  {from: operator1}
              );

            truffleAssert.eventEmitted(tx4, 'HoldCreated', (_event) => {
                return _event.holdIssuer === operator1 &&
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
            await holdable.setNow(hold.expiration + 1);

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

    describe('hold, Execute', async() => {
    it('should successfully create a hold and emit a HoldCreated , execute hold ', async() => {
            const tx1 = await holdable.hold(
                  operationId,
                  payee,
                  notary,
                  2,
                  0,
                  {from: payer}
            );

           assert.strictEqual((await holdable.balanceOf(payer)).toNumber(), 1);

            await truffleAssert.reverts(
                holdable.executeHold(
                    operationId,
                    1,
                    {from: payer}
                ),
            truffleAssert.ErrorType.REVERT,
            'The hold can only be executed by notary'
            );

            await truffleAssert.reverts(
                holdable.executeHold(
                    operationId,
                    1,
                    {from: payee}
                ),
            truffleAssert.ErrorType.REVERT,
            'The hold can only be executed by notary'
            );

            const tx2 = await holdable.executeHold(
                  operationId,
                  1,
                  {from: notary}
            );
           assert.strictEqual((await holdable.balanceOf(payer)).toNumber(), 2);
           assert.strictEqual((await holdable.balanceOf(payee)).toNumber(), 1);

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
            await holdable.setNow(hold.expiration + 1);

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
            await holdable.setNow(originalHold.expiration - 1);

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

            holdable.mint(userC, 3);
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
});


