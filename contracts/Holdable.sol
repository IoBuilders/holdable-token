pragma solidity ^0.5.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./IHoldable.sol";
import "solidity-string-util/contracts/StringUtil.sol";


contract Holdable is IHoldable, ERC20 {

    using SafeMath for uint256;
    using StringUtil for string;

    struct Hold {
        address issuer;
        address origin;
        address target;
        address notary;
        uint256 expiration;
        uint256 value;
        HoldStatusCode status;
    }

    mapping(bytes32 => Hold) internal holds;
    mapping(address => uint256) private heldBalance;
    mapping(address => mapping(address => bool)) private operators;

    uint256 private _totalHeldBalance;

    function hold(
        string memory operationId,
        address to,
        address notary,
        uint256 value,
        uint256 timeToExpiration
    ) public returns (bool)
    {
        _checkHold(to);

        return _hold(
            operationId,
            msg.sender,
            msg.sender,
            to,
            notary,
            value,
            _computeExpiration(timeToExpiration)
        );
    }

    function holdFrom(
        string memory operationId,
        address from,
        address to,
        address notary,
        uint256 value,
        uint256 timeToExpiration
    ) public returns (bool)
    {
        _checkHoldFrom(to, from);

        return _hold(
            operationId,
            msg.sender,
            from,
            to,
            notary,
            value,
            _computeExpiration(timeToExpiration)
        );
    }

    function holdWithExpirationDate(
        string memory operationId,
        address to,
        address notary,
        uint256 value,
        uint256 expiration
    ) public returns (bool)
    {
        _checkHold(to);
        require(expiration > now || expiration == 0, "Expiration date must be greater than block timestamp or zero");

        return _hold(
            operationId,
            msg.sender,
            msg.sender,
            to,
            notary,
            value,
            expiration
        );
    }

    function holdFromWithExpirationDate(
        string memory operationId,
        address from,
        address to,
        address notary,
        uint256 value,
        uint256 expiration
    ) public returns (bool)
    {
        _checkHoldFrom(to, from);
        require(expiration > now || expiration == 0, "Expiration date must be greater than block timestamp or zero");

        return _hold(
            operationId,
            msg.sender,
            from,
            to,
            notary,
            value,
            expiration
        );
    }

    function releaseHold(string memory operationId) public returns (bool) {
        Hold storage releasableHold = holds[operationId.toHash()];

        require(
            releasableHold.status == HoldStatusCode.Ordered || releasableHold.status == HoldStatusCode.ExecutedAndKeptOpen,
            "A hold can only be released in status Ordered or ExecutedAndKeptOpen"
        );
        require(
            _isExpired(releasableHold.expiration) ||
            (msg.sender == releasableHold.notary) ||
            (msg.sender == releasableHold.target),
            "A not expired hold can only be released by the notary or the payee"
        );

        return _releaseHold(operationId);
    }

    function executeHold(string memory operationId, uint256 value) public returns (bool) {
        return _executeHold(operationId, value, false);
    }

    function executeHoldAndKeepOpen(string memory operationId, uint256 value) public returns (bool) {
        return _executeHold(operationId, value, true);
    }

    function renewHold(string memory operationId, uint256 timeToExpiration) public returns (bool) {
        _checkRenewableHold(operationId);

        return _renewHold(operationId, _computeExpiration(timeToExpiration));
    }

    function renewHoldWithExpirationDate(string memory operationId, uint256 expiration) public returns (bool) {
        _checkRenewableHold(operationId);
        require(expiration > now || expiration == 0, "Expiration date must be greater than block timestamp or zero");

        return _renewHold(operationId, expiration);
    }

    function retrieveHoldData(string memory operationId) public view returns (
        address from,
        address to,
        address notary,
        uint256 value,
        uint256 expiration,
        HoldStatusCode status)
    {
        Hold storage retrievedHold = holds[operationId.toHash()];
        return (
            retrievedHold.origin,
            retrievedHold.target,
            retrievedHold.notary,
            retrievedHold.value,
            retrievedHold.expiration,
            retrievedHold.status
        );
    }

    function balanceOnHold(address account) public view returns (uint256) {
        return heldBalance[account];
    }

    function netBalanceOf(address account) public view returns (uint256) {
        return super.balanceOf(account);
    }

    function totalSupplyOnHold() public view returns (uint256) {
        return _totalHeldBalance;
    }

    function isHoldOperatorFor(address operator, address from) public view returns (bool) {
        return operators[from][operator];
    }

    function authorizeHoldOperator(address operator) public returns (bool) {
        require (operators[msg.sender][operator] == false, "The operator is already authorized");

        operators[msg.sender][operator] = true;
        emit AuthorizedHoldOperator(operator, msg.sender);
        return true;
    }

    function revokeHoldOperator(address operator) public returns (bool) {
        require (operators[msg.sender][operator] == true, "The operator is already not authorized");

        operators[msg.sender][operator] = false;
        emit RevokedHoldOperator(operator, msg.sender);
        return true;
    }

    /// @notice Retrieve the erc20.balanceOf(account) - heldBalance(account)
    function balanceOf(address account) public view returns (uint256) {
        return super.balanceOf(account).sub(heldBalance[account]);
    }

    function transfer(address _to, uint256 _value) public returns (bool) {
        require(balanceOf(msg.sender) >= _value, "Not enough available balance");
        return super.transfer(_to, _value);
    }

    function transferFrom(address _from, address _to, uint256 _value) public returns (bool) {
        require(balanceOf(_from) >= _value, "Not enough available balance");
        return super.transferFrom(_from, _to, _value);
    }

    function _isExpired(uint256 expiration) internal view returns (bool) {
        /* solium-disable-next-line security/no-block-members */
        return expiration != 0 && (now >= expiration);
    }

    function _hold(
        string memory operationId,
        address issuer,
        address from,
        address to,
        address notary,
        uint256 value,
        uint256 expiration
    ) internal returns (bool)
    {
        Hold storage newHold = holds[operationId.toHash()];

        require(!operationId.isEmpty(), "Operation ID must not be empty");
        require(value != 0, "Value must be greater than zero");
        require(newHold.value == 0, "This operationId already exists");
        require(notary != address(0), "Notary address must not be zero address");
        require(value <= balanceOf(from), "Amount of the hold can't be greater than the balance of the origin");

        newHold.issuer = issuer;
        newHold.origin = from;
        newHold.target = to;
        newHold.notary = notary;
        newHold.value = value;
        newHold.status = HoldStatusCode.Ordered;
        newHold.expiration = expiration;

        heldBalance[from] = heldBalance[from].add(value);
        _totalHeldBalance = _totalHeldBalance.add(value);

        emit HoldCreated(
            issuer,
            operationId,
            from,
            to,
            notary,
            value,
            expiration
        );

        return true;
    }

    function _releaseHold(string memory operationId) internal returns (bool) {
        Hold storage releasableHold = holds[operationId.toHash()];

        if (_isExpired(releasableHold.expiration)) {
            releasableHold.status = HoldStatusCode.ReleasedOnExpiration;
        } else {
            if (releasableHold.notary == msg.sender) {
                releasableHold.status = HoldStatusCode.ReleasedByNotary;
            } else {
                releasableHold.status = HoldStatusCode.ReleasedByPayee;
            }
        }

        heldBalance[releasableHold.origin] = heldBalance[releasableHold.origin].sub(releasableHold.value);
        _totalHeldBalance = _totalHeldBalance.sub(releasableHold.value);

        emit HoldReleased(releasableHold.issuer, operationId, releasableHold.status);

        return true;
    }

    function _executeHold(string memory operationId, uint256 value, bool keepOpenIfHoldHasBalance) internal returns (bool) {
        Hold storage executableHold = holds[operationId.toHash()];

        require(
            executableHold.status == HoldStatusCode.Ordered || executableHold.status == HoldStatusCode.ExecutedAndKeptOpen,
            "A hold can only be executed in status Ordered or ExecutedAndKeptOpen"
        );
        require(value != 0, "Value must be greater than zero");
        require(executableHold.notary == msg.sender, "The hold can only be executed by the notary");
        require(!_isExpired(executableHold.expiration), "The hold has already expired");
        require(value <= executableHold.value, "The value should be equal or less than the held amount");

        if (keepOpenIfHoldHasBalance && ((executableHold.value - value) > 0)) {
            _setHoldToExecutedAndKeptOpen(operationId, value, value);
        } else {
            _setHoldToExecuted(operationId, value, executableHold.value);
        }

        _transfer(executableHold.origin, executableHold.target, value);

        return true;
    }

    function _renewHold(string memory operationId, uint256 expiration) internal returns (bool) {
        Hold storage renewableHold = holds[operationId.toHash()];

        uint256 oldExpiration = renewableHold.expiration;
        renewableHold.expiration = expiration;

        emit HoldRenewed(
            renewableHold.issuer,
            operationId,
            oldExpiration,
            expiration
        );

        return true;
    }

    function _setHoldToExecuted(string memory operationId, uint256 value, uint256 heldBalanceDecrease) private {
        _decreaseHeldBalance(operationId, heldBalanceDecrease);

        Hold storage executableHold = holds[operationId.toHash()];
        executableHold.status = HoldStatusCode.Executed;

        emit HoldExecuted(
            executableHold.issuer,
            operationId,
            executableHold.notary,
            executableHold.value,
            value
        );
    }

    function _setHoldToExecutedAndKeptOpen(string memory operationId, uint256 value, uint256 heldBalanceDecrease) private {
        _decreaseHeldBalance(operationId, heldBalanceDecrease);

        Hold storage executableHold = holds[operationId.toHash()];
        executableHold.status = HoldStatusCode.ExecutedAndKeptOpen;
        executableHold.value = executableHold.value.sub(value);

        emit HoldExecutedAndKeptOpen(
            executableHold.issuer,
            operationId,
            executableHold.notary,
            executableHold.value,
            value
        );
    }

    function _decreaseHeldBalance(string memory operationId, uint256 value) private {
        Hold storage executableHold = holds[operationId.toHash()];

        heldBalance[executableHold.origin] = heldBalance[executableHold.origin].sub(value);
        _totalHeldBalance = _totalHeldBalance.sub(value);
    }

    function _computeExpiration(uint256 _timeToExpiration) private view returns (uint256) {
        uint256 expiration = 0;

        if (_timeToExpiration != 0) {
            /* solium-disable-next-line security/no-block-members */
            expiration = now.add(_timeToExpiration);
        }

        return expiration;
    }

    function _checkHold(address to) private pure {
        require(to != address(0), "Payee address must not be zero address");
    }

    function _checkHoldFrom(address to, address from) private view {
        require(to != address(0), "Payee address must not be zero address");
        require(from != address(0), "Payer address must not be zero address");
        require(operators[from][msg.sender], "This operator is not authorized");
    }

    function _checkRenewableHold(string memory operationId) private view {
        Hold storage renewableHold = holds[operationId.toHash()];

        require(renewableHold.status == HoldStatusCode.Ordered, "A hold can only be renewed in status Ordered");
        require(!_isExpired(renewableHold.expiration), "An expired hold can not be renewed");
        require(
            renewableHold.origin == msg.sender || renewableHold.issuer == msg.sender,
            "The hold can only be renewed by the issuer or the payer"
        );
    }
}
