import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Tabs } from '../ui/Tabs';
import FileUpload from '../ui/FileUpload';
import RestoreOptionsComponent, { RestoreOptions } from './RestoreOptions';
import {
  Cloud,
  Settings,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Database,
  Shield,
  AlertTriangle,
  RefreshCw,
  Upload,
  RotateCcw,
  Download
} from 'lucide-react';

interface BackupConfig {
  id: number;
  qiniu_access_key: string;
  qiniu_secret_key: string;
  qiniu_bucket: string;
  qiniu_zone: string;
  backup_frequency: string;
  auto_backup_enabled: boolean;
  last_backup_time: string | null;
  last_backup_status: string | null;
  last_backup_size: string | null;
  retention_days: number;
  wechat_webhook_url: string;
  notification_enabled: boolean;
}

interface BackupHistory {
  time: string;
  status: string;
  size: string | null;
}

const BackupManagement: React.FC = () => {
  const [config, setConfig] = useState<BackupConfig | null>(null);
  const [history, setHistory] = useState<BackupHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [activeTab, setActiveTab] = useState('config');

  // 恢复相关状态
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [restoreOptions, setRestoreOptions] = useState<RestoreOptions>({
    restoreDatabase: true,
    restoreConfigs: true,
    restoreLogs: false,
    createBackup: true,
    verifyIntegrity: true
  });
  const [restoring, setRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string>('');

  // 表单状态
  const [formData, setFormData] = useState({
    qiniu_access_key: '',
    qiniu_secret_key: '',
    qiniu_bucket: '',
    qiniu_zone: 'z0',
    backup_frequency: 'daily',
    auto_backup_enabled: false,
    retention_days: 30,
    wechat_webhook_url: '',
    notification_enabled: true
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // 加载备份配置
  const loadConfig = async () => {
    try {
      const response = await fetch('/api/backup/config');
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
        setFormData({
          qiniu_access_key: data.qiniu_access_key || '',
          qiniu_secret_key: data.qiniu_secret_key || '',
          qiniu_bucket: data.qiniu_bucket || '',
          qiniu_zone: data.qiniu_zone || 'z0',
          backup_frequency: data.backup_frequency || 'daily',
          auto_backup_enabled: data.auto_backup_enabled || false,
          retention_days: data.retention_days || 30,
          wechat_webhook_url: data.wechat_webhook_url || '',
          notification_enabled: data.notification_enabled !== false
        });
      }
    } catch (error) {
      console.error('加载备份配置失败:', error);
    }
  };

  // 加载备份历史
  const loadHistory = async () => {
    try {
      const response = await fetch('/api/backup/history');
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (error) {
      console.error('加载备份历史失败:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([loadConfig(), loadHistory()]);
      setLoading(false);
    };
    loadData();
  }, []);

  // 处理表单输入
  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // 验证表单
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.qiniu_access_key.trim()) {
      newErrors.qiniu_access_key = 'AccessKey不能为空';
    }

    if (!formData.qiniu_bucket.trim()) {
      newErrors.qiniu_bucket = '存储空间名称不能为空';
    }

    if (formData.retention_days < 1 || formData.retention_days > 365) {
      newErrors.retention_days = '保留天数必须在1-365之间';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 保存配置
  const saveConfig = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const response = await fetch('/api/backup/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await loadConfig();
        alert('备份配置保存成功！');
      } else {
        const error = await response.json();
        alert(`保存失败: ${error.error || '未知错误'}`);
      }
    } catch (error) {
      alert('保存失败，请检查网络连接');
    } finally {
      setSaving(false);
    }
  };

  // 测试连接
  const testConnection = async () => {
    setTesting(true);
    try {
      const response = await fetch('/api/backup/test-connection', {
        method: 'POST'
      });

      const result = await response.json();
      if (result.success) {
        alert('七牛云连接测试成功！');
      } else {
        alert(`连接测试失败: ${result.error}`);
      }
    } catch (error) {
      alert('测试失败，请检查网络连接');
    } finally {
      setTesting(false);
    }
  };

  // 执行备份
  const executeBackup = async () => {
    setExecuting(true);
    try {
      const response = await fetch('/api/backup/execute', {
        method: 'POST'
      });

      const result = await response.json();
      if (result.success !== false) {
        alert('备份任务已启动，请稍后查看结果');
        // 延迟刷新状态
        setTimeout(() => {
          loadConfig();
          loadHistory();
        }, 3000);
      } else {
        alert(`备份执行失败: ${result.error}`);
      }
    } catch (error) {
      alert('备份执行失败，请检查网络连接');
    } finally {
      setExecuting(false);
    }
  };

  // 处理文件选择
  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setUploadStatus('idle');
    setUploadError('');
  };

  // 移除选择的文件
  const handleFileRemove = () => {
    setSelectedFile(null);
    setUploadStatus('idle');
    setUploadError('');
    setUploadProgress(0);
  };

  // 上传并恢复备份文件
  const handleRestore = async () => {
    if (!selectedFile) {
      alert('请先选择备份文件');
      return;
    }

    // 安全警告对话框
    const confirmMessage = `⚠️ 重要安全提示\n\n为了避免服务中断和数据冲突，强烈建议使用安全恢复方法：\n\n1. 停止当前页面操作\n2. 在服务器终端执行以下命令：\n   node safe-restore.js <备份文件路径>\n\n该方法会：\n• 自动停止相关服务\n• 安全执行恢复操作\n• 自动重启服务\n• 验证恢复结果\n\n是否仍要继续在线恢复？（不推荐）`;

    if (!confirm(confirmMessage)) {
      return;
    }

    // 二次确认
    const secondConfirm = `最后确认：\n\n将恢复以下内容：\n${
      restoreOptions.restoreDatabase ? '• 数据库\n' : ''
    }${
      restoreOptions.restoreConfigs ? '• 配置文件\n' : ''
    }${
      restoreOptions.restoreLogs ? '• 日志文件\n' : ''
    }\n${
      restoreOptions.createBackup ? '恢复前将自动备份当前数据。\n' : ''
    }\n⚠️ 此操作可能导致服务不稳定！`;

    if (!confirm(secondConfirm)) {
      return;
    }

    setRestoring(true);
    setRestoreProgress(0);

    try {
      // 创建FormData
      const formData = new FormData();
      formData.append('backupFile', selectedFile);
      formData.append('options', JSON.stringify(restoreOptions));

      // 上传文件
      const response = await fetch('/api/backup/restore', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const result = await response.json();

        if (result.warning) {
          alert(`${result.message}\n\n${result.warning}\n\n推荐命令：${result.recommendation}`);
          setRestoring(false);
          setRestoreProgress(0);
          return;
        }

        alert('恢复操作已启动，请稍后查看结果');

        // 模拟进度更新
        const progressInterval = setInterval(() => {
          setRestoreProgress(prev => {
            if (prev >= 90) {
              clearInterval(progressInterval);
              return 90;
            }
            return prev + 10;
          });
        }, 1000);

        // 等待恢复完成
        setTimeout(() => {
          setRestoreProgress(100);
          setTimeout(() => {
            setRestoring(false);
            setRestoreProgress(0);
            handleFileRemove();
            loadConfig();
            loadHistory();
            alert('恢复操作完成！请重新登录系统。');
          }, 1000);
        }, 10000);

      } else {
        const error = await response.json();
        throw new Error(error.error || '恢复失败');
      }
    } catch (error) {
      setRestoring(false);
      setRestoreProgress(0);
      alert(`恢复失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 下载备份文件
  const downloadBackup = async () => {
    try {
      const response = await fetch('/api/backup/download', {
        method: 'GET'
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wlbj-backup-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.tar.gz`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const error = await response.json();
        alert(`下载失败: ${error.error || '未知错误'}`);
      }
    } catch (error) {
      alert('下载失败，请检查网络连接');
    }
  };

  // 格式化时间
  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '从未备份';
    return new Date(timeStr).toLocaleString('zh-CN');
  };

  // 获取状态图标
  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'running':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-2">加载中...</span>
      </div>
    );
  }

  const tabs = [
    { id: 'config', label: '备份配置', icon: Settings },
    { id: 'status', label: '备份状态', icon: Database },
    { id: 'history', label: '备份历史', icon: Clock },
    { id: 'restore', label: '数据恢复', icon: RotateCcw }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">备份管理</h2>
        <div className="flex space-x-2">
          <Button
            onClick={downloadBackup}
            disabled={!config?.qiniu_access_key}
            variant="outline"
          >
            <Download className="w-4 h-4 mr-2" />
            下载备份
          </Button>
          <Button
            onClick={testConnection}
            disabled={testing || !config?.qiniu_access_key}
            variant="outline"
          >
            {testing ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Shield className="w-4 h-4 mr-2" />}
            测试连接
          </Button>
          <Button
            onClick={executeBackup}
            disabled={executing || !config?.qiniu_access_key}
            variant="primary"
          >
            {executing ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            立即备份
          </Button>
        </div>
      </div>

      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {activeTab === 'config' && (
        <Card>
          <div className="p-6 space-y-6">
            <h3 className="text-lg font-semibold flex items-center">
              <Cloud className="w-5 h-5 mr-2" />
              七牛云配置
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  AccessKey *
                </label>
                <input
                  type="text"
                  value={formData.qiniu_access_key}
                  onChange={(e) => handleInputChange('qiniu_access_key', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md ${errors.qiniu_access_key ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="请输入七牛云AccessKey"
                />
                {errors.qiniu_access_key && (
                  <p className="text-red-500 text-sm mt-1">{errors.qiniu_access_key}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SecretKey *
                </label>
                <input
                  type="password"
                  value={formData.qiniu_secret_key}
                  onChange={(e) => handleInputChange('qiniu_secret_key', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="请输入七牛云SecretKey"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  存储空间名称 *
                </label>
                <input
                  type="text"
                  value={formData.qiniu_bucket}
                  onChange={(e) => handleInputChange('qiniu_bucket', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md ${errors.qiniu_bucket ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="请输入存储空间名称"
                />
                {errors.qiniu_bucket && (
                  <p className="text-red-500 text-sm mt-1">{errors.qiniu_bucket}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  存储区域
                </label>
                <select
                  value={formData.qiniu_zone}
                  onChange={(e) => handleInputChange('qiniu_zone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="z0">华东 (z0)</option>
                  <option value="z1">华北 (z1)</option>
                  <option value="z2">华南 (z2)</option>
                  <option value="na0">北美 (na0)</option>
                  <option value="as0">东南亚 (as0)</option>
                </select>
              </div>
            </div>

            <div className="border-t pt-6">
              <h4 className="text-md font-medium text-gray-900 mb-4">备份策略</h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    备份频率
                  </label>
                  <select
                    value={formData.backup_frequency}
                    onChange={(e) => handleInputChange('backup_frequency', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="hourly">每小时</option>
                    <option value="daily">每天</option>
                    <option value="weekly">每周</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    保留天数
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={formData.retention_days}
                    onChange={(e) => handleInputChange('retention_days', parseInt(e.target.value))}
                    className={`w-full px-3 py-2 border rounded-md ${errors.retention_days ? 'border-red-500' : 'border-gray-300'}`}
                  />
                  {errors.retention_days && (
                    <p className="text-red-500 text-sm mt-1">{errors.retention_days}</p>
                  )}
                </div>

                <div className="flex items-center space-x-4 pt-6">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.auto_backup_enabled}
                      onChange={(e) => handleInputChange('auto_backup_enabled', e.target.checked)}
                      className="mr-2"
                    />
                    启用自动备份
                  </label>
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <h4 className="text-md font-medium text-gray-900 mb-4">通知设置</h4>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    企业微信Webhook URL (可选)
                  </label>
                  <input
                    type="url"
                    value={formData.wechat_webhook_url}
                    onChange={(e) => handleInputChange('wechat_webhook_url', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
                  />
                </div>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.notification_enabled}
                    onChange={(e) => handleInputChange('notification_enabled', e.target.checked)}
                    className="mr-2"
                  />
                  启用备份通知
                </label>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={saveConfig}
                disabled={saving}
                variant="primary"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                保存配置
              </Button>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'status' && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">备份状态</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">最后备份时间</span>
                  {getStatusIcon(config?.last_backup_status)}
                </div>
                <p className="text-lg font-semibold mt-1">
                  {formatTime(config?.last_backup_time)}
                </p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">备份状态</span>
                </div>
                <p className="text-lg font-semibold mt-1">
                  {config?.last_backup_status === 'success' ? '成功' :
                   config?.last_backup_status === 'failed' ? '失败' :
                   config?.last_backup_status === 'running' ? '进行中' : '未知'}
                </p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">备份大小</span>
                </div>
                <p className="text-lg font-semibold mt-1">
                  {config?.last_backup_size || '未知'}
                </p>
              </div>
            </div>

            {!config?.qiniu_access_key && (
              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
                  <span className="text-yellow-800">请先配置七牛云参数才能使用备份功能</span>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {activeTab === 'history' && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">备份历史</h3>

            {history.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                暂无备份历史记录
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(item.status)}
                      <span>{formatTime(item.time)}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {item.size || '未知大小'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {activeTab === 'restore' && (
        <div className="space-y-6">
          {/* 安全恢复说明 */}
          <Card>
            <div className="p-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-start space-x-3">
                  <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-800">推荐：使用安全恢复方法</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      为避免服务中断，建议在服务器终端使用安全恢复脚本：
                    </p>
                    <div className="mt-2 bg-blue-100 rounded p-2 font-mono text-sm text-blue-800">
                      node safe-restore.js &lt;备份文件路径&gt;
                    </div>
                    <p className="text-xs text-blue-600 mt-2">
                      安全恢复会自动停止服务、执行恢复、重启服务并验证结果
                    </p>
                  </div>
                </div>
              </div>

              <h3 className="text-lg font-semibold mb-4">在线恢复（不推荐）</h3>
              <FileUpload
                onFileSelect={handleFileSelect}
                onFileRemove={handleFileRemove}
                accept=".tar.gz,.zip"
                maxSize={500}
                disabled={restoring}
                selectedFile={selectedFile}
                uploadProgress={uploadProgress}
                uploadStatus={uploadStatus}
                errorMessage={uploadError}
              />
            </div>
          </Card>

          {/* 恢复选项 */}
          {selectedFile && (
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">恢复选项</h3>
                <RestoreOptionsComponent
                  onOptionsChange={setRestoreOptions}
                  disabled={restoring}
                />
              </div>
            </Card>
          )}

          {/* 恢复进度 */}
          {restoring && (
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">恢复进度</h3>
                <div className="space-y-4">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>正在恢复数据...</span>
                    <span>{restoreProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-blue-500 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${restoreProgress}%` }}
                    />
                  </div>
                  <div className="text-sm text-gray-500">
                    {restoreProgress < 30 && '正在验证备份文件...'}
                    {restoreProgress >= 30 && restoreProgress < 60 && '正在恢复数据库...'}
                    {restoreProgress >= 60 && restoreProgress < 90 && '正在恢复配置文件...'}
                    {restoreProgress >= 90 && '正在验证数据完整性...'}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* 操作按钮 */}
          {selectedFile && !restoring && (
            <div className="flex justify-end space-x-3">
              <Button
                onClick={handleFileRemove}
                variant="outline"
              >
                取消
              </Button>
              <Button
                onClick={handleRestore}
                variant="primary"
                disabled={!selectedFile}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                开始恢复
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BackupManagement;
