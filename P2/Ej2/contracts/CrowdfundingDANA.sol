// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CrowdfundingDANA
 * @notice Ejercicio 2 (Práctica 2). Evolución del contrato Ej5 de la Práctica 1:
 *  - Permite varias campañas en un mismo contrato.
 *  - Cada campaña tiene su ficha (título, descripción, ubicación...) guardada en IPFS;
 *    en la blockchain solo se registra su CID.
 *  - El creador sube a IPFS los documentos que justifican la campaña
 *    (informes de daños, facturas de gasto, informe final) y su CID queda
 *    registrado de forma inmutable en el contrato.
 *  - Para retirar los fondos es obligatorio haber registrado antes al menos
 *    un informe de daños, y las facturas solo pueden justificar dinero ya retirado.
 */
contract CrowdfundingDANA {

    enum Estado { Activa, Exitosa, Cancelada }
    enum TipoDoc { Presentacion, InformeDanos, Factura, InformeFinal }

    struct Campana {
        address payable creador;
        string titulo;
        string cidFicha;          // CID en IPFS de la ficha JSON de la campaña
        uint256 meta;             // en wei
        uint256 recaudado;        // en wei
        uint256 retirado;         // en wei
        uint256 justificado;      // en wei, suma de importes de facturas
        Estado estado;
        bool tieneInformeDanos;
        uint256 fechaCreacion;
    }

    struct Documento {
        string cid;               // CID del fichero en IPFS
        string nombre;
        TipoDoc tipo;
        uint256 importe;          // en wei (solo facturas; 0 en el resto)
        uint256 fecha;
    }

    Campana[] private campanas;
    mapping(uint256 => mapping(address => uint256)) public aportaciones;
    mapping(uint256 => Documento[]) private documentos;

    event CampanaCreada(uint256 indexed id, address indexed creador, string titulo, uint256 meta, string cidFicha);
    event Donacion(uint256 indexed id, address indexed donante, uint256 cantidad);
    event MetaAlcanzada(uint256 indexed id, uint256 totalRecaudado);
    event FondosRetirados(uint256 indexed id, address indexed creador, uint256 cantidad);
    event CampanaCancelada(uint256 indexed id);
    event ReembolsoReclamado(uint256 indexed id, address indexed donante, uint256 cantidad);
    event DocumentoRegistrado(uint256 indexed id, TipoDoc tipo, string cid, string nombre, uint256 importe);

    modifier existe(uint256 id) {
        require(id < campanas.length, "La campana no existe");
        _;
    }

    modifier soloCreador(uint256 id) {
        require(msg.sender == campanas[id].creador, "Solo el creador puede ejecutar esta accion");
        _;
    }

    // ------------------------------------------------------------------
    // Gestión de campañas
    // ------------------------------------------------------------------

    function crearCampana(string memory titulo, string memory cidFicha, uint256 metaWei)
        external
        returns (uint256 id)
    {
        require(bytes(titulo).length > 0, "El titulo es obligatorio");
        require(bytes(cidFicha).length > 0, "La ficha IPFS es obligatoria");
        require(metaWei > 0, "La meta debe ser mayor que 0");

        id = campanas.length;
        campanas.push();
        Campana storage c = campanas[id];
        c.creador = payable(msg.sender);
        c.titulo = titulo;
        c.cidFicha = cidFicha;
        c.meta = metaWei;
        c.estado = Estado.Activa;
        c.fechaCreacion = block.timestamp;

        documentos[id].push(Documento(cidFicha, "Ficha de la campana", TipoDoc.Presentacion, 0, block.timestamp));

        emit CampanaCreada(id, msg.sender, titulo, metaWei, cidFicha);
        emit DocumentoRegistrado(id, TipoDoc.Presentacion, cidFicha, "Ficha de la campana", 0);
    }

    function donar(uint256 id) external payable existe(id) {
        Campana storage c = campanas[id];
        require(c.estado == Estado.Activa, "La campana no esta activa");
        require(msg.value > 0, "La donacion debe ser mayor a 0 Wei");

        aportaciones[id][msg.sender] += msg.value;
        c.recaudado += msg.value;
        emit Donacion(id, msg.sender, msg.value);

        if (c.recaudado >= c.meta) {
            c.estado = Estado.Exitosa;
            emit MetaAlcanzada(id, c.recaudado);
        }
    }

    function retirarFondos(uint256 id) external existe(id) soloCreador(id) {
        Campana storage c = campanas[id];
        require(c.estado == Estado.Exitosa, "La meta aun no se ha alcanzado");
        require(c.tieneInformeDanos, "Debes registrar antes un informe de danos en IPFS");

        uint256 cantidad = c.recaudado - c.retirado;
        require(cantidad > 0, "No hay fondos para retirar");

        c.retirado += cantidad;   // se actualiza el estado antes de transferir
        (bool ok, ) = c.creador.call{value: cantidad}("");
        require(ok, "Fallo al enviar los fondos al creador");

        emit FondosRetirados(id, c.creador, cantidad);
    }

    function cancelarCampana(uint256 id) external existe(id) soloCreador(id) {
        Campana storage c = campanas[id];
        require(c.estado == Estado.Activa, "Solo se puede cancelar una campana activa");
        c.estado = Estado.Cancelada;
        emit CampanaCancelada(id);
    }

    function reclamarReembolso(uint256 id) external existe(id) {
        require(campanas[id].estado == Estado.Cancelada, "Los reembolsos no estan habilitados");

        uint256 cantidad = aportaciones[id][msg.sender];
        require(cantidad > 0, "No tienes fondos aportados en esta campana");

        aportaciones[id][msg.sender] = 0;
        (bool ok, ) = payable(msg.sender).call{value: cantidad}("");
        require(ok, "Fallo al enviar el reembolso");

        emit ReembolsoReclamado(id, msg.sender, cantidad);
    }

    // ------------------------------------------------------------------
    // Documentos en IPFS
    // ------------------------------------------------------------------

    function registrarDocumento(
        uint256 id,
        string memory cid,
        string memory nombre,
        TipoDoc tipo,
        uint256 importeWei
    ) external existe(id) soloCreador(id) {
        require(bytes(cid).length > 0, "El CID es obligatorio");
        Campana storage c = campanas[id];

        if (tipo == TipoDoc.Factura) {
            require(importeWei > 0, "La factura debe tener importe");
            require(c.justificado + importeWei <= c.retirado, "El importe supera los fondos retirados sin justificar");
            c.justificado += importeWei;
        } else {
            require(importeWei == 0, "Solo las facturas llevan importe");
            if (tipo == TipoDoc.InformeDanos) {
                c.tieneInformeDanos = true;
            }
        }

        documentos[id].push(Documento(cid, nombre, tipo, importeWei, block.timestamp));
        emit DocumentoRegistrado(id, tipo, cid, nombre, importeWei);
    }

    // ------------------------------------------------------------------
    // Consultas
    // ------------------------------------------------------------------

    function numCampanas() external view returns (uint256) {
        return campanas.length;
    }

    function getCampana(uint256 id) external view existe(id) returns (Campana memory) {
        return campanas[id];
    }

    function getDocumentos(uint256 id) external view existe(id) returns (Documento[] memory) {
        return documentos[id];
    }
}
