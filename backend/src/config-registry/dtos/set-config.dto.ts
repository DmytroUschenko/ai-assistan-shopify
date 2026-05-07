import { IsDefined, IsNotEmpty, IsString } from 'class-validator';

export class SetConfigDto {
  @IsString()
  @IsNotEmpty()
  path!: string;

  @IsDefined()
  value!: unknown;
}
