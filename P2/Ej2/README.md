# Práctica 2 – IPFS: DANA Solidaria

Crowdfunding para la reconstrucción tras la DANA. Los documentos que justifican cada campaña (ficha, informes de daños, facturas, informe final) se guardan en **IPFS**, y su **CID** queda registrado en un contrato de **Ethereum (Sepolia)**.

```
contracts/IpfsStorage.sol        Ejercicio 1 (contrato del enunciado)
contracts/CrowdfundingDANA.sol   Ejercicio 2 (evolución del Ej5 de la Práctica 1)
dapp/                            Dapp Angular 19 (pestaña "Ejercicio 1" + plataforma de campañas)
```

---

## Guía paso a paso (Ubuntu)

### Paso 0 · Requisitos (una sola vez)

```bash
# Node 22 (Angular 19 necesita Node >= 20; la v18 del PDF NO sirve)
sudo apt update && sudo apt install -y curl git unzip
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 22
node -v                       # v22.x

# Docker
sudo apt install -y docker.io
sudo usermod -aG docker $USER  # luego CIERRA SESIÓN y vuelve a entrar
docker run hello-world
```

MetaMask:
1. Instala la extensión en Firefox o Chrome **dentro de Ubuntu**.
2. Activa las redes de prueba (Ajustes → Avanzado → *Mostrar redes de prueba*) y elige **Sepolia**.
3. Crea **dos cuentas** (Cuenta 1 = creador, Cuenta 2 = donante). Consigue SepoliaETH en un faucet y pasa una parte a la Cuenta 2.

### Paso 1 · Nodo IPFS

```bash
mkdir -p ~/ipfs/export ~/ipfs/data
docker run -d --name ipfs_host \
  -v ~/ipfs/export:/export -v ~/ipfs/data:/data/ipfs \
  -p 4001:4001 -p 4001:4001/udp \
  -p 127.0.0.1:8080:8080 -p 127.0.0.1:5001:5001 \
  ipfs/kubo

docker exec ipfs_host ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin \
  '["http://localhost:4200","http://localhost:3000","http://127.0.0.1:5001","http://localhost:5001","https://webui.ipfs.io"]'
docker exec ipfs_host ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["PUT","POST","GET"]'
docker restart ipfs_host
```

Comprueba que funciona abriendo http://127.0.0.1:5001/webui (tiene que cargar el panel).
En otra sesión, si el contenedor está parado: `docker start ipfs_host`.

### Paso 2 · Desplegar los contratos en Remix

Ve a https://remix.ethereum.org.

1. Crea `IpfsStorage.sol` y `CrowdfundingDANA.sol` con el contenido de la carpeta `contracts/`.
2. Pestaña **Solidity Compiler**: compila los dos (versión 0.8.20 o superior). Copia el ABI de `IpfsStorage` para la memoria.
3. Pestaña **Deploy & Run**:
   - Environment: **Injected Provider - MetaMask**, con la **Cuenta 1** en Sepolia.
   - Despliega **IpfsStorage**, confirma en MetaMask y copia su dirección.
   - Despliega **CrowdfundingDANA** (no tiene parámetros), confirma y copia su dirección.
4. Pega las dos direcciones en `dapp/src/app/contracts/src/addresses.ts`.

> Los ABIs ya vienen incluidos en `dapp/src/app/contracts/src/abis.ts`, en formato *human-readable* de ethers. Si cambias los contratos, actualízalos.

### Paso 3 · Arrancar la dapp

```bash
cd dapp
npm install
npm start          # http://localhost:3000
```

### Paso 4 · Ejercicio 1 

1. Abre http://localhost:3000, pulsa **Conectar MetaMask** y ve a la pestaña **Ejercicio 1**.
2. Elige un fichero, pulsa **Subir** y confirma en MetaMask.
3. Haz las capturas:
   - el fichero en la WebUI (pestaña *Files*);
   - la transacción en sepolia.etherscan.io (enlace que muestra la dapp);
   - el resultado de **Leer userFiles**, o `userFiles(tu dirección)` en Remix, devolviendo el CID.

### Paso 5 · Ejercicio 2 

Sigue la tabla de pruebas de la sección 4 de la memoria. Resumen:

1. **Cuenta 1**: crea la campaña con meta 0.01 ETH.
2. **Cuenta 2**: dona 0.004 y luego 0.006 ETH. La campaña pasa a *Meta alcanzada*.
3. **Cuenta 1**: intenta retirar → no deja. Registra un *Informe de daños* (un PDF o una foto) → ahora sí puede **Retirar fondos**.
4. **Cuenta 1**: registra una *Factura* de 0.006 ETH. Si pruebas con 0.02 ETH, el contrato la rechaza.
5. **Cuenta 2**: en *Verificar*, selecciona la misma factura . Cambia un carácter del fichero y vuelve a verificar .
6. Crea una segunda campaña, dona con la Cuenta 2, cancélala con la Cuenta 1 y reclama el reembolso con la Cuenta 2.

Para cambiar de cuenta, cámbiala en MetaMask: la dapp se recarga sola. Después vuelve a pulsar *Conectar*.


