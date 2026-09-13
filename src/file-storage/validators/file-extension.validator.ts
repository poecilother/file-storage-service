import { extname } from 'node:path'

import { FileValidator } from '@nestjs/common'

export interface FileExtensionValidatorOptions {
  allowedExtensions: string[]
}

export class FileExtensionValidator extends FileValidator<FileExtensionValidatorOptions> {
  isValid(file?: Express.Multer.File): boolean {
    if (!file) {
      return false
    }

    const extension = extname(file.originalname).slice(1).toLowerCase()

    return this.validationOptions.allowedExtensions.includes(extension)
  }

  buildErrorMessage(file: Express.Multer.File): string {
    return `Validation failed (extension of file "${file.originalname}" is not allowed, allowed extensions are: ${this.validationOptions.allowedExtensions.join(', ')})`
  }
}
