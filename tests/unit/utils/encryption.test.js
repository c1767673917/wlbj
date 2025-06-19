/**
 * 加密工具测试
 */

const { describe, test, expect, beforeEach } = require('@jest/globals');

describe('Encryption Utils', () => {
  let encryptionUtils;

  beforeEach(() => {
    // 重新加载模块以确保清洁状态
    delete require.cache[require.resolve('../../../utils/encryption')];
    encryptionUtils = require('../../../utils/encryption');
  });

  describe('encrypt', () => {
    test('应该加密文本数据', () => {
      const plaintext = 'Hello, World!';
      const encrypted = encryptionUtils.encrypt(plaintext);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted.length).toBeGreaterThan(0);
    });

    test('应该为相同文本生成不同的加密结果', () => {
      const plaintext = 'Hello, World!';
      const encrypted1 = encryptionUtils.encrypt(plaintext);
      const encrypted2 = encryptionUtils.encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
    });

    test('应该处理空字符串', () => {
      const plaintext = '';
      const encrypted = encryptionUtils.encrypt(plaintext);

      expect(encrypted).toBeNull();
    });

    test('应该处理特殊字符', () => {
      const plaintext = '!@#$%^&*()_+{}|:"<>?[]\\;\',./ 中文测试';
      const encrypted = encryptionUtils.encrypt(plaintext);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(plaintext);
    });

    test('应该处理长文本', () => {
      const plaintext = 'A'.repeat(10000);
      const encrypted = encryptionUtils.encrypt(plaintext);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(plaintext);
    });
  });

  describe('decrypt', () => {
    test('应该解密加密的数据', () => {
      const plaintext = 'Hello, World!';
      const encrypted = encryptionUtils.encrypt(plaintext);
      const decrypted = encryptionUtils.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    test('应该处理空字符串的加密解密', () => {
      const plaintext = '';
      const encrypted = encryptionUtils.encrypt(plaintext);
      const decrypted = encryptionUtils.decrypt(encrypted);

      expect(decrypted).toBeNull();
    });

    test('应该处理特殊字符的加密解密', () => {
      const plaintext = '!@#$%^&*()_+{}|:"<>?[]\\;\',./ 中文测试';
      const encrypted = encryptionUtils.encrypt(plaintext);
      const decrypted = encryptionUtils.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    test('应该处理长文本的加密解密', () => {
      const plaintext = 'A'.repeat(10000);
      const encrypted = encryptionUtils.encrypt(plaintext);
      const decrypted = encryptionUtils.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    test('应该处理无效的加密数据', () => {
      const invalidEncrypted = 'invalid-encrypted-data';
      const result = encryptionUtils.decrypt(invalidEncrypted);

      // 根据实际实现，无效数据会返回原数据
      expect(result).toBe(invalidEncrypted);
    });

    test('应该处理格式错误的加密数据', () => {
      const malformedEncrypted = 'not:enough:parts';
      const result = encryptionUtils.decrypt(malformedEncrypted);

      // 根据实际实现，格式错误的数据会返回原数据
      expect(result).toBe(malformedEncrypted);
    });
  });

  describe('encryptSensitiveFields', () => {
    test('应该加密对象中的敏感字段', () => {
      const obj = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'secret123',
        publicInfo: 'not sensitive',
      };

      const sensitiveFields = ['email', 'password'];
      const encrypted = encryptionUtils.encryptSensitiveFields(obj, sensitiveFields);

      expect(encrypted).toBeDefined();
      expect(encrypted.username).toBe('testuser');
      expect(encrypted.publicInfo).toBe('not sensitive');
      expect(encrypted.email).not.toBe('test@example.com');
      expect(encrypted.password).not.toBe('secret123');
    });

    test('应该处理空对象', () => {
      const obj = {};
      const sensitiveFields = ['email', 'password'];
      const encrypted = encryptionUtils.encryptSensitiveFields(obj, sensitiveFields);

      expect(encrypted).toEqual(obj);
    });

    test('应该处理null值', () => {
      const obj = null;
      const sensitiveFields = ['email', 'password'];
      const encrypted = encryptionUtils.encryptSensitiveFields(obj, sensitiveFields);

      expect(encrypted).toBe(obj);
    });
  });

  describe('decryptSensitiveFields', () => {
    test('应该解密对象中的敏感字段', () => {
      const obj = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'secret123',
        publicInfo: 'not sensitive',
      };

      const sensitiveFields = ['email', 'password'];
      const encrypted = encryptionUtils.encryptSensitiveFields(obj, sensitiveFields);
      const decrypted = encryptionUtils.decryptSensitiveFields(encrypted, sensitiveFields);

      expect(decrypted).toEqual(obj);
    });

    test('应该处理空对象', () => {
      const obj = {};
      const sensitiveFields = ['email', 'password'];
      const decrypted = encryptionUtils.decryptSensitiveFields(obj, sensitiveFields);

      expect(decrypted).toEqual(obj);
    });

    test('应该处理null值', () => {
      const obj = null;
      const sensitiveFields = ['email', 'password'];
      const decrypted = encryptionUtils.decryptSensitiveFields(obj, sensitiveFields);

      expect(decrypted).toBe(obj);
    });
  });

  describe('generateEncryptionKey', () => {
    test('应该生成随机密钥', () => {
      const key = encryptionUtils.generateEncryptionKey();

      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
      expect(key.length).toBe(64); // 32字节 = 64个十六进制字符
    });

    test('应该生成唯一的密钥', () => {
      const key1 = encryptionUtils.generateEncryptionKey();
      const key2 = encryptionUtils.generateEncryptionKey();

      expect(key1).not.toBe(key2);
    });
  });

  describe('isEncrypted', () => {
    test('应该识别加密的数据', () => {
      const plaintext = 'Hello, World!';
      const encrypted = encryptionUtils.encrypt(plaintext);

      expect(encryptionUtils.isEncrypted(encrypted)).toBe(true);
    });

    test('应该识别未加密的数据', () => {
      const plaintext = 'Hello, World!';

      expect(encryptionUtils.isEncrypted(plaintext)).toBe(false);
    });

    test('应该处理空字符串', () => {
      expect(encryptionUtils.isEncrypted('')).toBe(false);
    });

    test('应该处理null值', () => {
      expect(encryptionUtils.isEncrypted(null)).toBe(false);
    });
  });
});
