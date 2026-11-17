import { Component, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Campana, Documento, ESTADOS, FichaCampana, IPFS_GATEWAY, IpfsService, TIPOS_DOC } from './ipfs.service';

type Vista = 'campanas' | 'crear' | 'ej1';

interface Aviso {
  tipo: 'ok' | 'error' | 'info';
  texto: string;
  enlace?: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  readonly estados = ESTADOS;
  readonly tiposDoc = TIPOS_DOC;
  readonly gateway = IPFS_GATEWAY;

  cuenta = '';
  vista: Vista = 'campanas';
  ocupado = false;
  pasoActual = '';
  aviso: Aviso | null = null;

  // Ejercicio 1
  ej1Fichero: File | null = null;
  ej1Cid = '';
  ej1CidGuardado = '';

  // Crear campaña
  nueva: FichaCampana = { titulo: '', descripcion: '', ubicacion: '', beneficiario: '', fecha: '' };
  nuevaMeta = '0.01';

  // Listado
  campanas: Campana[] = [];
  abierta: number | null = null;
  docs: Documento[] = [];
  cantidadDonar: { [id: number]: string } = {};

  // Registrar documento
  docFichero: File | null = null;
  docNombre = '';
  docTipo = 1;
  docImporte = '';

  // Verificar documento
  verifFichero: File | null = null;
  verifResultado = '';

  constructor(private svc: IpfsService, private zone: NgZone) {}

  ngOnInit(): void {
    // Si el usuario cambia de cuenta o de red en MetaMask, se recarga la página
    this.svc.onAccountOrChainChange(() => {
      if (this.cuenta) {
        this.zone.run(() => window.location.reload());
      }
    });
  }

  // ------------------------------------------------------------------
  // Utilidades
  // ------------------------------------------------------------------

  private async ejecutar(paso: string, accion: () => Promise<void>): Promise<void> {
    this.ocupado = true;
    this.pasoActual = paso;
    this.aviso = null;
    try {
      await accion();
    } catch (e) {
      console.error(e);
      this.aviso = { tipo: 'error', texto: this.svc.mensajeError(e) };
    } finally {
      this.ocupado = false;
      this.pasoActual = '';
    }
  }

  private ok(texto: string, tx?: string): void {
    this.aviso = { tipo: 'ok', texto, enlace: tx ? `https://sepolia.etherscan.io/tx/${tx}` : undefined };
  }

  corta(dir: string): string {
    return dir ? `${dir.substring(0, 6)}…${dir.substring(dir.length - 4)}` : '';
  }

  esCreador(c: Campana): boolean {
    return c.creador.toLowerCase() === this.cuenta.toLowerCase();
  }

  ficheroDe(evento: Event): File | null {
    const input = evento.target as HTMLInputElement;
    return input.files && input.files.length > 0 ? input.files[0] : null;
  }

  // ------------------------------------------------------------------
  // Conexión
  // ------------------------------------------------------------------

  conectar(): Promise<void> {
    return this.ejecutar('Conectando con MetaMask…', async () => {
      this.cuenta = await this.svc.connectMetamask();
      await this.cargarCampanas();
    });
  }

  cambiarVista(v: Vista): void {
    this.vista = v;
    this.aviso = null;
    if (v === 'campanas') {
      this.ejecutar('Cargando campañas…', () => this.cargarCampanas());
    }
  }

  // ------------------------------------------------------------------
  // Ejercicio 1
  // ------------------------------------------------------------------

  ej1Subir(): Promise<void> {
    return this.ejecutar('Subiendo a IPFS y guardando el CID en el contrato…', async () => {
      const r = await this.svc.ej1SubirYGuardar(this.ej1Fichero!);
      this.ej1Cid = r.cid;
      this.ok(`Fichero subido a IPFS y CID guardado en IpfsStorage: ${r.cid}`, r.tx);
    });
  }

