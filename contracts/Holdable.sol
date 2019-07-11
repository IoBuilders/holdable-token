pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "./IHoldable.sol";
import "./libraries/StringUtil.sol";


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
        string calldata operationId,
        address to,
        address notary,
        uint256 value,
        uint256 timeToExpiration
    ) external returns (bool)
    {
        require(to != address(0), "Payee address must not be zero address");

        emit HoldCreated(
            msg.sender,
            operationId,
            msg.sender,
            to,
            notary,
            value,
            timeToExpiration
        );

        return _hold(
            operationId,
            msg.sender,
            msg.sender,
            to,
            notary,
            value,
            timeToExpiration
        );
    }

    function holdFrom(
        string calldata operationId,
        address from,
        address to,
        address notary,
        uint256 value,
        uint256 timeToExpiration
    ) external returns (bool)
    {
        require(to != address(0), "Payee address must not be zero address");
        require(from != address(0), "Payer address must not be zero address");
        require(operators[from][msg.sender], "This operator is not authorized");

        emit HoldCreated(
            msg.sender,
            operationId,
            from,
            to,
            notary,
            value,
            timeToExpiration
        );

        return _hold(
            operationId,
            msg.sender,
            from,
            to,
            notary,
            value,
            timeToExpiration
        );
    }

    function releaseHold(string calldata operationId) external returns (bool) {
        Hold storage releasableHold = holds[operationId.toHash()];

        require(releasableHold.status == HoldStatusCode.Ordered, "A hold can only be released in status Ordered");
        require(
            _isExpired(releasableHold.expiration) ||
            (msg.sender == releasableHold.notary) ||
            (msg.sender == releasableHold.target) ,
            "A not expired hold can only be released by the notary or the payee"
        );

        _releaseHold(operationId);

        emit HoldReleased(releasableHold.issuer, operationId, releasableHold.status);

        return true;
    }

    function executeHold(string calldata operationId, uint256 value) external returns (bool) {
        Hold storage executableHold = holds[operationId.toHash()];

        require(executableHold.status == HoldStatusCode.Ordered, "A hold can only be executed in status Ordered");
        require(value != 0, "Value must be greater than zero");
        require(!_isExpired(executableHold.expiration), "The hold has already expired");
        require(executableHold.notary == msg.sender, "The hold can only be executed by the notary");
        require(value <= executableHold.value, "The value should be equal or less than the held amount");

        heldBalance[executableHold.origin] = heldBalance[executableHold.origin].sub(executableHold.value);
        _totalHeldBalance = _totalHeldBalance.sub(executableHold.value);

        _transfer(executableHold.origin, executableHold.target, value);

        executableHold.status = HoldStatusCode.Executed;

        emit HoldExecuted(
            executableHold.issuer,
            operationId,
            executableHold.notary,
            executableHold.value,
            value
        );
        return true;
    }

    function renewHold(string calldata operationId, uint256 timeToExpiration) external returns (bool) {
        Hold storage renewableHold = holds[operationId.toHash()];

        require(renewableHold.status == HoldStatusCode.Ordered, "A hold can only be renewed in status Ordered");
        require(!_isExpired(renewableHold.expiration), "An expired hold can not be renewed");
        require(
            renewableHold.origin == msg.sender || renewableHold.issuer == msg.sender,
            "The hold can only be renewed by the issuer or the payer"
        );

        uint256 oldExpiration = renewableHold.expiration;

        if (timeToExpiration == 0) {
            renewableHold.expiration = 0;
        } else {
            /* solium-disable-next-line security/no-block-members */
            renewableHold.expiration = now.add(timeToExpiration);
        }

        emit HoldRenewed(
            renewableHold.issuer,
            operationId,
            oldExpiration,
            renewableHold.expiration
        );

        return true;
    }

    function retrieveHoldData(string calldata operationId) external view returns (
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

    function balanceOnHold(address account) external view returns (uint256) {
        return heldBalance[account];
    }

    function netBalanceOf(address account) external view returns (uint256) {
        return super.balanceOf(account);
    }

    function totalSupplyOnHold() external view returns (uint256) {
        return _totalHeldBalance;
    }

    function isHoldOperatorFor(address operator, address from) external view returns (bool) {
        return operators[from][operator];
    }

    function authorizeHoldOperator(address operator) external returns (bool) {
        require (operators[msg.sender][operator] == false, "The operator is already authorized");

        operators[msg.sender][operator] = true;
        emit AuthorizedHoldOperator(operator, msg.sender);
        return true;
    }

    function revokeHoldOperator(address operator) external returns (bool) {
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
        uint256 timeToExpiration
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

        if (timeToExpiration != 0) {
            /* solium-disable-next-line security/no-block-members */
            newHold.expiration = now.add(timeToExpiration);
        }

        heldBalance[from] = heldBalance[from].add(value);
        _totalHeldBalance = _totalHeldBalance.add(value);

        return true;
    }

    function _releaseHold(string memory operationId) internal returns (bool) {
        Hold storage releasableHold = holds[operationId.toHash()];

        require(releasableHold.status == HoldStatusCode.Ordered, "A hold can only be released in status Ordered");

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

        return true;
    }
}
