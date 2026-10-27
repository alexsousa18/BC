// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Ej5 {
    // Variables de estado
    address payable public creator;
    uint256 public goal;
    uint256 public totalRaised;
    bool public closed;   
    bool public canceled; 

    // Registro de aportaciones por usuario
    mapping(address => uint256) public contributions;

    
    event ContributionReceived(address indexed contributor, uint256 amount);
    event GoalReached(uint256 totalRaised);
    event FundsWithdrawn(address indexed creator, uint256 amount);
    event CampaignCanceled();
    event RefundClaimed(address indexed contributor, uint256 amount);

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

    // Función para donar a la campaña
    function contribute() public payable {
        require(!closed, "La campana ya ha finalizado exitosamente");
        require(!canceled, "La campana ha sido cancelada");
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

    // Función para que el creador retire los fondos si se llegó a la meta
    function withdrawFunds() public onlyCreator {
        require(closed, "La meta aun no se ha alcanzado");
        
        uint256 amount = address(this).balance;
        require(amount > 0, "No hay fondos para retirar");

        
        (bool success, ) = creator.call{value: amount}("");
        require(success, "Fallo al enviar los fondos al creador");
        
        emit FundsWithdrawn(creator, amount);
    }

    // Función para que el creador cancele la campaña si no se llega a la meta
    function cancelCampaign() public onlyCreator {
        require(!closed, "No se puede cancelar, la meta ya se alcanzo");
        require(!canceled, "La campana ya esta cancelada");
        
        canceled = true;
        emit CampaignCanceled();
    }

    // Función para que los contribuyentes recuperen su dinero si se cancela
    function claimRefund() public {
        require(canceled, "Los reembolsos no estan habilitados (campana activa)");
        
        uint256 amount = contributions[msg.sender];
        require(amount > 0, "No tienes fondos aportados para retirar");

        
        contributions[msg.sender] = 0;

        // Transferir el reembolso al contribuyente
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Fallo al enviar el reembolso");

        emit RefundClaimed(msg.sender, amount);
    }
}