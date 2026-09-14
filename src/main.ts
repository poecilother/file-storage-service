import { Logger, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module'
import {
  EnvVariable,
  EnvVariableDefault,
} from './config/env/env-variable.constants'
import { setupSwagger } from './config/swagger/swagger.config'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))

  setupSwagger(app)

  const configService = app.get(ConfigService)
  const port = configService.get<number>(
    EnvVariable.PORT,
    EnvVariableDefault[EnvVariable.PORT],
  )

  await app.listen(port, () => {
    Logger.log(`Server listening on http://localhost:${port}`)
    Logger.log(`Swagger docs available at http://localhost:${port}/docs`)
  })
}
bootstrap()
