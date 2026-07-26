import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  it('cifra e decifra correttamente un segreto quando la chiave è configurata', () => {
    const config = new ConfigService({
      CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(64),
    });
    const service = new EncryptionService(config);

    expect(service.isConfigured).toBe(true);

    const payload = service.encrypt('super-secret-token');
    expect(payload.ciphertext).not.toContain('super-secret-token');

    const decrypted = service.decrypt(payload);
    expect(decrypted).toBe('super-secret-token');
  });

  it('produce testi cifrati diversi per lo stesso input (IV casuale)', () => {
    const config = new ConfigService({ CREDENTIALS_ENCRYPTION_KEY: 'b'.repeat(64) });
    const service = new EncryptionService(config);

    const a = service.encrypt('stesso-valore');
    const b = service.encrypt('stesso-valore');
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.iv).not.toBe(b.iv);
  });

  it('si rifiuta di cifrare se CREDENTIALS_ENCRYPTION_KEY non è configurata', () => {
    const previous = process.env.CREDENTIALS_ENCRYPTION_KEY;
    delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    try {
      const config = new ConfigService({});
      const service = new EncryptionService(config);

      expect(service.isConfigured).toBe(false);
      expect(() => service.encrypt('qualcosa')).toThrow();
    } finally {
      if (previous !== undefined) process.env.CREDENTIALS_ENCRYPTION_KEY = previous;
    }
  });

  it('rileva la manomissione del testo cifrato tramite auth tag GCM', () => {
    const config = new ConfigService({ CREDENTIALS_ENCRYPTION_KEY: 'c'.repeat(64) });
    const service = new EncryptionService(config);

    const payload = service.encrypt('dato-integro');
    const tampered = { ...payload, ciphertext: Buffer.from('dato-manomesso').toString('base64') };

    expect(() => service.decrypt(tampered)).toThrow();
  });
});
