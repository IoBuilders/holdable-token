const truffleAssert = require('truffle-assertions');
const randomString = require("randomstring");

const Holdable = artifacts.require('HoldableMock');
const IHoldable = artifacts.require('IHoldable');

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const ORDERED = 1;
const EXECUTED = 2;
const EXECUTED_AND_KEPT_OPEN = 3;
const RELEASED_BY_NOTARY = 4;
const RELEASED_BY_PAYEE = 5;
const RELEASED_BY_EXPIRATION = 6;

const ONE_DAY = 60 * 60 * 24;
const ONE_WEEK = ONE_DAY * 7;
const TWELVE_HOURS = 60 * 60 * 12;

contract('Holdable', (accounts) => {
    let holdable;
    let holdableInterface;
    let operationId;

    const owner = accounts[0];
    const payer = accounts[1];
    const payee = accounts[2];
    const authorizedOperator = accounts[3];
    const unauthorizedOperator = accounts[4];
    const notary = accounts[5];
    const userC = accounts[6];
    const defaultOperator = accounts[7];

    beforeEach(async() => {
        holdable = await Holdable.new({from: owner});
        await holdable.mint(payer, 3);

        holdableInterface = await IHoldable.at(holdable.address);

        operationId = randomString.generate();
    });

    describe('hold', async() => {
        it('should revert if operation ID is empty', async() => {
            await truffleAssert.reverts(
                holdableInterface.hold(
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
                holdableInterface.hold(
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
            await holdableInterface.hold(
                operationId,
                payee,
                notary,
                1,
                0,
                {from: payer}
            );

            await truffleAssert.reverts(
                holdableInterface.hold(
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
                holdableInterface.hold(
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
                holdableInterface.hold(
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
                holdableInterface.hold(
                    operationId,
                    payee,
                    notary,
                    4,
                    0,
                    {from: payer}
                ),
              'Amount of the hold can\'t be greater than the balance of the origin'
            );
        });

        it('should successfully create a hold and emit a HoldCreated event', async() => {
            const tx = await holdableInterface.hold(
              operationId,
              payee,
              notary,
              1,
              ONE_DAY,
              {from: payer}
            );

            const blockTimestamp = await getBlockTimestamp()

            await verifyHoldCreated(
                holdableInterface,
                tx,
                operationId,
                payer,
                payer,
                payee,
                notary,
                1,
                blockTimestamp + ONE_DAY
            );
        });

        it('should successfully create a perpetual hold and emit a HoldCreated event', async() => {
            const tx = await holdableInterface.hold(
              operationId,
              payee,
              notary,
              1,
              0,
              {from: payer}
            );

            await verifyHoldCreated(
              holdableInterface,
              tx,
              operationId,
              payer,
              payer,
              payee,
              notary,
              1,
              0
            );
        });
    });

    describe('holdFrom', async() => {
        beforeEach(async() => {
            await holdableInterface.authorizeHoldOperator(
                authorizedOperator,
                {from: payer}
            );
        });

        it('should revert if operation ID is empty', async() => {
            await truffleAssert.reverts(
                holdableInterface.holdFrom(
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
                holdableInterface.holdFrom(
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
            await holdableInterface.holdFrom(
                operationId,
                payer,
                payee,
                notary,
                1,
                0,
                {from: authorizedOperator}
            );

            await truffleAssert.reverts(
                holdableInterface.holdFrom(
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
                holdableInterface.holdFrom(
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
                holdableInterface.holdFrom(
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
                holdableInterface.holdFrom(
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
                holdableInterface.holdFrom(
                    operationId,
                    payer,
                    payee,
                    notary,
                    4,
                    0,
                    {from: authorizedOperator}
                ),
              'Amount of the hold can\'t be greater than the balance of the origin'
            );
        });

        it('should revert if operator is not authorized', async() => {
            await truffleAssert.reverts(
                holdableInterface.holdFrom(
                    operationId,
                    payer,
                    payee,
                    notary,
                    1,
                    0,
                    {from: unauthorizedOperator}
                ),
              'This operator is not authorized'
            );
        });

        it('should successfully create a hold and emit a HoldCreated event', async() => {
            const tx = await holdableInterface.holdFrom(
                operationId,
                payer,
                payee,
                notary,
                1,
                ONE_DAY,
                {from: authorizedOperator}
            );

            const blockTimestamp = await getBlockTimestamp()

            await verifyHoldCreated(
                holdableInterface,
                tx,
                operationId,
                authorizedOperator,
                payer,
                payee,
                notary,
                1,
                blockTimestamp + ONE_DAY
            );
        });

        it('should successfully create a perpetual hold and emit a HoldCreated event', async() => {
            const tx = await holdableInterface.holdFrom(
                operationId,
                payer,
                payee,
                notary,
                1,
                0,
                {from: authorizedOperator}
            );

            await verifyHoldCreated(
                holdableInterface,
                tx,
                operationId,
                authorizedOperator,
                payer,
                payee,
                notary,
                1,
                0
            );
        });
    });

    describe('holdWithExpirationDate', async() => {
        it('should revert if operation ID is empty', async() => {
            await truffleAssert.reverts(
              holdableInterface.holdWithExpirationDate(
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
              holdableInterface.holdWithExpirationDate(
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
            await holdableInterface.holdWithExpirationDate(
              operationId,
              payee,
              notary,
              1,
              0,
              {from: payer}
            );

            await truffleAssert.reverts(
              holdableInterface.holdWithExpirationDate(
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
              holdableInterface.holdWithExpirationDate(
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
              holdableInterface.holdWithExpirationDate(
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

        it('should revert if value is greater than balance', async() => {
            await truffleAssert.reverts(
              holdableInterface.holdWithExpirationDate(
                operationId,
                payee,
                notary,
                4,
                0,
                {from: payer}
              ),
              'Amount of the hold can\'t be greater than the balance of the origin'
            );
        });

        it('should revert if expiration is less than block timestamp', async() => {
            await truffleAssert.reverts(
                holdableInterface.holdWithExpirationDate(
                    operationId,
                    payee,
                    notary,
                    1,
                    1,
                    {from: payer}
                ),
                'Expiration date must be greater than block timestamp or zero'
            );
        });

        it('should successfully create a hold and emit a HoldCreated event', async() => {
            const blockTimestamp = await getBlockTimestamp();
            const expectedExpiration = blockTimestamp + ONE_DAY

            const tx = await holdableInterface.holdWithExpirationDate(
              operationId,
              payee,
              notary,
              1,
              expectedExpiration,
              {from: payer}
            );



            await verifyHoldCreated(
                holdableInterface,
                tx,
                operationId,
                payer,
                payer,
                payee,
                notary,
                1,
                expectedExpiration
            );
        });

        it('should successfully create a perpetual hold and emit a HoldCreated event', async() => {
            const tx = await holdableInterface.holdWithExpirationDate(
              operationId,
              payee,
              notary,
              1,
              0,
              {from: payer}
            );

            await verifyHoldCreated(
              holdableInterface,
              tx,
              operationId,
              payer,
              payer,
              payee,
              notary,
              1,
              0
            );
        });
    });

    describe('holdFromWithExpirationDate', async() => {
        beforeEach(async() => {
            await holdableInterface.authorizeHoldOperator(
              authorizedOperator,
              {from: payer}
            );
        });

        it('should revert if operation ID is empty', async() => {
            await truffleAssert.reverts(
              holdableInterface.holdFromWithExpirationDate(
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
              holdableInterface.holdFromWithExpirationDate(
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
            await holdableInterface.holdFromWithExpirationDate(
              operationId,
              payer,
              payee,
              notary,
              1,
              0,
              {from: authorizedOperator}
            );

            await truffleAssert.reverts(
              holdableInterface.holdFromWithExpirationDate(
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
              holdableInterface.holdFromWithExpirationDate(
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
              holdableInterface.holdFromWithExpirationDate(
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
              holdableInterface.holdFromWithExpirationDate(
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
              holdableInterface.holdFromWithExpirationDate(
                operationId,
                payer,
                payee,
                notary,
                4,
                0,
                {from: authorizedOperator}
              ),
              'Amount of the hold can\'t be greater than the balance of the origin'
            );
        });

        it('should revert if expiration is less than block timestamp', async() => {
            await truffleAssert.reverts(
              holdableInterface.holdFromWithExpirationDate(
                operationId,
                payer,
                payee,
                notary,
                1,
                1,
                {from: authorizedOperator}
              ),
              'Expiration date must be greater than block timestamp or zero'
            );
        });

        it('should revert if operator is not authorized', async() => {
            await truffleAssert.reverts(
              holdableInterface.holdFromWithExpirationDate(
                operationId,
                payer,
                payee,
                notary,
                1,
                0,
                {from: unauthorizedOperator}
              ),
              'This operator is not authorized'
            );
        });

        it('should successfully create a hold and emit a HoldCreated event', async() => {
            const blockTimestamp = await getBlockTimestamp();
            const expiration = blockTimestamp + ONE_WEEK

            const tx = await holdableInterface.holdFromWithExpirationDate(
              operationId,
              payer,
              payee,
              notary,
              1,
              expiration,
              {from: authorizedOperator}
            );

            await verifyHoldCreated(
              holdableInterface,
              tx,
              operationId,
              authorizedOperator,
              payer,
              payee,
              notary,
              1,
              expiration
            );
        });

        it('should successfully create a perpetual hold and emit a HoldCreated event', async() => {
            const tx = await holdableInterface.holdFromWithExpirationDate(
              operationId,
              payer,
              payee,
              notary,
              1,
              0,
              {from: authorizedOperator}
            );

            await verifyHoldCreated(
              holdableInterface,
              tx,
              operationId,
              authorizedOperator,
              payer,
              payee,
              notary,
              1,
              0
            );
        });
    });

    describe('releaseHold', async() => {
        let blockTimestamp;

        beforeEach(async() => {
            await holdableInterface.hold(
                operationId,
                payee,
                notary,
                1,
                ONE_DAY,
                {from: payer}
            );

            blockTimestamp = await getBlockTimestamp();
        });

        it('should revert if a non existing hold id is used', async() => {
            await truffleAssert.reverts(
                holdableInterface.releaseHold(
                    randomString.generate(),
                    {from: notary}
                ),
                'A hold can only be released in status Ordered'
            );
        });

        it('should revert if anybody else instead of the notary or the payee call it while not expired', async() => {
            await truffleAssert.reverts(
                holdableInterface.releaseHold(
                    operationId,
                    {from: payer}
                ),
                'A not expired hold can only be released by the notary or the payee'
            );
        });

        it('should be releasable by the notary and emit a HoldReleased event', async() => {
            const tx = await holdableInterface.releaseHold(
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
            const tx = await holdableInterface.releaseHold(
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
            await holdableInterface.retrieveHoldData(operationId);
            await holdable.setExpired(true);

            const tx = await holdableInterface.releaseHold(
                operationId,
                {from: userC}
            );

            await verifyHold(
              holdableInterface,
              tx,
              operationId,
              payer,
              payer,
              payee,
              notary,
              1,
              blockTimestamp + ONE_DAY,
              RELEASED_BY_EXPIRATION
            )

            truffleAssert.eventEmitted(tx, 'HoldReleased', (_event) => {
                return _event.holdIssuer === payer &&
                    _event.operationId === operationId &&
                    _event.status.toNumber() === RELEASED_BY_EXPIRATION
                    ;
            });

            assert.strictEqual((await holdableInterface.balanceOf(payer)).toNumber(), 3);
        });

        it('should revert if it has been already released', async() => {
            await holdableInterface.releaseHold(
                operationId,
                {from: notary}
            );

            await truffleAssert.reverts(
                holdableInterface.releaseHold(
                    operationId,
                    {from: notary}
                ),
                'A hold can only be released in status Ordered'
            );
        });
    });

    describe('releaseOpenExecutedHold', async() => {
        let blockTimestamp;

        beforeEach(async() => {
            await holdableInterface.hold(
                operationId,
                payee,
                notary,
                1,
                ONE_DAY,
                {from: payer}
            );

            blockTimestamp = await getBlockTimestamp();
        });

        it('release open executedHold', async() => {
            const tx = await holdableInterface.releaseHold(
                operationId,
                {from: notary}
            );

            await verifyHold(
                holdableInterface,
                tx,
                operationId,
                payer,
                payer,
                payee,
                notary,
                1,
                blockTimestamp + ONE_DAY,
                RELEASED_BY_NOTARY
            )

            truffleAssert.eventEmitted(tx, 'HoldReleased', (_event) => {
                return _event.holdIssuer === payer &&
                    _event.operationId === operationId &&
                    _event.status.toNumber() === RELEASED_BY_NOTARY
                ;
            });

            assert.strictEqual((await holdableInterface.balanceOf(payer)).toNumber(), 3);
        });
    });

    describe('executeHold', async() => {
        let blockTimestamp

        beforeEach(async() => {
            await holdableInterface.hold(
                operationId,
                payee,
                notary,
                3,
                ONE_DAY,
                {from: payer}
            );

            blockTimestamp = await getBlockTimestamp();
        });

        it('should revert if a non existing hold id is used', async() => {
            await truffleAssert.reverts(
                holdableInterface.executeHold(
                    randomString.generate(),
                    1,
                    {from: notary}
                ),
                'A hold can only be executed in status Ordered'
            );
        });

        it('should revert if value is zero', async() => {
            await truffleAssert.reverts(
                holdableInterface.executeHold(
                    operationId,
                    0,
                    {from: notary}
                ),
                'Value must be greater than zero'
            );
        });

        it('should revert if the hold has expired', async() => {
            await holdableInterface.retrieveHoldData(operationId);
            await holdable.setExpired(true);

            await truffleAssert.reverts(
                holdableInterface.executeHold(
                    operationId,
                    1,
                    {from: notary}
                ),
                'The hold has already expired'
            );
        });

        it('should revert if called by the payer', async() => {
            await truffleAssert.reverts(
                holdableInterface.executeHold(
                    operationId,
                    1,
                    {from: payer}
                ),
                'The hold can only be executed by the notary'
            );
        });

        it('should revert if called by the payee', async() => {
            await truffleAssert.reverts(
                holdableInterface.executeHold(
                    operationId,
                    1,
                    {from: payee}
                ),
                'The hold can only be executed by the notary'
            );
        });

        it('should revert if value is greater than the hold value', async() => {
            await truffleAssert.reverts(
                holdableInterface.executeHold(
                    operationId,
                    4,
                    {from: notary}
                ),
                'The value should be equal or less than the held amount'
            );
        });

        it('should revert if the hold has been released', async() => {
            await holdableInterface.releaseHold(
                operationId,
                {from: notary}
            );

            await truffleAssert.reverts(
                holdableInterface.executeHold(
                    operationId,
                    1,
                    {from: notary}
                ),
                'A hold can only be executed in status Ordered'
            );
        });

        it('should execute the hold and emit a HoldExecuted event with the full amount', async() => {
            const tx = await holdableInterface.executeHold(
                operationId,
                3,
                {from: notary}
            );

            const balanceOfPayer = await holdableInterface.balanceOf(payer);
            const balanceOfPayee = await holdableInterface.balanceOf(payee);

            assert.strictEqual(balanceOfPayer.toNumber(), 0);
            assert.strictEqual(balanceOfPayee.toNumber(), 3);

            const balanceOnHoldOfPayer = await holdableInterface.balanceOnHold(payer);
            assert.strictEqual(balanceOnHoldOfPayer.toNumber(), 0);

            await verifyHold(
                holdableInterface,
                tx,
                operationId,
                payer,
                payer,
                payee,
                notary,
                3,
                blockTimestamp + ONE_DAY,
                EXECUTED
            )

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
            const tx = await holdableInterface.executeHold(
                operationId,
                1,
                {from: notary}
            );

            const balanceOfPayer = await holdableInterface.balanceOf(payer);
            const balanceOfPayee = await holdableInterface.balanceOf(payee);

            assert.strictEqual(balanceOfPayer.toNumber(), 2);
            assert.strictEqual(balanceOfPayee.toNumber(), 1);

            const balanceOnHoldOfPayer = await holdableInterface.balanceOnHold(payer);
            assert.strictEqual(balanceOnHoldOfPayer.toNumber(), 0);

            await verifyHold(
                holdableInterface,
                tx,
                operationId,
                payer,
                payer,
                payee,
                notary,
                3,
                blockTimestamp + ONE_DAY,
                EXECUTED
            )

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
            await holdableInterface.executeHold(
                operationId,
                1,
                {from: notary}
            );

            await truffleAssert.reverts(
                holdableInterface.executeHold(
                    operationId,
                    1,
                    {from: notary}
                ),
                'A hold can only be executed in status Ordered'
            );
        });

        it('should execute open hold and keep it open', async() => {

            const tx1 = await holdableInterface.executeHoldAndKeepOpen(
                operationId,
                1,
                {from: notary}
            );

            await verifyHold(
                holdableInterface,
                tx1,
                operationId,
                payer,
                payer,
                payee,
                notary,
                2,
                blockTimestamp + ONE_DAY,
                EXECUTED_AND_KEPT_OPEN
            )

            truffleAssert.eventEmitted(tx1, 'HoldExecutedAndKeptOpen', (_event) => {
                return _event.holdIssuer === payer &&
                    _event.operationId === operationId &&
                    _event.notary === notary &&
                    _event.heldValue.toNumber() === 2 &&
                    _event.transferredValue.toNumber() === 1
                    ;
            });

            const heldBalance = await holdableInterface.balanceOnHold(payer);

            assert.strictEqual(
                heldBalance.toNumber(),
                2,
                'HeldBalance is not correct after open hold executed'
            );

            const originalHold = await holdableInterface.retrieveHoldData(operationId);

            assert.strictEqual(
                originalHold.value.toNumber(),
                2,
                'Hold is not equal to the expected value'
            );

            assert.strictEqual(
                originalHold.status.toNumber(),
                EXECUTED_AND_KEPT_OPEN,
                'Hold is not on ExecuteAndKeptOpen status'
            );

        });

        it('should execute open hold and execute and close it on a second one with no open flag', async() => {
            const tx1 = await holdableInterface.executeHoldAndKeepOpen(
                operationId,
                1,
                {from: notary}
            );

            let balanceOnHoldOfPayer = await holdableInterface.balanceOnHold(payer);
            assert.strictEqual(balanceOnHoldOfPayer.toNumber(), 2);

            await verifyHold(
                holdableInterface,
                tx1,
                operationId,
                payer,
                payer,
                payee,
                notary,
                2,
                blockTimestamp + ONE_DAY,
                EXECUTED_AND_KEPT_OPEN
            )

            truffleAssert.eventEmitted(tx1, 'HoldExecutedAndKeptOpen', (_event) => {
                return _event.holdIssuer === payer &&
                    _event.operationId === operationId &&
                    _event.notary === notary &&
                    _event.heldValue.toNumber() === 2 &&
                    _event.transferredValue.toNumber() === 1
                    ;
            });

            const tx2 = await holdableInterface.executeHold(
                operationId,
                2,
                {from: notary}
            );

            await verifyHold(
              holdableInterface,
              tx2,
              operationId,
              payer,
              payer,
              payee,
              notary,
              2,
              blockTimestamp + ONE_DAY,
              EXECUTED
            )

            balanceOnHoldOfPayer = await holdableInterface.balanceOnHold(payer);
            assert.strictEqual(balanceOnHoldOfPayer.toNumber(), 0);

            truffleAssert.eventEmitted(tx2, 'HoldExecuted', (_event) => {
                return _event.holdIssuer === payer &&
                    _event.operationId === operationId &&
                    _event.notary === notary &&
                    _event.heldValue.toNumber() === 2 &&
                    _event.transferredValue.toNumber() === 2
                    ;
            });
        });
        it('should execute open hold and execute and close it on a second one with  open flag and total open amount', async() => {
            const tx1 = await holdableInterface.executeHoldAndKeepOpen(
                operationId,
                1,
                {from: notary}
            );

            let balanceOnHoldOfPayer = await holdableInterface.balanceOnHold(payer);
            assert.strictEqual(balanceOnHoldOfPayer.toNumber(), 2);

            await verifyHold(
                holdableInterface,
                tx1,
                operationId,
                payer,
                payer,
                payee,
                notary,
                2,
                blockTimestamp + ONE_DAY,
                EXECUTED_AND_KEPT_OPEN
            );

            truffleAssert.eventEmitted(tx1, 'HoldExecutedAndKeptOpen', (_event) => {
                return _event.holdIssuer === payer &&
                    _event.operationId === operationId &&
                    _event.notary === notary &&
                    _event.heldValue.toNumber() === 2 &&
                    _event.transferredValue.toNumber() === 1
                ;
            });

            const tx2 = await holdableInterface.executeHoldAndKeepOpen(
                operationId,
                2,
                {from: notary}
            );

            balanceOnHoldOfPayer = await holdableInterface.balanceOnHold(payer);
            assert.strictEqual(balanceOnHoldOfPayer.toNumber(), 0);

            await verifyHold(
              holdableInterface,
              tx2,
              operationId,
              payer,
              payer,
              payee,
              notary,
              2,
              blockTimestamp + ONE_DAY,
              EXECUTED
            );

            truffleAssert.eventEmitted(tx2, 'HoldExecuted', (_event) => {
                return _event.holdIssuer === payer &&
                    _event.operationId === operationId &&
                    _event.notary === notary &&
                    _event.heldValue.toNumber() === 2 &&
                    _event.transferredValue.toNumber() === 2
                    ;
            });
        });
    });

    describe('renewHold', async() => {
        beforeEach(async() => {
            await holdableInterface.hold(
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
                holdableInterface.renewHold(
                    randomString.generate(),
                    ONE_DAY,
                    {from: payer}
                ),
                'A hold can only be renewed in status Ordered'
            );
        });

        it('should revert if the hold has been released', async() => {
            await holdableInterface.releaseHold(
                operationId,
                {from: notary}
            );

            await truffleAssert.reverts(
                holdableInterface.renewHold(
                    operationId,
                    ONE_DAY,
                    {from: payer}
                ),
                'A hold can only be renewed in status Ordered'
            );
        });

        it('should revert if the hold has been executed', async() => {
            await holdableInterface.executeHold(
                operationId,
                1,
                {from: notary}
            );

            await truffleAssert.reverts(
                holdableInterface.renewHold(
                    operationId,
                    ONE_DAY,
                    {from: notary}
                ),
                'A hold can only be renewed in status Ordered'
            );
        });

        it('should revert if the hold has expired', async() => {
            await holdableInterface.retrieveHoldData(operationId);
            await holdable.setExpired(true);

            await truffleAssert.reverts(
                holdableInterface.renewHold(
                    operationId,
                    ONE_DAY,
                    {from: payer}
                ),
                'An expired hold can not be renewed'
            );
        });

        it('should revert if a notary calls it', async() => {
            await truffleAssert.reverts(
                holdableInterface.renewHold(
                    operationId,
                    ONE_DAY,
                    {from: notary}
                ),
                'The hold can only be renewed by the issuer or the payer'
            );
        });

        it('should renew and emit a HoldRenewed when called by the payer with a non zero value', async() => {
            const originalHold = await holdableInterface.retrieveHoldData(operationId);

            // use the mock contracts changeHoldExpirationTime function to reduce the expiration time by twelve hours
            const reducedOriginalExpiration = originalHold.expiration.toNumber() - TWELVE_HOURS;
            await holdable.changeHoldExpirationTime(operationId, reducedOriginalExpiration);

            const tx = await holdableInterface.renewHold(
                operationId,
                ONE_DAY,
                {from: payer}
            );

            const blockTimestamp = await getBlockTimestamp();
            const expectedExpiration = blockTimestamp + ONE_DAY;

            const renewedHold = await holdableInterface.retrieveHoldData(operationId);
            assert.strictEqual(
                renewedHold.expiration.toNumber(),
                expectedExpiration,
                'Hold was not renewed correctly'
            );

            const balanceOnHoldOfPayer = await holdableInterface.balanceOnHold(payer);
            assert.strictEqual(balanceOnHoldOfPayer.toNumber(), 1);

            truffleAssert.eventEmitted(tx, 'HoldRenewed', (_event) => {
                return _event.holdIssuer === payer &&
                    _event.operationId === operationId &&
                    _event.oldExpiration.toNumber() === reducedOriginalExpiration &&
                    _event.newExpiration.toNumber() === expectedExpiration
                ;
            });
        });

        it('should renew and emit a HoldRenewed when called by the payer with a zero value', async() => {
            const originalHold = await holdableInterface.retrieveHoldData(operationId);

            const tx = await holdableInterface.renewHold(
                operationId,
                0,
                {from: payer}
            );

            const renewedHold = await holdableInterface.retrieveHoldData(operationId);
            assert.strictEqual(
                renewedHold.expiration.toNumber(),
                0,
                'Hold was not renewed correctly'
            );

            const balanceOnHoldOfPayer = await holdableInterface.balanceOnHold(payer);
            assert.strictEqual(balanceOnHoldOfPayer.toNumber(), 1);

            truffleAssert.eventEmitted(tx, 'HoldRenewed', (_event) => {
                return _event.holdIssuer === payer &&
                    _event.operationId === operationId &&
                    _event.oldExpiration.toNumber() === originalHold.expiration.toNumber() &&
                    _event.newExpiration.toNumber() === 0
                ;
            });
        });
    });

    describe('renewHoldWithExpirationDate', async() => {
        beforeEach(async() => {
            await holdableInterface.hold(
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
              holdableInterface.renewHoldWithExpirationDate(
                randomString.generate(),
                ONE_DAY,
                {from: payer}
              ),
              'A hold can only be renewed in status Ordered'
            );
        });

        it('should revert if the hold has been released', async() => {
            await holdableInterface.releaseHold(
              operationId,
              {from: notary}
            );

            await truffleAssert.reverts(
              holdableInterface.renewHoldWithExpirationDate(
                operationId,
                ONE_DAY,
                {from: payer}
              ),
              'A hold can only be renewed in status Ordered'
            );
        });

        it('should revert if the hold has been executed', async() => {
            await holdableInterface.executeHold(
              operationId,
              1,
              {from: notary}
            );

            await truffleAssert.reverts(
              holdableInterface.renewHoldWithExpirationDate(
                operationId,
                ONE_DAY,
                {from: notary}
              ),
              'A hold can only be renewed in status Ordered'
            );
        });

        it('should revert if the hold has expired', async() => {
            await holdableInterface.retrieveHoldData(operationId);
            await holdable.setExpired(true);

            await truffleAssert.reverts(
              holdableInterface.renewHoldWithExpirationDate(
                operationId,
                ONE_DAY,
                {from: payer}
              ),
              'An expired hold can not be renewed'
            );
        });

        it('should revert if a notary calls it', async() => {
            await truffleAssert.reverts(
              holdableInterface.renewHoldWithExpirationDate(
                operationId,
                ONE_DAY,
                {from: notary}
              ),
              'The hold can only be renewed by the issuer or the payer'
            );
        });

        it('should revert if expiration is less than the block timestamp', async() => {
            await truffleAssert.reverts(
              holdableInterface.renewHoldWithExpirationDate(
                operationId,
                1,
                {from: payer}
              ),
              'Expiration date must be greater than block timestamp or zero'
            );
        });

        it('should renew and emit a HoldRenewed when called by the payer with a non zero value', async() => {
            const originalHold = await holdableInterface.retrieveHoldData(operationId);
            const oldExpiration = originalHold.expiration;

            const blockTimestamp = await getBlockTimestamp()
            const newExpiration = blockTimestamp + ONE_WEEK;

            const tx = await holdableInterface.renewHoldWithExpirationDate(
              operationId,
              newExpiration,
              {from: payer}
            );

            const renewedHold = await holdableInterface.retrieveHoldData(operationId);
            assert.strictEqual(
              renewedHold.expiration.toNumber(),
              newExpiration,
              'Hold was not renewed correctly'
            );

            const balanceOnHoldOfPayer = await holdableInterface.balanceOnHold(payer);
            assert.strictEqual(balanceOnHoldOfPayer.toNumber(), 1);

            truffleAssert.eventEmitted(tx, 'HoldRenewed', (_event) => {
                return _event.holdIssuer === payer &&
                  _event.operationId === operationId &&
                  _event.oldExpiration.toNumber() === oldExpiration.toNumber() &&
                  _event.newExpiration.toNumber() === newExpiration
                  ;
            });
        });

        it('should renew and emit a HoldRenewed when called by the payer with a zero value', async() => {
            const originalHold = await holdableInterface.retrieveHoldData(operationId);

            const tx = await holdableInterface.renewHoldWithExpirationDate(
              operationId,
              0,
              {from: payer}
            );

            const renewedHold = await holdableInterface.retrieveHoldData(operationId);
            assert.strictEqual(
              renewedHold.expiration.toNumber(),
              0,
              'Hold was not renewed correctly'
            );

            const balanceOnHoldOfPayer = await holdableInterface.balanceOnHold(payer);
            assert.strictEqual(balanceOnHoldOfPayer.toNumber(), 1);

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
            await holdableInterface.hold(
                operationId,
                payee,
                notary,
                1,
                ONE_DAY,
                {from: payer}
            );
        });

        it('should return the held balance of a user', async() => {
            let balanceOnHold = await holdableInterface.balanceOnHold(payer);
            assert.strictEqual(balanceOnHold.toNumber(), 1, 'balanceOnHold not correct after one hold');

            await holdableInterface.hold(
                randomString.generate(),
                payee,
                notary,
                2,
                ONE_DAY,
                {from: payer}
            );

            balanceOnHold = await holdableInterface.balanceOnHold(payer);
            assert.strictEqual(balanceOnHold.toNumber(), 3, 'balanceOnHold not correct after two holds');
        });
    });

    describe('netBalanceOf', async() => {
        beforeEach(async() => {
            await holdableInterface.hold(
                operationId,
                payee,
                notary,
                1,
                ONE_DAY,
                {from: payer}
            );
        });

        it('should return the balance including the held balance of a user', async() => {
            let netBalance = await holdableInterface.netBalanceOf(payer);
            assert.strictEqual(netBalance.toNumber(), 3, 'netBalanceOf not correct after one hold');

            await holdableInterface.hold(
                randomString.generate(),
                payee,
                notary,
                2,
                ONE_DAY,
                {from: payer}
            );

            netBalance = await holdableInterface.netBalanceOf(payer);
            assert.strictEqual(netBalance.toNumber(), 3, 'netBalanceOf not correct after two holds');
        });
    });

    describe('totalSupplyOnHold', async() => {
        beforeEach(async() => {
            await holdableInterface.hold(
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
            let totalSupplyOnHold = await holdableInterface.totalSupplyOnHold();
            assert.strictEqual(totalSupplyOnHold.toNumber(), 3, 'totalSupplyOnHold not correct after one hold');

            await holdableInterface.hold(
                randomString.generate(),
                payee,
                notary,
                2,
                ONE_DAY,
                {from: userC}
            );

            totalSupplyOnHold = await holdableInterface.totalSupplyOnHold();
            assert.strictEqual(totalSupplyOnHold.toNumber(), 5, 'totalSupplyOnHold not correct after two holds');
        });
    });

    describe('authorizeHoldOperator', async() => {
        it('should authorize an operator and emit a AuthorizedHoldOperator event', async() => {
            const tx = await holdableInterface.authorizeHoldOperator(authorizedOperator, {from: payer});

            const isAuthorized = await holdableInterface.isHoldOperatorFor(authorizedOperator, payer);
            assert.strictEqual(isAuthorized, true, 'Operator has not been authorized');

            truffleAssert.eventEmitted(tx, 'AuthorizedHoldOperator', (_event) => {
                return _event.operator === authorizedOperator && _event.account === payer;
            });
        });

        it('should revert if an operator has already been authorized', async() => {
            await holdableInterface.authorizeHoldOperator(authorizedOperator, {from: payer});

            await truffleAssert.reverts(
                holdableInterface.authorizeHoldOperator(authorizedOperator, {from: payer}),
                'The operator is already authorized'
            );
        });
    });

    describe('revokeHoldOperator', async() => {
        it('should revert if an operator has not been authorized', async() => {
            await truffleAssert.reverts(
                holdableInterface.revokeHoldOperator(unauthorizedOperator, {from: payer}),
                'The operator is already not authorized'
            );
        });

        it('should revoke the authorization of an operator and emit a RevokedHoldOperator event', async() => {
            await holdableInterface.authorizeHoldOperator(unauthorizedOperator, {from: payer});

            const tx = await holdableInterface.revokeHoldOperator(unauthorizedOperator, {from: payer});

            const isAuthorized = await holdableInterface.isHoldOperatorFor(authorizedOperator, payer);
            assert.strictEqual(isAuthorized, false, 'Operator authorization has not been revoked');

            truffleAssert.eventEmitted(tx, 'RevokedHoldOperator', (_event) => {
                return _event.operator === unauthorizedOperator && _event.account === payer;
            });
        });
    });

    describe('transfer', async() => {
        beforeEach(async() => {
            await holdableInterface.hold(
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
                holdableInterface.transfer(
                    payee,
                    3,
                    {from: payer}
                ),
                'Not enough available balance'
            );
        });

        it('should use the ERC-20 transfer function successfully if available balance is sufficient', async() => {
            const tx = await holdableInterface.transfer(
                payee,
                2,
                {from: payer}
            );

            const balanceOfPayer = await holdableInterface.balanceOf(payer);
            assert.strictEqual(balanceOfPayer.toNumber(), 0, 'Balance of payer not updated after transfer');

            const balanceOfPayee = await holdableInterface.balanceOf(payee);
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
            await holdableInterface.hold(
                operationId,
                payee,
                notary,
                1,
                ONE_DAY,
                {from: payer}
            );

            await holdableInterface.approve(userC, 3, {from: payer});
        });

        it('should revert if available balance is less than amount to be transferred', async() => {
            await truffleAssert.reverts(
                holdableInterface.transferFrom(
                    payer,
                    payee,
                    3,
                    {from: userC}
                ),
                'Not enough available balance'
            );
        });

        it('should use the ERC-20 transferFrom function successfully if available balance is sufficient', async() => {
            const tx = await holdableInterface.transferFrom(
                payer,
                payee,
                2,
                {from: userC}
            );

            const balanceOfPayer = await holdableInterface.balanceOf(payer);
            assert.strictEqual(balanceOfPayer.toNumber(), 0, 'Balance of payer not updated after transfer');

            const balanceOfPayee = await holdableInterface.balanceOf(payee);
            assert.strictEqual(balanceOfPayee.toNumber(), 2, 'Balance of payee not updated after transfer');

            truffleAssert.eventEmitted(tx, 'Transfer', (_event) => {
                return _event.from === payer &&
                    _event.to === payee &&
                    _event.value.toNumber() === 2
                    ;
            });
        });
    });

    describe('_addDefaultOperator', async() => {
        it('should allow a default operator to call holdFrom for any account', async() => {
            await holdable.addDefaultOperator(defaultOperator);

            await truffleAssert.passes(
              holdableInterface.holdFrom(
                operationId,
                payer,
                payee,
                notary,
                1,
                ONE_DAY,
                {from: defaultOperator}
              ),
              'A default operator could not call holdFrom'
            );
        });

        it('should allow a default operator to call holdFromWithExpirationDate for any account', async() => {
            await holdable.addDefaultOperator(defaultOperator);

            const expiration = await getBlockTimestamp() + ONE_DAY;

            await truffleAssert.passes(
              holdableInterface.holdFromWithExpirationDate(
                operationId,
                payer,
                payee,
                notary,
                1,
                expiration,
                {from: defaultOperator}
              ),
              'A default operator could not call holdFromWithExpirationDate'
            );
        });
    });

    describe('_removeDefaultOperator', async() => {
        it('should disallow a default operator to call holdFrom for any account', async() => {
            await holdable.addDefaultOperator(defaultOperator);
            await holdable.removeDefaultOperator(defaultOperator);

            await truffleAssert.reverts(
              holdableInterface.holdFrom(
                operationId,
                payer,
                payee,
                notary,
                1,
                ONE_DAY,
                {from: defaultOperator}
              ),
              'This operator is not authorized'
            );
        });

        it('should disallow a default operator to call holdFromWithExpirationDate for any account', async() => {
            await holdable.addDefaultOperator(defaultOperator);
            await holdable.removeDefaultOperator(defaultOperator);

            const expiration = await getBlockTimestamp() + ONE_DAY;

            await truffleAssert.reverts(
              holdableInterface.holdFromWithExpirationDate(
                operationId,
                payer,
                payee,
                notary,
                1,
                expiration,
                {from: defaultOperator}
              ),
              'This operator is not authorized'
            );
        });
    });
});

async function getBlockTimestamp() {
    const block = await web3.eth.getBlock('latest');

    return block.timestamp;
}

async function verifyHold(holdable, tx, operationId, holdIssuer, payer, payee, notary, value, expiration, status) {
    const hold = await holdable.retrieveHoldData(operationId);

    assert.strictEqual(hold.from, payer, 'Payer is not saved correctly');
    assert.strictEqual(hold.to, payee, 'Payee is not saved correctly');
    assert.strictEqual(hold.notary, notary, 'Notary is not saved correctly');
    assert.strictEqual(hold.value.toNumber(), value, 'Value is not saved correctly');
    assert.strictEqual(hold.expiration.toNumber(), expiration, 'Expiration is not saved correctly');
    assert.strictEqual(hold.status.toNumber(), status, 'Status is not set to Ordered');
}

async function verifyHoldCreated(holdable, tx, operationId, holdIssuer, payer, payee, notary, value, expiration) {
  await verifyHold(
      holdable,
      tx,
      operationId,
      holdIssuer,
      payer,
      payee,
      notary,
      value,
      expiration,
      ORDERED
    )

    truffleAssert.eventEmitted(tx, 'HoldCreated', (_event) => {
        return _event.holdIssuer === holdIssuer &&
            _event.operationId === operationId &&
            _event.from === payer &&
            _event.to === payee &&
            _event.notary === notary &&
            _event.value.toNumber() === value &&
            _event.expiration.toNumber() === expiration
        ;
    });
}
