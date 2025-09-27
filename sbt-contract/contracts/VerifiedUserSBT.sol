// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract VerifiedUserSBT is ERC721, Ownable {
    uint256 private _tokenIdCounter;
    mapping(address => bool) public isVerified;

    constructor() ERC721("VerifiedUserSBT", "VUSBT") Ownable(msg.sender) {}

    // Mint SBT to verified user (called by backend after successful verification)
    function mint(address to) external onlyOwner {
        require(!isVerified[to], "User already verified");
        _tokenIdCounter++;
        _safeMint(to, _tokenIdCounter);
        isVerified[to] = true;
    }

    // Soulbound: Prevent transfers
    function _update(address to, uint256 tokenId, address auth) internal virtual override returns (address) {
        address from = _ownerOf(tokenId);
        require(to == address(0) || from == address(0), "SBT: Transfers not allowed");
        return super._update(to, tokenId, auth);
    }

    function checkVerified(address user) external view returns (bool) {
        return isVerified[user];
    }
}

