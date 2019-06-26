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

        require(holds[operationId].status == HoldStatusCode.Ordered, "This hold has already been released or executed");
        if(block.timestamp < holds[operationId].expiration || holds[operationId].expiration == 0){
            require(holds[operationId].notary == msg.sender || holds[operationId].target == msg.sender, "The hold can only be released by the notary or the payee");
        }

        heldBalance[holds[operationId].origin] = heldBalance[holds[operationId].origin].sub(holds[operationId].amount);
        _totalHeldBalance = _totalHeldBalance.sub(holds[operationId].amount);

        if(block.timestamp >= holds[operationId].expiration && holds[operationId].expiration != 0){
            holds[operationId].status = HoldStatusCode.ReleasedOnExpiration;
            emit HoldReleased(holds[operationId].issuer, operationId, HoldStatusCode.ReleasedOnExpiration);
        }
        if(block.timestamp < holds[operationId].expiration || holds[operationId].expiration == 0){
            if(holds[operationId].notary == msg.sender){
                holds[operationId].status = HoldStatusCode.ReleasedByNotary;
                emit HoldReleased(holds[operationId].issuer, operationId, HoldStatusCode.ReleasedByNotary);
            }
            if(holds[operationId].target == msg.sender){
                holds[operationId].status = HoldStatusCode.ReleasedByPayee;
                emit HoldReleased(holds[operationId].issuer, operationId, HoldStatusCode.ReleasedByPayee);
            }
        }
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

        require(holds[operationId].status == HoldStatusCode.Ordered, "This hold has already been released or executed");
        require(block.timestamp < holds[operationId].expiration || holds[operationId].expiration == 0, "This hold has already expired");
        require(holds[operationId].origin == msg.sender || holds[operationId].issuer == msg.sender, "The hold can only be renewed by the issuer or the payer");

        uint256 oldExpiration = holds[operationId].expiration;
        
        if(timeToExpiration == 0){
            holds[operationId].expiration = 0;
        }else{
            holds[operationId].expiration = block.timestamp.add(timeToExpiration);
        }

        holds[operationId].expiration = timeToExpiration;
        
        emit HoldRenewed(holds[operationId].issuer, operationId, oldExpiration, timeToExpiration);
        return true;
    }


    function retrieveHoldData(string calldata operationId) external view returns (address from, address to, address notary, uint256 value, uint256 expiration, HoldStatusCode status){ //maybe also the issuer??

        return (holds[operationId].origin, holds[operationId].target, holds[operationId].notary, holds[operationId].amount, holds[operationId].expiration, holds[operationId].status);
    }


    function balanceOnHold(address account) external view returns (uint256){
        return heldBalance[account];
    }


    function netBalanceOf(address account) external view returns (uint256){
        return balanceOf(account).sub(heldBalance[account]);
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
        return true;
    }


    function revokeHoldOperator(address operator) external returns (bool){

        require (operators[msg.sender][operator] == true, "This operator is already not authorized");
        operators[msg.sender][operator] = false;
        return true;
    }

    

        /// @notice Retrive the erc20.balanceOf(msg.sender) - heldBalance(msg.sender).
    function balanceOf(address account) public view returns (uint256) {
        return virtualBalanceOf(account).sub(heldBalance[account]);
    }

    /// @notice Retrive the erc20.balanceOf(msg.sender)  (** TALK THIS CONCEPT WITH JULIO **)
    function virtualBalanceOf(address account) public view returns (uint256) {
        return super.balanceOf(account);
    }

}
