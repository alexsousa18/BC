import { Injectable } from '@angular/core';
import { create } from 'kubo-rpc-client';
import { ethers } from 'ethers';
import { Buffer } from 'buffer';
import addresses from './contracts/src/addresses';
import abis from './contracts/src/abis';

const SEPOLIA_CHAIN_ID = '0xaa36a7'; // 11155111 en hexadecimal
const IPFS_API = 'http://localhost:5001/api/v0';
export const IPFS_GATEWAY = 'http://127.0.0.1:8080/ipfs/';

export const ESTADOS = ['Activa', 'Meta alcanzada', 'Cancelada'];
export const TIPOS_DOC = ['Ficha de campaña', 'Informe de daños', 'Factura', 'Informe final'];

export interface Campana {
  id: number;
  creador: string;
  titulo: string;
  cidFicha: string;
  meta: string;          // ETH
  recaudado: string;     // ETH
  retirado: string;      // ETH
  justificado: string;   // ETH
  estado: number;
  tieneInformeDanos: boolean;
  fechaCreacion: Date;
  porcentaje: number;
  miAportacion: string;  // ETH
  ficha?: FichaCampana;
}

export interface FichaCampana {
  titulo: string;
  descripcion: string;
  ubicacion: string;
  beneficiario: string;
  fecha: string;
}

export interface Documento {
  cid: string;
  nombre: string;
  tipo: number;
  importe: string;       // ETH
  fecha: Date;
}

@Injectable({ providedIn: 'root' })
export class IpfsService {
  private provider: ethers.providers.Web3Provider | null = null;
  private signer: ethers.Signer | null = null;
  private ipfs: any = create({ url: IPFS_API });

  get ethereum(): any {
    return (window as any).ethereum;
  }

  // ------------------------------------------------------------------
  // MetaMask / Sepolia
  // ------------------------------------------------------------------

  async connectMetamask(): Promise<string> {
    if (!this.ethereum) {
      throw new Error('No se ha encontrado MetaMask en este navegador');
    }
    await this.ethereum.request({ method: 'eth_requestAccounts' });
    await this.verifyAndSwitchToSepolia();
    // El provider se crea después de cambiar de red para que ethers no se quede con la red anterior
    this.provider = new ethers.providers.Web3Provider(this.ethereum, 'any');
    this.signer = this.provider.getSigner();
    return await this.signer.getAddress();
  }

  onAccountOrChainChange(callback: () => void): void {
    if (this.ethereum?.on) {
      this.ethereum.on('accountsChanged', callback);
      this.ethereum.on('chainChanged', callback);
    }
  }

