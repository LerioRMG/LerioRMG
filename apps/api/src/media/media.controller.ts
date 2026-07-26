import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { MediaService } from './media.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { Audit } from '../common/decorators/audit.decorator';
import { AuthUser } from '../common/types/auth-user';

@Controller('media')
@RequirePermissions('media.view')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('creatorId') creatorId?: string, @Query('type') type?: string) {
    return this.mediaService.list(user, creatorId, type);
  }

  @Post('creators/:creatorId')
  @RequirePermissions('media.manage')
  @Audit('media.upload', 'media_asset')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentUser() user: AuthUser,
    @Param('creatorId') creatorId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { type: string; visibility?: string; tags?: string; price?: string },
  ) {
    return this.mediaService.upload(user, creatorId, file, {
      type: body.type,
      visibility: body.visibility,
      tags: body.tags ? body.tags.split(',').map((t) => t.trim()) : [],
      price: body.price ? Number(body.price) : undefined,
    });
  }

  @Get(':id/download')
  async download(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    const { path: filePath, asset } = await this.mediaService.getFilePath(user, id);
    res.download(filePath, asset.fileName);
  }
}
