import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  authTag: string;
}

/**
 * Cifra/decifra segreti (credenziali provider, token) con AES-256-GCM.
 * La chiave arriva da CREDENTIALS_ENCRYPTION_KEY (32 byte, esadecimale) e non deve mai
 * essere committata: in assenza di chiave valida il servizio si rifiuta di cifrare/decifrare.
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly key: Buffer | null;

  constructor(private readonly config: ConfigService) {
    const rawKey = this.config.get<string>('CREDENTIALS_ENCRYPTION_KEY');
    if (!rawKey || rawKey.length !== 64) {
      this.logger.warn(
        'CREDENTIALS_ENCRYPTION_KEY assente o non valida (attesi 64 caratteri esadecimali / 32 byte). ' +
          'La cifratura delle credenziali provider resterà disabilitata finché non viene configurata.',
      );
      this.key = null;
    } else {
      this.key = Buffer.from(rawKey, 'hex');
    }
  }

  get isConfigured(): boolean {
    return this.key !== null;
  }

  encrypt(plainText: string): EncryptedPayload {
    if (!this.key) {
      throw new Error(
        'Cifratura non disponibile: CREDENTIALS_ENCRYPTION_KEY non configurata.',
      );
    }
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
      ciphertext: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
    };
  }

  decrypt(payload: EncryptedPayload): string {
    if (!this.key) {
      throw new Error(
        'Decifratura non disponibile: CREDENTIALS_ENCRYPTION_KEY non configurata.',
      );
    }
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, Buffer.from(payload.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }
}
