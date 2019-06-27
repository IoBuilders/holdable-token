pragma solidity ^0.5.0;

import "../Holdable.sol";

contract HoldableMock is Holdable {
    uint256 alternativeNow;

    function mint(address account, uint256 value) public {
        _mint(account, value);
    }

    function setNow(uint256 _alternativeNow) public {
        alternativeNow = _alternativeNow;
    }

    function getNow() internal view returns (uint256) {
        if (alternativeNow != 0) {
            return alternativeNow;
        }

        /* solium-disable-next-line security/no-block-members */
        return block.timestamp;
    }
}
