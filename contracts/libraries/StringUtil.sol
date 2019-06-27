pragma solidity ^0.5.9;


library StringUtil {
    function toHash(string memory _s) internal pure returns (bytes32) {
        return keccak256(abi.encode(_s));
    }
}
