import { IsNotEmpty, IsString } from 'class-validator';

export class SetConfigDto {
  @IsString()
  @IsNotEmpty()
  path!: string;

  @IsNotEmpty()
  value!: unknown;
}
