// SPDX-License-Identifier: Unlicenced
pragma solidity 0.8.30;

contract TokenContract {
    address public owner;

    struct Receivers {
        string name;
        uint256 tokens;
    }

    mapping (address => Receivers) public users;

    modifier onlyOwner(){
        require(msg.sender == owner, "Solo propietario");
        _;
    }

    constructor(){
        owner = msg.sender;
        users[owner].tokens = 100;
    }

    function double(uint value) public pure returns (uint) {
        return value * 2;
    }

    function register(string memory _name) public {
        users[msg.sender].name = _name;
    }

    function giveToken(address _receiver, uint256 amount) onlyOwner public {
        require(users[owner].tokens >= amount, "El propietario no tiene suficientes tokens");
        users[owner].tokens -= amount;
        users[_receiver].tokens += amount;
    }

    
    function buyTokens(uint256 amount) public payable {
        // 1 token 5 Ether
        uint256 cost = amount * 5 ether;

        // Verificar que se envie el Ether suficiente
        require(msg.value >= cost, "Ether insuficiente enviado: 1 token cuesta 5 Ether");

        // Verificar que el owner tenga tokens suficientes
        require(users[owner].tokens >= amount, "El propietario no tiene suficientes tokens disponibles");

        // Transferir los tokens del owner al comprador
        users[owner].tokens -= amount;
        users[msg.sender].tokens += amount;

        
    }

    
    function getContractBalance() public view returns (uint256) {
        return address(this).balance;
    }
}