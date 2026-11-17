// ABIs en formato "human-readable" de ethers v5.
// Si modificas los contratos, actualiza estas firmas (o pega aquí el ABI JSON de Remix).

// Ejercicio 1: contrato IpfsStorage (el del PDF)
export const ipfsStorageAbi = [
  'function setFileIPFS(string file)',
  'function userFiles(address) view returns (string)',
];

// Ejercicio 2: contrato CrowdfundingDANA
const CAMPANA = 'tuple(address creador, string titulo, string cidFicha, uint256 meta, uint256 recaudado, uint256 retirado, uint256 justificado, uint8 estado, bool tieneInformeDanos, uint256 fechaCreacion)';
const DOCUMENTO = 'tuple(string cid, string nombre, uint8 tipo, uint256 importe, uint256 fecha)';

export const crowdfundingAbi = [
  'function crearCampana(string titulo, string cidFicha, uint256 metaWei) returns (uint256)',
  'function donar(uint256 id) payable',
  'function retirarFondos(uint256 id)',
  'function cancelarCampana(uint256 id)',
  'function reclamarReembolso(uint256 id)',
  'function registrarDocumento(uint256 id, string cid, string nombre, uint8 tipo, uint256 importeWei)',
  'function numCampanas() view returns (uint256)',
  `function getCampana(uint256 id) view returns (${CAMPANA})`,
  `function getDocumentos(uint256 id) view returns (${DOCUMENTO}[])`,
  'function aportaciones(uint256, address) view returns (uint256)',
  'event CampanaCreada(uint256 indexed id, address indexed creador, string titulo, uint256 meta, string cidFicha)',
];

export const abis = { ipfs: ipfsStorageAbi, crowdfunding: crowdfundingAbi };
export default abis;
