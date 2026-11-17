import React, { useEffect, useState } from "react";
import './App.css';
import { create } from 'kubo-rpc-client';
import { ethers } from "ethers";
import { Buffer } from "buffer";
import logo from "./ethereumLogo.png";
import { addresses, abis } from "./contracts";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000000000000000000000000000";

function App() {
  const [ipfsHash, setIpfsHash] = useState("");
  const [file, setFile] = useState(null);
  const [account, setAccount] = useState("");

  useEffect(() => {
    async function initWallet() {
      if (!window.ethereum) {
        alert("Instala MetaMask para usar esta aplicación");
        return;
      }
      try {
        // 1. Pedir conexión explícita a MetaMask y esperar respuesta
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const userAddress = accounts[0];
        setAccount(userAddress);

        // 2. Leer el archivo guardado una vez que ya tenemos la cuenta conectada
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const ipfsContract = new ethers.Contract(addresses.ipfs, abis.ipfs, provider);
        const savedFile = await ipfsContract.userFiles(userAddress);
        
        if (savedFile && savedFile !== ZERO_ADDRESS) {
          setIpfsHash(savedFile);
        }
      } catch (error) {
        console.error("Error conectando wallet o leyendo contrato:", error);
      }
    }
    initWallet();
  }, []);

  async function setFileIPFS(hash) {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const ipfsContract = new ethers.Contract(addresses.ipfs, abis.ipfs, signer);

    console.log("Enviando transacción al contrato...");
    const tx = await ipfsContract.setFileIPFS(hash);
    console.log({ tx });
    await tx.wait(); // Espera a que se mine en Sepolia
    setIpfsHash(hash);
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      alert("Selecciona un archivo primero");
      return;
    }
    try {
      // Conectar a IPFS local (127.0.0.1 evita bloqueos de red en Windows)
      const client = await create('/ip4/127.0.0.1/tcp/5001');
      
      // Subir archivo a IPFS
      const result = await client.add(file);
      
      // Copiar al sistema de archivos (MFS) para verlo en la pestaña Files de WebUI
      await client.files.cp(`/ipfs/${result.cid}`, `/${result.cid}`);
      console.log("CID generado:", result.cid.toString());

      // Guardar el CID en Ethereum (Sepolia)
      await setFileIPFS(result.cid.toString());
    } catch (error) {
      console.error("Error en subida:", error);
      alert("Error: " + error.message);
    }
  };

  const retrieveFile = (e) => {
    const data = e.target.files[0];
    if (!data) return;
    const reader = new window.FileReader();
    reader.readAsArrayBuffer(data);
    reader.onloadend = () => {
      setFile(Buffer.from(reader.result));
    };
    e.preventDefault();
  };

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Upload a file to store it on IPFS and save the hash on ethereum.
        </p>
        {account && (
          <p style={{ fontSize: "14px", color: "#61dafb" }}>
            Wallet conectada: {account}
          </p>
        )}
        <form className="form" onSubmit={handleSubmit}>
          <input type="file" name="data" onChange={retrieveFile} />
          <button type="submit" className="btn">Upload</button>
        </form>
        {ipfsHash && (
          <p style={{ fontSize: "14px", marginTop: "20px" }}>
            CID guardado en Sepolia: <strong>{ipfsHash}</strong>
          </p>
        )}
      </header>
    </div>
  );
}

export default App;