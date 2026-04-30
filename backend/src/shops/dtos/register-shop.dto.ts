import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class RegisterShopDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i, {
    message: 'shopDomain must be a valid Shopify store domain (*.myshopify.com)',
  })
  shopDomain!: string;

  @IsString()
  @IsNotEmpty()
  accessToken!: string;

  @IsString()
  @IsNotEmpty()
  scope!: string;
}
