// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Importamos la implementación estándar de ERC20 desde OpenZeppelin
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Ej4 is ERC20 {
    constructor() ERC20("MiPrimerToken", "MPT") {
        // Se le da 1,000,000 de tokens  a la cuenta que despliega el contrato
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }
}