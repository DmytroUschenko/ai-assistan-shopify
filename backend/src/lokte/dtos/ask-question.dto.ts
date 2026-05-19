import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AskQuestionDto {
  @IsString()
  @IsNotEmpty()
  question!: string;

  @IsOptional()
  @IsString()
  userId?: string;
}
