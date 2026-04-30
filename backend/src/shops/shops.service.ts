import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shop } from './shop.entity';

@Injectable()
export class ShopsService {
  private readonly logger = new Logger(ShopsService.name);

  constructor(
    @InjectRepository(Shop)
    private readonly shopRepository: Repository<Shop>,
  ) {}

  async registerShop(
    shopDomain: string,
    accessToken: string,
    scope: string,
  ): Promise<Shop> {
    const existing = await this.shopRepository.findOne({ where: { shopDomain } });

    if (existing) {
      existing.accessToken = accessToken;
      existing.scope = scope;
      existing.isActive = true;
      return this.shopRepository.save(existing);
    }

    const shop = this.shopRepository.create({ shopDomain, accessToken, scope });
    return this.shopRepository.save(shop);
  }

  async deactivate(shopDomain: string): Promise<void> {
    const shop = await this.shopRepository.findOne({ where: { shopDomain } });
    if (!shop) {
      this.logger.warn(`deactivate called for unknown shop: ${shopDomain}`);
      return; // no-op per spec
    }
    shop.isActive = false;
    await this.shopRepository.save(shop);
  }
}
