declare module 'pdf-lib-encrypt' {
  export function configure(pdfLib: any): void;
  export function lock(
    bytes: Uint8Array,
    password: string,
    opts?: { algo?: 'aes256' | 'rc4'; permissions?: number }
  ): Promise<Uint8Array>;
  export function unlockInPlace(
    pdfDoc: any,
    password: string
  ): Promise<boolean>;
}
