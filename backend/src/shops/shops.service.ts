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
    await this.shopRepository.upsert(
      { shopDomain, accessToken, scope, isActive: true },
      { conflictPaths: ['shopDomain'] },
    );
    return this.shopRepository.findOneOrFail({ where: { shopDomain } });
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
