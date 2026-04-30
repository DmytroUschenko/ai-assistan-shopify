import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CoreConfig } from './core-config.entity';
import { ConfigRegistryService } from './config-registry.service';
import { ConfigNamespaceMeta } from './config-meta.types';

const SHOP_ID = 'shop_1';

const mockRepo = () => ({
  find: jest.fn(),
  upsert: jest.fn(),
});

describe('ConfigRegistryService', () => {
  let service: ConfigRegistryService;
  let repo: jest.Mocked<Pick<Repository<CoreConfig>, 'find' | 'upsert'>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigRegistryService,
        { provide: getRepositoryToken(CoreConfig), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get(ConfigRegistryService);
    repo = module.get(getRepositoryToken(CoreConfig));
  });

  afterEach(() => jest.clearAllMocks());

  describe('register', () => {
    it('stores default config under the given namespace', () => {
      service.register('order', { export: { enabled: true } });
      // Verify by get() returning the default (no DB overrides)
      (repo.find as jest.Mock).mockResolvedValue([]);
      return expect(service.get(SHOP_ID, 'order.export.enabled')).resolves.toBe(true);
    });
  });

  describe('get', () => {
    beforeEach(() => {
      service.register('order', {
        export: { enabled: true, format: 'csv' },
        sync: { enabled: false },
      });
    });

    it('returns the default when no DB overrides exist', async () => {
      (repo.find as jest.Mock).mockResolvedValue([]);
      await expect(service.get(SHOP_ID, 'order.export.format')).resolves.toBe('csv');
    });

    it('returns the DB override when one exists', async () => {
      (repo.find as jest.Mock).mockResolvedValue([
        { shopId: SHOP_ID, path: 'order.export.enabled', value: false },
      ]);
      await expect(service.get(SHOP_ID, 'order.export.enabled')).resolves.toBe(false);
    });

    it('DB override does not clobber sibling defaults', async () => {
      (repo.find as jest.Mock).mockResolvedValue([
        { shopId: SHOP_ID, path: 'order.export.enabled', value: false },
      ]);
      await expect(service.get(SHOP_ID, 'order.export.format')).resolves.toBe('csv');
    });

    it('returns undefined for an unknown path', async () => {
      (repo.find as jest.Mock).mockResolvedValue([]);
      await expect(service.get(SHOP_ID, 'order.missing.key')).resolves.toBeUndefined();
    });
  });

  describe('set', () => {
    it('calls upsert with correct arguments', async () => {
      (repo.upsert as jest.Mock).mockResolvedValue(undefined);
      await service.set(SHOP_ID, 'order.export.enabled', false);
      expect(repo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ shopId: SHOP_ID, path: 'order.export.enabled', value: false }),
        ['shopId', 'path'],
      );
    });
  });

  describe('getModuleConfig', () => {
    beforeEach(() => {
      service.register('order', {
        export: { enabled: true, format: 'csv' },
        sync: { enabled: false },
      });
    });

    it('returns merged config for the namespace (without wrapper key)', async () => {
      (repo.find as jest.Mock).mockResolvedValue([
        { shopId: SHOP_ID, path: 'order.sync.enabled', value: true },
      ]);
      const config = await service.getModuleConfig(SHOP_ID, 'order');
      expect(config).toEqual({
        export: { enabled: true, format: 'csv' },
        sync: { enabled: true },
      });
    });

    it('returns defaults when no DB overrides exist', async () => {
      (repo.find as jest.Mock).mockResolvedValue([]);
      const config = await service.getModuleConfig(SHOP_ID, 'order');
      expect(config).toEqual({
        export: { enabled: true, format: 'csv' },
        sync: { enabled: false },
      });
    });

    it('returns empty object for unknown namespace', async () => {
      (repo.find as jest.Mock).mockResolvedValue([]);
      await expect(service.getModuleConfig(SHOP_ID, 'unknown')).resolves.toEqual({});
    });
  });

  describe('getAllConfig', () => {
    it('aggregates all registered namespaces', async () => {
      service.register('order', { export: { enabled: true } });
      service.register('customers', { import: { enabled: false } });
      (repo.find as jest.Mock).mockResolvedValue([]);

      const all = await service.getAllConfig(SHOP_ID);
      expect(all).toHaveProperty('order');
      expect(all).toHaveProperty('customers');
    });
  });

  describe('getNamespaceMeta', () => {
    const meta: ConfigNamespaceMeta = {
      moduleLabel: 'Order',
      fields: {
        'general.enabled': {
          groupLabel: 'General',
          keyLabel: 'Enabled',
          fieldType: 'select',
          options: [
            { label: 'Yes', value: true },
            { label: 'No', value: false },
          ],
        },
      },
    };

    it('returns meta registered for a namespace', () => {
      service.register('order', { general: { enabled: true } }, meta);
      expect(service.getNamespaceMeta('order')).toEqual(meta);
    });

    it('returns undefined for a namespace without meta', () => {
      service.register('order', { general: { enabled: true } });
      expect(service.getNamespaceMeta('order')).toBeUndefined();
    });

    it('returns a defensive copy (mutation does not affect registry)', () => {
      service.register('order', { general: { enabled: true } }, meta);
      const copy = service.getNamespaceMeta('order')!;
      copy.moduleLabel = 'Mutated';
      expect(service.getNamespaceMeta('order')!.moduleLabel).toBe('Order');
    });
  });

  describe('getAllMeta', () => {
    it('returns meta for all namespaces that have meta registered', () => {
      const orderMeta: ConfigNamespaceMeta = {
        moduleLabel: 'Order',
        fields: {
          'general.enabled': {
            groupLabel: 'General',
            keyLabel: 'Enabled',
            fieldType: 'select',
            options: [{ label: 'Yes', value: true }, { label: 'No', value: false }],
          },
        },
      };
      service.register('order', { general: { enabled: true } }, orderMeta);
      service.register('customers', { import: { enabled: false } }); // no meta

      const all = service.getAllMeta();
      expect(all).toHaveProperty('order');
      expect(all).not.toHaveProperty('customers');
      expect(all['order'].moduleLabel).toBe('Order');
    });

    it('returns empty object when no namespaces have meta', () => {
      expect(service.getAllMeta()).toEqual({});
    });
  });
});
