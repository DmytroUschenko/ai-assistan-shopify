import { IsNotEmpty, IsString } from 'class-validator';

export class GetValueQueryDto {
  @IsString()
  @IsNotEmpty()
  path!: string;
}
