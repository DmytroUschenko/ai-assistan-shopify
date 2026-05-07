import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { LokteService } from './lokte.service';
import { ConfigRegistryService } from '../config-registry/config-registry.service';

const mockConfigGet = jest.fn();
const mockConfigGetDecrypted = jest.fn();

const mockConfigRegistry = {
  get: mockConfigGet,
  getDecrypted: mockConfigGetDecrypted,
} as unknown as ConfigRegistryService;

function makeSut() {
  return new LokteService(mockConfigRegistry);
}

function setupHappyConfig() {
  mockConfigGet.mockImplementation((_shopId: string, path: string) => {
    if (path === 'lokte.general.enable') return Promise.resolve(1);
    if (path === 'lokte.general.user_id') return Promise.resolve('238');
    return Promise.resolve(undefined);
  });
  mockConfigGetDecrypted.mockResolvedValue('test-token');
}

describe('LokteService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('askQuestion — config guards', () => {
    it('throws ServiceUnavailableException when lokte is disabled', async () => {
      mockConfigGet.mockResolvedValue(0);
      mockConfigGetDecrypted.mockResolvedValue('');

      const sut = makeSut();
      await expect(sut.askQuestion('shop.myshopify.com', 'hello')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('throws ServiceUnavailableException when api_key is empty', async () => {
      mockConfigGet.mockImplementation((_shopId: string, path: string) =>
        Promise.resolve(path === 'lokte.general.enable' ? 1 : undefined),
      );
      mockConfigGetDecrypted.mockResolvedValue('');

      const sut = makeSut();
      await expect(sut.askQuestion('shop.myshopify.com', 'hello')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('throws ServiceUnavailableException when user_id is empty', async () => {
      mockConfigGet.mockImplementation((_shopId: string, path: string) => {
        if (path === 'lokte.general.enable') return Promise.resolve(1);
        return Promise.resolve('');
      });
      mockConfigGetDecrypted.mockResolvedValue('token');

      const sut = makeSut();
      await expect(sut.askQuestion('shop.myshopify.com', 'hello')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('askQuestion — Lokte API calls', () => {
    beforeEach(() => setupHappyConfig());

    it('returns answer text on success', async () => {
      const mockFetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'sess-1' }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ answer: 'The answer is 42' }),
        } as unknown as Response);

      global.fetch = mockFetch;

      const sut = makeSut();
      const result = await sut.askQuestion('shop.myshopify.com', 'What is the answer?');
      expect(result).toBe('The answer is 42');
    });

    it('joins answer_pieces when answer field is absent', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'sess-2' }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ answer_pieces: ['Hello', ' ', 'world'] }),
        } as unknown as Response);

      const sut = makeSut();
      const result = await sut.askQuestion('shop.myshopify.com', 'Hi?');
      expect(result).toBe('Hello world');
    });

    it('throws BadGatewayException when create-chat-session returns non-ok status', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as unknown as Response);

      const sut = makeSut();
      await expect(sut.askQuestion('shop.myshopify.com', 'hello')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('throws BadGatewayException when send-message returns non-ok status', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'sess-3' }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        } as unknown as Response);

      const sut = makeSut();
      await expect(sut.askQuestion('shop.myshopify.com', 'hello')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('throws BadGatewayException when create-chat-session throws a network error', async () => {
      global.fetch = jest.fn().mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const sut = makeSut();
      await expect(sut.askQuestion('shop.myshopify.com', 'hello')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('throws BadGatewayException when create-chat-session returns no session id', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      } as unknown as Response);

      const sut = makeSut();
      await expect(sut.askQuestion('shop.myshopify.com', 'hello')).rejects.toThrow(
        BadGatewayException,
      );
    });
  });
});
