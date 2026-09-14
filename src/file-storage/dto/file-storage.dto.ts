import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString, MaxLength } from 'class-validator'

import { FileStorage } from '../../database/entities/file.entity'

export class FileStorageDto {
  @ApiProperty()
  id: string

  @ApiProperty()
  type: string

  @ApiProperty({ enum: FileStorage })
  storage: FileStorage
}

export class GetFileListQueryDto {
  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  fileType: string
}

export class UploadFileBodyDto extends GetFileListQueryDto {}

export class UploadFileResponseDto {
  @ApiProperty()
  id: string
}
