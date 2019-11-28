pragma solidity ^0.5.0;

import "../Holdable.sol";


contract HoldableMock is Holdable {
    bool isExpiredSet;
    bool isExpired;

    function mint(address account, uint256 value) external {
        _mint(account, value);
    }

    function changeHoldExpirationTime(string calldata operationId, uint256 _expiration) external {
        holds[operationId.toHash()].expiration = _expiration;
    }

    function setExpired(bool _isExpired) external {
        isExpiredSet = true;
        isExpired = _isExpired;
    }

    function addDefaultOperator(address operator) external {
        _addDefaultOperator(operator);
    }

    function removeDefaultOperator(address operator) external {
        _removeDefaultOperator(operator);
    }

    function _isExpired(uint256 expiration) internal view returns (bool) {
        if (isExpiredSet) {
            return isExpired;
        }

        return super._isExpired(expiration);
    }
}
