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
        uint256 amount;
        HoldStatusCode status;
    }

    mapping(string => Hold) private holds;
    mapping(address => uint256) private heldBalance;
    mapping(address => mapping(address => bool)) private operators;

    uint256 private _totalHeldBalance;

    function hold(string calldata operationId, address to, address notary, uint256 value, uint256 timeToExpiration) external returns (bool){

        require(holds[operationId].amount == 0 && holds[operationId].target == address(0) && holds[operationId].notary == address(0), "This operationId already exists");
        require(value <= balanceOf(msg.sender), "Amount of the hold can't be greater than the balance of the origin");

        holds[operationId].issuer = msg.sender;
        holds[operationId].origin = msg.sender;
        holds[operationId].target = to;
        holds[operationId].notary = notary;
        holds[operationId].amount = value;
        holds[operationId].status = HoldStatusCode.Ordered;

        if(timeToExpiration == 0){
            holds[operationId].expiration = 0;
        }else{
            holds[operationId].expiration = block.timestamp.add(timeToExpiration);
        }

        heldBalance[msg.sender] = heldBalance[msg.sender].add(value);


        _totalHeldBalance = _totalHeldBalance.add(value);

        emit HoldCreated(
            msg.sender,
            operationId,
            msg.sender,
            to,
            notary,
            value,
            timeToExpiration
        );
        return true;
    }


    function holdFrom(string calldata operationId, address from, address to, address notary, uint256 value, uint256 timeToExpiration) external returns (bool){

        require(holds[operationId].amount == 0 && holds[operationId].target == address(0) && holds[operationId].notary == address(0), "This operationId already exists");
        require(value <= balanceOf(from), "Amount of the hold can't be greater than the balance of the origin");
        require (operators[from][msg.sender] == true, "This operator is not authorized");


        holds[operationId].issuer = msg.sender;
        holds[operationId].origin = from;
        holds[operationId].target = to;
        holds[operationId].notary = notary;
        holds[operationId].amount = value;
        holds[operationId].status = HoldStatusCode.Ordered;

        if(timeToExpiration == 0){
            holds[operationId].expiration = 0;
        }else{
            holds[operationId].expiration = block.timestamp.add(timeToExpiration);
        }

        heldBalance[from] = heldBalance[from].add(value);

        _totalHeldBalance = _totalHeldBalance.add(value);


        emit HoldCreated(
            msg.sender,
            operationId,
            from,
            to,
            notary,
            value,
            timeToExpiration
        );
        return true;
    }


    function releaseHold(string calldata operationId) external returns (bool){
        Hold storage releasableHold = holds[operationId];

        require(releasableHold.status == HoldStatusCode.Ordered, "A hold can only be released in status Ordered");

        if (isExpired(releasableHold.expiration)) {
            releasableHold.status = HoldStatusCode.ReleasedOnExpiration;
        } else {
            require(releasableHold.notary == msg.sender || releasableHold.target == msg.sender, "A not expired hold can only be released by the notary or the payee");

            if (releasableHold.notary == msg.sender) {
                releasableHold.status = HoldStatusCode.ReleasedByNotary;
            } else {
                releasableHold.status = HoldStatusCode.ReleasedByPayee;
            }
        }

        heldBalance[releasableHold.origin] = heldBalance[releasableHold.origin].sub(releasableHold.amount);
        _totalHeldBalance = _totalHeldBalance.sub(releasableHold.amount);

        emit HoldReleased(releasableHold.issuer, operationId, releasableHold.status);

        return true;
    }

    function executeHold(string calldata operationId, uint256 value) external returns (bool){

        require(holds[operationId].status == HoldStatusCode.Ordered, "This hold has already been released or executed");
        require(block.timestamp < holds[operationId].expiration || holds[operationId].expiration == 0, "This hold has already expired");
        require(holds[operationId].notary == msg.sender, "The hold can only be executed by the notary");
        require(value <= holds[operationId].amount, "The value should be equal or lower than the held amount");

        heldBalance[holds[operationId].origin] = heldBalance[holds[operationId].origin].sub(holds[operationId].amount);
        _totalHeldBalance = _totalHeldBalance.sub(holds[operationId].amount);

        _transfer(holds[operationId].origin, holds[operationId].target, value);

        holds[operationId].status = HoldStatusCode.Executed;

        emit HoldExecuted(holds[operationId].issuer, operationId, holds[operationId].notary, holds[operationId].amount, value);
        return true;
    }

    function renewHold(string calldata operationId, uint256 timeToExpiration) external returns (bool){
        Hold storage renewableHold = holds[operationId];

        require(renewableHold.status == HoldStatusCode.Ordered, "A hold can only be renewed in status Ordered");
        require(!isExpired(renewableHold.expiration), "An expired hold can not be renewed");
        require(renewableHold.origin == msg.sender || renewableHold.issuer == msg.sender, "The hold can only be renewed by the issuer or the payer");

        uint256 oldExpiration = renewableHold.expiration;

        if (timeToExpiration == 0) {
            renewableHold.expiration = 0;
        } else {
            renewableHold.expiration = getNow().add(timeToExpiration);
        }

        emit HoldRenewed(renewableHold.issuer, operationId, oldExpiration, renewableHold.expiration);

        return true;
    }

    function retrieveHoldData(string calldata operationId) external view returns (address from, address to, address notary, uint256 value, uint256 expiration, HoldStatusCode status){ //maybe also the issuer??

        return (holds[operationId].origin, holds[operationId].target, holds[operationId].notary, holds[operationId].amount, holds[operationId].expiration, holds[operationId].status);
    }

    function balanceOnHold(address account) external view returns (uint256){
        return heldBalance[account];
    }

    function netBalanceOf(address account) external view returns (uint256){
        return super.balanceOf(account);
    }

    function totalSupplyOnHold() external view returns (uint256){
        return _totalHeldBalance;
    }

    function isHoldOperatorFor(address operator, address from) external view returns (bool) {
        return operators[from][operator];
    }

    function authorizeHoldOperator(address operator) external returns (bool){

        require (operators[msg.sender][operator] == false, "This operator is already authorized");

        operators[msg.sender][operator] = true;
        emit AuthorizedHoldOperator(operator, msg.sender);
        return true;
    }

    function revokeHoldOperator(address operator) external returns (bool){

        require (operators[msg.sender][operator] == true, "This operator is already not authorized");
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

    function getNow() internal view returns (uint256) {
        return block.timestamp;
    }

    function isExpired(uint256 expiration) private view returns (bool) {
        return expiration != 0 && (getNow() >= expiration);
    }
}