  ej1Leer(): Promise<void> {
    return this.ejecutar('Leyendo userFiles(tu dirección)…', async () => {
      this.ej1CidGuardado = (await this.svc.ej1LeerMiFichero()) || '(vacío)';
    });
  }

  // ------------------------------------------------------------------
  // Campañas
  // ------------------------------------------------------------------

  private async cargarCampanas(): Promise<void> {
    this.campanas = await this.svc.listarCampanas();
    for (const c of this.campanas) {
      this.svc
        .leerJson<FichaCampana>(c.cidFicha)
        .then((f) => this.zone.run(() => (c.ficha = f)))
        .catch(() => undefined);
    }
    if (this.abierta !== null) {
      this.docs = await this.svc.documentos(this.abierta);
    }
  }

  crearCampana(): Promise<void> {
    return this.ejecutar('Subiendo la ficha a IPFS y creando la campaña…', async () => {
      this.nueva.fecha = new Date().toISOString();
      this.nueva.beneficiario = this.nueva.beneficiario || this.cuenta;
      const r = await this.svc.crearCampana(this.nueva, this.nuevaMeta);
      this.nueva = { titulo: '', descripcion: '', ubicacion: '', beneficiario: '', fecha: '' };
      this.vista = 'campanas';
      await this.cargarCampanas();
      this.ok(`Campaña creada. Ficha en IPFS: ${r.cid}`, r.tx);
    });
  }

  async alternar(c: Campana): Promise<void> {
    this.verifResultado = '';
    if (this.abierta === c.id) {
      this.abierta = null;
      return;
    }
    this.abierta = c.id;
    this.docs = [];
    await this.ejecutar('Cargando documentos…', async () => {
      this.docs = await this.svc.documentos(c.id);
    });
  }

  donar(c: Campana): Promise<void> {
    const cantidad = this.cantidadDonar[c.id] || '0.001';
    return this.ejecutar(`Donando ${cantidad} ETH…`, async () => {
      const tx = await this.svc.donar(c.id, cantidad);
      await this.cargarCampanas();
      this.ok(`Gracias por tu donación de ${cantidad} ETH`, tx);
    });
  }

  retirar(c: Campana): Promise<void> {
    return this.ejecutar('Retirando fondos…', async () => {
      const tx = await this.svc.retirarFondos(c.id);
      await this.cargarCampanas();
      this.ok('Fondos retirados. Recuerda subir las facturas que justifican el gasto.', tx);
    });
  }

  cancelar(c: Campana): Promise<void> {
    return this.ejecutar('Cancelando la campaña…', async () => {
      const tx = await this.svc.cancelarCampana(c.id);
      await this.cargarCampanas();
      this.ok('Campaña cancelada. Los donantes ya pueden reclamar su reembolso.', tx);
    });
  }

  reembolso(c: Campana): Promise<void> {
    return this.ejecutar('Reclamando reembolso…', async () => {
      const tx = await this.svc.reclamarReembolso(c.id);
      await this.cargarCampanas();
      this.ok('Reembolso recibido', tx);
    });
  }

  registrarDoc(c: Campana): Promise<void> {
    return this.ejecutar('Subiendo el documento a IPFS y registrándolo en el contrato…', async () => {
      const r = await this.svc.registrarDocumento(c.id, this.docFichero!, this.docNombre, Number(this.docTipo), this.docImporte);
      this.docFichero = null;
      this.docNombre = '';
      this.docImporte = '';
      await this.cargarCampanas();
      this.ok(`Documento registrado. CID: ${r.cid}`, r.tx);
    });
  }

  verificar(): Promise<void> {
    return this.ejecutar('Calculando el CID del fichero…', async () => {
      const cid = await this.svc.calcularCid(this.verifFichero!);
      const doc = this.docs.find((d) => d.cid === cid);
      this.verifResultado = doc
        ? `✅ Auténtico: coincide con "${doc.nombre}" registrado el ${doc.fecha.toLocaleString()} (CID ${cid})`
        : `❌ No coincide con ningún documento de esta campaña (CID calculado ${cid})`;
    });
  }
}
