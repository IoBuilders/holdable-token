pragma solidity ^0.5.0;

import "../Holdable.sol";


contract HoldableMock is Holdable {
    uint256 alternativeBlockTimeStamp;

    function mint(address account, uint256 value) public {
        _mint(account, value);
    }

    function setBlockTimeStamp(uint256 _alternativeNow) public {
        alternativeBlockTimeStamp = _alternativeNow;
    }

    function _getBlockTimeStamp() internal view returns (uint256) {
        if (alternativeBlockTimeStamp != 0) {
            return alternativeBlockTimeStamp;
        }

        /* solium-disable-next-line security/no-block-members */
        return block.timestamp;
    }
}
