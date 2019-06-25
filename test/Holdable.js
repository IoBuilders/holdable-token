const truffleAssert = require('truffle-assertions');
const randomString = require("randomstring");

const Holdable = artifacts.require('HoldableMock');

contract('Holdable', (accounts) => {
    let holdable;
    let operationId;

    const owner = accounts[0];
    const userA = accounts[1];
    const userB = accounts[2];
    const operator = accounts[3];
    const notary = accounts[4];

    beforeEach(async() => {
        holdable = await Holdable.new({from: owner});
        holdable.mint(userA, 1);

        operationId = randomString.generate();
    });

    describe('hold', async() => {
        it('should revert if value id greater than balance', async() => {
            await truffleAssert.reverts(
                holdable.hold(
                    operationId,
                    userB,
                    notary,
                    2,
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
});
