import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShopsService } from './shops.service';
import { Shop } from './shop.entity';

type MockRepository = jest.Mocked<Pick<Repository<Shop>, 'findOne' | 'findOneOrFail' | 'upsert' | 'save'>>;

function makeMockRepo(): MockRepository {
  return {
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    upsert: jest.fn(),
    save: jest.fn(),
  };
}

describe('ShopsService', () => {
  let service: ShopsService;
  let repo: MockRepository;

  beforeEach(async () => {
    repo = makeMockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShopsService,
        {
          provide: getRepositoryToken(Shop),
          useValue: repo,
        },
      ],
    }).compile();

    service = module.get(ShopsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('registerShop', () => {
    it('should upsert the shop and return it', async () => {
      const saved = { shopDomain: 'new-shop.myshopify.com', accessToken: 'tok1', scope: 'read_orders', isActive: true } as Shop;

      (repo.upsert as jest.Mock).mockResolvedValue(undefined);
      repo.findOneOrFail.mockResolvedValue(saved);

      const result = await service.registerShop('new-shop.myshopify.com', 'tok1', 'read_orders');

      expect(repo.upsert).toHaveBeenCalledWith(
        { shopDomain: 'new-shop.myshopify.com', accessToken: 'tok1', scope: 'read_orders', isActive: true },
        { conflictPaths: ['shopDomain'] },
      );
      expect(repo.findOneOrFail).toHaveBeenCalledWith({ where: { shopDomain: 'new-shop.myshopify.com' } });
      expect(result).toBe(saved);
    });

    it('should propagate DB errors', async () => {
      (repo.upsert as jest.Mock).mockRejectedValue(new Error('DB connection lost'));

      await expect(service.registerShop('shop.myshopify.com', 'tok', 'scope')).rejects.toThrow('DB connection lost');
    });
  });

  describe('deactivate', () => {
    it('should set isActive to false on an existing shop', async () => {
      const shop = { shopDomain: 'active.myshopify.com', isActive: true } as Shop;

      repo.findOne.mockResolvedValue(shop);
      repo.save.mockResolvedValue({ ...shop, isActive: false } as Shop);

      await service.deactivate('active.myshopify.com');

      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
    });

    it('should be a no-op when the shop does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.deactivate('unknown.myshopify.com')).resolves.toBeUndefined();
      expect(repo.save).not.toHaveBeenCalled();
    });
  });
});