  private async verifyAndSwitchToSepolia(): Promise<void> {
    const chainId = await this.ethereum.request({ method: 'eth_chainId' });
    if (chainId === SEPOLIA_CHAIN_ID) {
      return;
    }
    try {
      await this.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      });
    } catch (e: any) {
      throw new Error('Cambia MetaMask a la red Sepolia y vuelve a conectar');
    }
  }

  private contrato(nombre: 'ipfs' | 'crowdfunding'): ethers.Contract {
    if (!this.signer) {
      throw new Error('Conecta primero MetaMask');
    }
    const direccion = addresses[nombre];
    if (!ethers.utils.isAddress(direccion) || /^0x0+$/.test(direccion)) {
      throw new Error(`Falta la dirección del contrato "${nombre}" en contracts/src/addresses.ts`);
    }
    return new ethers.Contract(direccion, abis[nombre], this.signer);
  }

  private async esperar(tx: any): Promise<string> {
    const recibo = await tx.wait(1);
    return recibo.transactionHash;
  }

  // ------------------------------------------------------------------
  // IPFS
  // ------------------------------------------------------------------

  async subirAIpfs(contenido: Uint8Array | string): Promise<string> {
    try {
      const resultado = await this.ipfs.add(contenido);
      const cid = resultado.cid.toString();
      // Copia en MFS para que aparezca en la pestaña "Files" de la WebUI (no es crítico)
      try {
        await this.ipfs.files.cp(`/ipfs/${cid}`, `/${cid}`);
      } catch {
        /* ya existe o MFS no disponible */
      }
      return cid;
    } catch (e: any) {
      throw new Error('No se pudo subir a IPFS. ¿Está arrancado el nodo y configurado CORS? ' + (e?.message ?? ''));
    }
  }

  async subirFichero(fichero: File): Promise<string> {
    return this.subirAIpfs(await this.leerFichero(fichero));
  }

  /** Calcula el CID que tendría un fichero, sin guardarlo en el nodo. */
  async calcularCid(fichero: File): Promise<string> {
    const resultado = await this.ipfs.add(await this.leerFichero(fichero), { onlyHash: true });
    return resultado.cid.toString();
  }

  async leerJson<T>(cid: string): Promise<T> {
    const trozos: Uint8Array[] = [];
    for await (const trozo of this.ipfs.cat(cid)) {
      trozos.push(trozo);
    }
    return JSON.parse(Buffer.concat(trozos).toString('utf-8')) as T;
  }

  private async leerFichero(fichero: File): Promise<Uint8Array> {
    return new Uint8Array(await fichero.arrayBuffer());
  }

  // ------------------------------------------------------------------
  // Ejercicio 1: IpfsStorage
  // ------------------------------------------------------------------

  async ej1SubirYGuardar(fichero: File): Promise<{ cid: string; tx: string }> {
    const cid = await this.subirFichero(fichero);
    const tx = await this.contrato('ipfs')['setFileIPFS'](cid);
    return { cid, tx: await this.esperar(tx) };
  }

  async ej1LeerMiFichero(): Promise<string> {
    const yo = await this.signer!.getAddress();
    return await this.contrato('ipfs')['userFiles'](yo);
  }

  // ------------------------------------------------------------------
  // Ejercicio 2: CrowdfundingDANA
  // ------------------------------------------------------------------

  async crearCampana(ficha: FichaCampana, metaEth: string): Promise<{ cid: string; tx: string }> {
    const cid = await this.subirAIpfs(JSON.stringify(ficha, null, 2));
    const metaWei = ethers.utils.parseEther(String(metaEth));
    const tx = await this.contrato('crowdfunding')['crearCampana'](ficha.titulo, cid, metaWei);
    return { cid, tx: await this.esperar(tx) };
  }

  async listarCampanas(): Promise<Campana[]> {
    const c = this.contrato('crowdfunding');
    const yo = await this.signer!.getAddress();
    const total = (await c['numCampanas']()).toNumber();
    const lista: Campana[] = [];
    for (let id = total - 1; id >= 0; id--) {
      const r = await c['getCampana'](id);
      const aportado = await c['aportaciones'](id, yo);
      const meta = r.meta as ethers.BigNumber;
      const recaudado = r.recaudado as ethers.BigNumber;
      lista.push({
        id,
        creador: r.creador,
        titulo: r.titulo,
        cidFicha: r.cidFicha,
        meta: ethers.utils.formatEther(meta),
        recaudado: ethers.utils.formatEther(recaudado),
        retirado: ethers.utils.formatEther(r.retirado),
        justificado: ethers.utils.formatEther(r.justificado),
        estado: r.estado,
        tieneInformeDanos: r.tieneInformeDanos,
        fechaCreacion: new Date((r.fechaCreacion as ethers.BigNumber).toNumber() * 1000),
        porcentaje: meta.isZero() ? 0 : Math.min(100, recaudado.mul(100).div(meta).toNumber()),
        miAportacion: ethers.utils.formatEther(aportado),
      });
    }
    return lista;
  }

  async documentos(id: number): Promise<Documento[]> {
    const docs = await this.contrato('crowdfunding')['getDocumentos'](id);
    return docs.map((d: any) => ({
      cid: d.cid,
      nombre: d.nombre,
      tipo: d.tipo,
      importe: ethers.utils.formatEther(d.importe),
      fecha: new Date((d.fecha as ethers.BigNumber).toNumber() * 1000),
    }));
  }

  async donar(id: number, cantidadEth: string): Promise<string> {
    const tx = await this.contrato('crowdfunding')['donar'](id, {
      value: ethers.utils.parseEther(String(cantidadEth)),
    });
    return this.esperar(tx);
  }

  async retirarFondos(id: number): Promise<string> {
    return this.esperar(await this.contrato('crowdfunding')['retirarFondos'](id));
  }

  async cancelarCampana(id: number): Promise<string> {
    return this.esperar(await this.contrato('crowdfunding')['cancelarCampana'](id));
  }

  async reclamarReembolso(id: number): Promise<string> {
    return this.esperar(await this.contrato('crowdfunding')['reclamarReembolso'](id));
  }

  async registrarDocumento(
    id: number,
    fichero: File,
    nombre: string,
    tipo: number,
    importeEth: string
  ): Promise<{ cid: string; tx: string }> {
    const cid = await this.subirFichero(fichero);
    const importe = tipo === 2 ? ethers.utils.parseEther(String(importeEth || '0')) : 0;
    const tx = await this.contrato('crowdfunding')['registrarDocumento'](id, cid, nombre || fichero.name, tipo, importe);
    return { cid, tx: await this.esperar(tx) };
  }

  // ------------------------------------------------------------------
  // Errores legibles
  // ------------------------------------------------------------------

  mensajeError(e: any): string {
    const msg: string =
      e?.error?.data?.message || e?.data?.message || e?.error?.message || e?.reason || e?.message || String(e);
    if (msg.includes('user rejected') || msg.includes('User denied') || e?.code === 'ACTION_REJECTED') {
      return 'Has cancelado la transacción en MetaMask';
    }
    if (msg.includes('insufficient funds')) {
      return 'No tienes suficiente SepoliaETH para pagar la transacción';
    }
    const revert = msg.match(/reverted(?: with reason string)?:?\s*'?([^'"]+)'?/);
    if (revert) {
      return 'El contrato rechazó la operación: ' + revert[1];
    }
    return msg.length > 200 ? msg.substring(0, 200) + '…' : msg;
  }
}
