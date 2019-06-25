pragma solidity ^0.5.0;

import "../Holdable.sol";

contract HoldableMock is Holdable {
    function mint(address account, uint256 value) public {
        _mint(account, value);
    }
}
