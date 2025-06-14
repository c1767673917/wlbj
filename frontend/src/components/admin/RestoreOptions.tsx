import React, { useState } from 'react';
import { Database, Settings, FileText, AlertTriangle, Shield } from 'lucide-react';

interface RestoreOptionsProps {
  onOptionsChange: (options: RestoreOptions) => void;
  disabled?: boolean;
}

export interface RestoreOptions {
  restoreDatabase: boolean;
  restoreConfigs: boolean;
  restoreLogs: boolean;
  createBackup: boolean;
  verifyIntegrity: boolean;
}

const RestoreOptionsComponent: React.FC<RestoreOptionsProps> = ({
  onOptionsChange,
  disabled = false
}) => {
  const [options, setOptions] = useState<RestoreOptions>({
    restoreDatabase: true,
    restoreConfigs: true,
    restoreLogs: false,
    createBackup: true,
    verifyIntegrity: true
  });

  const handleOptionChange = (key: keyof RestoreOptions, value: boolean) => {
    const newOptions = { ...options, [key]: value };
    setOptions(newOptions);
    onOptionsChange(newOptions);
  };

  const restoreItems = [
    {
      key: 'restoreDatabase' as keyof RestoreOptions,
      icon: Database,
      title: '恢复数据库',
      description: '恢复用户数据、订单信息、物流公司等核心数据',
      recommended: true,
      critical: true
    },
    {
      key: 'restoreConfigs' as keyof RestoreOptions,
      icon: Settings,
      title: '恢复配置文件',
      description: '恢复系统配置、认证设置、IP白名单等',
      recommended: true,
      critical: false
    },
    {
      key: 'restoreLogs' as keyof RestoreOptions,
      icon: FileText,
      title: '恢复日志文件',
      description: '恢复历史日志记录（可选）',
      recommended: false,
      critical: false
    }
  ];

  const safetyItems = [
    {
      key: 'createBackup' as keyof RestoreOptions,
      icon: Shield,
      title: '恢复前自动备份',
      description: '在恢复前自动创建当前数据的备份',
      recommended: true,
      critical: false
    },
    {
      key: 'verifyIntegrity' as keyof RestoreOptions,
      icon: AlertTriangle,
      title: '验证数据完整性',
      description: '恢复后验证数据库完整性和配置有效性',
      recommended: true,
      critical: false
    }
  ];

  return (
    <div className="space-y-6">
      {/* 恢复内容选择 */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">恢复内容</h3>
        <div className="space-y-3">
          {restoreItems.map((item) => {
            const Icon = item.icon;
            const isChecked = options[item.key];
            
            return (
              <div
                key={item.key}
                className={`
                  border rounded-lg p-4 transition-colors
                  ${isChecked ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}
                  ${disabled ? 'opacity-50' : ''}
                `}
              >
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => handleOptionChange(item.key, e.target.checked)}
                    disabled={disabled}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <Icon className={`w-5 h-5 ${isChecked ? 'text-blue-600' : 'text-gray-500'}`} />
                      <span className="font-medium text-gray-900">
                        {item.title}
                        {item.recommended && (
                          <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                            推荐
                          </span>
                        )}
                        {item.critical && (
                          <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                            重要
                          </span>
                        )}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {item.description}
                    </p>
                  </div>
                </label>
              </div>
            );
          })}
        </div>
      </div>

      {/* 安全选项 */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">安全选项</h3>
        <div className="space-y-3">
          {safetyItems.map((item) => {
            const Icon = item.icon;
            const isChecked = options[item.key];
            
            return (
              <div
                key={item.key}
                className={`
                  border rounded-lg p-4 transition-colors
                  ${isChecked ? 'border-green-500 bg-green-50' : 'border-gray-200'}
                  ${disabled ? 'opacity-50' : ''}
                `}
              >
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => handleOptionChange(item.key, e.target.checked)}
                    disabled={disabled}
                    className="mt-1 h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                  />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <Icon className={`w-5 h-5 ${isChecked ? 'text-green-600' : 'text-gray-500'}`} />
                      <span className="font-medium text-gray-900">
                        {item.title}
                        {item.recommended && (
                          <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                            推荐
                          </span>
                        )}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {item.description}
                    </p>
                  </div>
                </label>
              </div>
            );
          })}
        </div>
      </div>

      {/* 警告提示 */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-yellow-800">重要提示</h4>
            <ul className="text-sm text-yellow-700 mt-1 space-y-1">
              <li>• 恢复操作将覆盖现有数据，请确保已做好备份</li>
              <li>• 恢复过程中系统将暂时不可用</li>
              <li>• 建议在维护时间窗口内执行恢复操作</li>
              <li>• 恢复完成后需要重新登录系统</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 选择摘要 */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">恢复摘要</h4>
        <div className="text-sm text-gray-600 space-y-1">
          <p>将恢复以下内容：</p>
          <ul className="list-disc list-inside ml-2 space-y-1">
            {options.restoreDatabase && <li>数据库文件</li>}
            {options.restoreConfigs && <li>配置文件</li>}
            {options.restoreLogs && <li>日志文件</li>}
          </ul>
          {options.createBackup && (
            <p className="text-green-600">✓ 恢复前将自动创建当前数据备份</p>
          )}
          {options.verifyIntegrity && (
            <p className="text-blue-600">✓ 恢复后将验证数据完整性</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default RestoreOptionsComponent;
