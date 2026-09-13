import { IsNotEmpty, IsString, MaxLength } from 'class-validator'

export class UploadFileBodyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  fileType: string
}

export class UploadFileResponseDto {
  id: string
}
