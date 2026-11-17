// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

// Ejercicio 1: guardar el hash (CID) de los datos enviados por el usuario a IPFS
contract IpfsStorage {
    mapping (address => string) public userFiles;

    function setFileIPFS(string memory file) external {
        userFiles[msg.sender] = file;
    }
}
