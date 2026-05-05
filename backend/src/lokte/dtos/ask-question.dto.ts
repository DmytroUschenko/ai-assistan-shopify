import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class AskQuestionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  message: string;
}
