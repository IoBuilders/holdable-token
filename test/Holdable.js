const truffleAssert = require('truffle-assertions');
const randomString = require("randomstring");

const Holdable = artifacts.require('HoldableMock');

contract('Holdable', (accounts) => {
    let holdable;
    let operationId;

    const owner = accounts[0];
    const userA = accounts[1];
    const userB = accounts[2];
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
        holdable.mint(userA, 3);

        operationId = randomString.generate();
    });

    describe('hold', async() => {
        it('should revert if value id greater than balance', async() => {
            await truffleAssert.reverts(
                holdable.hold(
                    operationId,
                    userB,
                    notary,
                    4,
                    0,
                    {from: userA}
                )
            );
        });

        it('should successfully create a hold and emit a HoldCreated event', async() => {
              const tx = await holdable.hold(
                  operationId,
                  userB,
                  notary,
                  1,
                  0,
                  {from: userA}
              );

            truffleAssert.eventEmitted(tx, 'HoldCreated', (_event) => {
                return _event.holdIssuer === userA &&
                    _event.operationId === operationId &&
                    _event.from === userA &&
                    _event.to === userB &&
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
                {from: userA}

            );

            const tx2 = await holdable.authorizeHoldOperator(
                    operator2,
                    {from: userA}
              );

            const tx3 = await holdable.revokeHoldOperator(
                    operator2,
                    {from: userA}
              );

            await truffleAssert.reverts(
                holdable.holdFrom(
                    operationId,
                    userA,
                    userB,
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
                  userA,
                  userB,
                  notary,
                  1,
                  0,
                  {from: operator1}
              );

            truffleAssert.eventEmitted(tx4, 'HoldCreated', (_event) => {
                return _event.holdIssuer === operator1 &&
                    _event.operationId === operationId &&
                    _event.from === userA &&
                    _event.to === userB &&
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
                userB,
                notary,
                1,
                ONE_DAY,
                {from: userA}
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
                    {from: userA}
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
                return _event.holdIssuer === userA &&
                    _event.operationId === operationId &&
                    _event.status.toNumber() === RELEASED_BY_NOTARY
                ;
            });

           assert.strictEqual((await holdable.balanceOf(userA)).toNumber(), 3);
        });

        it('should be releasable by the payee and emit a HoldReleased event', async() => {
            const tx = await holdable.releaseHold(
                operationId,
                {from: userB}
            );

            truffleAssert.eventEmitted(tx, 'HoldReleased', (_event) => {
                return _event.holdIssuer === userA &&
                    _event.operationId === operationId &&
                    _event.status.toNumber() === RELEASED_BY_PAYEE
                    ;
            });

            assert.strictEqual((await holdable.balanceOf(userA)).toNumber(), 3);
        });

        it('should be releasable by anybody after a HoldReleased event', async() => {
            const hold = await holdable.retrieveHoldData(operationId);
            await holdable.setNow(hold.expiration + 1);

            const tx = await holdable.releaseHold(
                operationId,
                {from: userC}
            );

            truffleAssert.eventEmitted(tx, 'HoldReleased', (_event) => {
                return _event.holdIssuer === userA &&
                    _event.operationId === operationId &&
                    _event.status.toNumber() === RELEASED_BY_EXPIRATION
                    ;
            });

            assert.strictEqual((await holdable.balanceOf(userA)).toNumber(), 3);
        });
    });

    describe('hold, Execute', async() => {
    it('should successfully create a hold and emit a HoldCreated , execute hold ', async() => {
            const tx1 = await holdable.hold(
                  operationId,
                  userB,
                  notary,
                  2,
                  0,
                  {from: userA}
            );

           assert.strictEqual((await holdable.balanceOf(userA)).toNumber(), 1);

            await truffleAssert.reverts(
                holdable.executeHold(
                    operationId,
                    1,
                    {from: userA}
                ),
            truffleAssert.ErrorType.REVERT,
            'The hold can only be executed by notary'
            );

            await truffleAssert.reverts(
                holdable.executeHold(
                    operationId,
                    1,
                    {from: userB}
                ),
            truffleAssert.ErrorType.REVERT,
            'The hold can only be executed by notary'
            );

            const tx2 = await holdable.executeHold(
                  operationId,
                  1,
                  {from: notary}
            );
           assert.strictEqual((await holdable.balanceOf(userA)).toNumber(), 2);
           assert.strictEqual((await holdable.balanceOf(userB)).toNumber(), 1);

        });
    });
});
