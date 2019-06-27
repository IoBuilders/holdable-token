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
    const ReleasdByNotary = 3;

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


    describe('hold, Release', async() => {
    it('should successfully create a hold and emit a HoldCreated event. release hold and emit event', async() => {
            const tx1 = await holdable.hold(
                  operationId,
                  userB,
                  notary,
                  1,
                  0,
                  {from: userA}
            );

            truffleAssert.eventEmitted(tx1, 'HoldCreated', (_event) => {
                return _event.holdIssuer === userA &&
                    _event.operationId === operationId &&
                    _event.from === userA &&
                    _event.to === userB &&
                    _event.notary === notary &&
                    _event.value.toNumber() === 1 &&
                    _event.expiration.toNumber() === 0
                ;
            });
           assert.strictEqual((await holdable.balanceOf(userA)).toNumber(), 2);

            await truffleAssert.reverts(
                holdable.releaseHold(
                    operationId,
                    {from: userA}
                ),
            truffleAssert.ErrorType.REVERT,
            'The hold can only be released by notary or payee'
            );

            const tx2 = await holdable.releaseHold(
                  operationId,
                  {from: notary}
            );

            truffleAssert.eventEmitted(tx2, 'HoldReleased', (_event) => {
                return _event.holdIssuer === userA &&
                    _event.operationId === operationId &&
                    _event.status.toNumber() === ReleasdByNotary
                    
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
