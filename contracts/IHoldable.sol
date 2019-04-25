pragma solidity ^0.5.0;

interface IHoldable {
    enum HoldStatusCode {
        Nonexistent,
        Ordered,
        Executed,
        ReleasedByNotary,
        ReleasedByPayee,
        ReleasedOnExpiration
    }

    function hold(string calldata operationId, address to, address notary, uint256 value, bool expires, uint256 timeToExpiration) external returns (bool);
    function holdFrom(string calldata operationId, address from, address to, address notary, uint256 value, bool expires, uint256 timeToExpiration) external returns (bool);
    function releaseHold(address issuer, string calldata operationId) external returns (bool);
    function executeHold(address issuer, string calldata operationId, uint256 value) external returns (bool);
    function renewHold(string calldata operationId, uint256 timeToExpiration) external returns (bool);
    function retrieveHoldData(address issuer, string calldata operationId) external view returns (address from, address to, address notary, uint256 value, bool expires, uint256 expiration, HoldStatusCode status);

    function balanceOnHold(address wallet) external view returns (uint256);
    function totalSupplyOnHold() external view returns (uint256);

    function approveToHold(address issuer) external returns (bool);
    function revokeApprovalToHold(address issuer) external returns (bool);
    function isApprovedToHold(address from, address issuer) external view returns (bool);

    event HoldCreated(address indexed issuer, string  operationId, address from, address to, address indexed notary, uint256 value, bool expires, uint256 expiration);
    event HoldExecuted(address indexed issuer, string operationId, address indexed notary, uint256 value, uint256 executedValue);
    event HoldReleased(address indexed issuer, string operationId, HoldStatusCode status);
    event HoldRenewed(address indexed issuer, string operationId, uint256 oldExpiration, uint256 newExpiration);
    event ApprovedToHold(address indexed wallet, address indexed operator);
    event RevokedApprovalToHold(address indexed wallet, address indexed operator);
}
