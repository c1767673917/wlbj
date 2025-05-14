// SiliconFlow API测试脚本
const https = require('https');

// 测试数据
const testInput = `广州仓提货：河南省漯河市临颍县繁阳路南侧经一路西侧 临颍县恒烨实业有限公司 时会丽 15839591235 必须提前一天电话预约仓库送货，装车货品需按口味码放整齐，混码装卸仓库拒收，送清香牛肉579箱，香辣味1321箱，大骨牛肉500箱，番茄牛肉600箱，报价@谭宏洁`;

// API配置
const apiKey = 'sk-mkwzawhynjmauuhvflpfjhfdijcvmutwswdtunhaoqnsvdos';
const apiUrl = 'api.siliconflow.cn';
const apiPath = '/v1/chat/completions';

// 准备请求数据
const requestData = JSON.stringify({
  model: 'Qwen/Qwen3-14B',
  messages: [
    {
      role: 'system',
      content: '你是一个物流信息提取专家。你需要从用户输入的文本中识别并提取以下信息：\n1. 发货仓库\n2. 货物信息(包括品名和数量)\n3. 收货信息(完整保留地址、联系人、电话、以及所有收货要求等)\n\n请以JSON格式返回结果，格式为{"warehouse": "提取的发货仓库", "goods": "提取的货物信息", "deliveryAddress": "提取的收货信息，包括完整地址、联系人、电话和所有收货要求，尽量保留原文"}'
    },
    {
      role: 'user',
      content: testInput
    }
  ],
  temperature: 0.2,
  enable_thinking: false  // Qwen3模型特有参数，关闭思考模式
});

// 设置请求选项
const options = {
  hostname: apiUrl,
  path: apiPath,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(requestData),
    'Authorization': `Bearer ${apiKey}`
  }
};

console.log('开始测试SiliconFlow API...');
console.log('请求URL:', `https://${apiUrl}${apiPath}`);
console.log('请求数据:', requestData);

// 发送请求
const req = https.request(options, (res) => {
  console.log('状态码:', res.statusCode);
  console.log('响应头:', res.headers);
  
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
    // 输出进度信息，让用户知道有数据在返回
    process.stdout.write('.');
  });
  
  res.on('end', () => {
    console.log('\n响应数据接收完成');
    try {
      const parsedData = JSON.parse(responseData);
      console.log('响应数据解析结果:');
      console.log(JSON.stringify(parsedData, null, 2));
      
      if (parsedData.choices && parsedData.choices.length > 0) {
        const content = parsedData.choices[0].message.content;
        console.log('\n提取的内容:', content);
        
        try {
          // 尝试从内容中提取JSON
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const extractedJson = JSON.parse(jsonMatch[0]);
            console.log('\n成功提取的JSON数据:');
            console.log(JSON.stringify(extractedJson, null, 2));
          } else {
            console.log('\n无法从内容中提取JSON格式的数据');
          }
        } catch (e) {
          console.error('\n提取JSON失败:', e.message);
        }
      }
    } catch (e) {
      console.error('\n解析响应失败:', e.message);
      console.log('原始响应数据:', responseData);
    }
  });
});

req.on('error', (e) => {
  console.error(`请求遇到问题: ${e.message}`);
});

// 写入数据到请求体
req.write(requestData);
req.end();

console.log('请求已发送，等待响应...');
console.log('(响应可能需要较长时间，请耐心等待)'); 