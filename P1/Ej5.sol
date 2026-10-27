// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Ej5 {
    // Variables de estado
    address payable public creator;
    uint256 public goal;
    uint256 public totalRaised;
    bool public closed;

    // Registro de aportaciones por usuario
    mapping(address => uint256) public contributions;

    event ContributionReceived(address contributor, uint256 amount);
    event GoalReached(uint256 totalRaised);
    event FundsWithdrawn(address creator, uint256 amount);

    // Restricción de acceso
    modifier onlyCreator() {
        require(msg.sender == creator, "Solo el creador puede ejecutar esta accion");
        _;
    }

    // El constructor define la meta en Ethers al desplegar
    constructor(uint256 _goalInEther) {
        creator = payable(msg.sender);
        goal = _goalInEther * 1 ether;
    }

    
    function contribute() public payable {
        require(!closed, "La campana ya ha finalizado exitosamente");
        require(msg.value > 0, "La donacion debe ser mayor a 0 Wei");

        // Actualizar el estado
        contributions[msg.sender] += msg.value;
        totalRaised += msg.value;

        emit ContributionReceived(msg.sender, msg.value);

        // Comprobar si se alcanzó la meta
        if (totalRaised >= goal) {
            closed = true;
            emit GoalReached(totalRaised);
        }
    }

    
    function withdrawFunds() public onlyCreator {
        require(closed, "La meta aun no se ha alcanzado");
        
        uint256 amount = address(this).balance;
        require(amount > 0, "No hay fondos para retirar");

        // Transferir el saldo al creador
        creator.transfer(amount);
        
        emit FundsWithdrawn(creator, amount);
    }
}