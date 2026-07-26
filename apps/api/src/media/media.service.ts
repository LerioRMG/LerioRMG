import { Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../common/prisma.service';
import { AuthUser } from '../common/types/auth-user';

export const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

@Injectable()
export class MediaService {
  constructor(private readonly prisma: PrismaService) {
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  async list(user: AuthUser, creatorId?: string, type?: string) {
    return this.prisma.mediaAsset.findMany({
      where: {
        creator: { organizationId: user.organizationId },
        ...(creatorId ? { creatorId } : {}),
        ...(type ? { type: type as any } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async upload(
    user: AuthUser,
    creatorId: string,
    file: Express.Multer.File,
    meta: { type: string; visibility?: string; tags?: string[]; price?: number },
  ) {
    const creator = await this.prisma.creator.findFirst({
      where: { id: creatorId, organizationId: user.organizationId },
    });
    if (!creator) throw new NotFoundException('Creator non trovata.');

    const storageKey = `${creatorId}/${Date.now()}-${file.originalname}`;
    const destPath = path.join(UPLOADS_DIR, storageKey);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, file.buffer);

    return this.prisma.mediaAsset.create({
      data: {
        creatorId,
        type: meta.type as any,
        visibility: (meta.visibility as any) || 'PREMIUM',
        storageKey,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        tags: meta.tags || [],
        price: meta.price,
      },
    });
  }

  async getFilePath(user: AuthUser, id: string) {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id, creator: { organizationId: user.organizationId } },
    });
    if (!asset) throw new NotFoundException('Media non trovato.');
    return { path: path.join(UPLOADS_DIR, asset.storageKey), asset };
  }
}
