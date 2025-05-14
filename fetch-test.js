// 使用node-fetch库测试SiliconFlow API
// 使用前需要先安装: npm install node-fetch

// 引入库
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// 测试数据
const testInput = `广州仓提货：河南省漯河市临颍县繁阳路南侧经一路西侧 临颍县恒烨实业有限公司 时会丽 15839591235 必须提前一天电话预约仓库送货，装车货品需按口味码放整齐，混码装卸仓库拒收，送清香牛肉579箱，香辣味1321箱，大骨牛肉500箱，番茄牛肉600箱，报价@谭宏洁`;

// API配置
const apiKey = 'sk-mkwzawhynjmauuhvflpfjhfdijcvmutwswdtunhaoqnsvdos';
const apiUrl = 'https://api.siliconflow.cn/v1/chat/completions';

// 主函数
async function testSiliconFlowAPI() {
  console.log('开始测试SiliconFlow API (使用node-fetch)...');
  console.log('API URL:', apiUrl);
  
  const requestData = {
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
  };
  
  console.log('请求数据:', JSON.stringify(requestData, null, 2));
  console.log('请求已发送，等待响应...');
  
  try {
    const startTime = Date.now();
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestData)
    });
    
    const endTime = Date.now();
    const timeElapsed = (endTime - startTime) / 1000;
    
    console.log(`响应状态码: ${response.status}`);
    console.log(`响应时间: ${timeElapsed.toFixed(2)}秒`);
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('API响应数据:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.choices && data.choices.length > 0) {
      const content = data.choices[0].message.content;
      console.log('\n提取的内容:');
      console.log(content);
      
      try {
        // 尝试从内容中提取JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const extractedJson = JSON.parse(jsonMatch[0]);
          console.log('\n成功提取的JSON数据:');
          console.log(JSON.stringify(extractedJson, null, 2));
          
          // 分析提取结果
          console.log('\n结果分析:');
          console.log(`发货仓库: ${extractedJson.warehouse || '未提取'}`);
          console.log(`货物信息: ${extractedJson.goods || '未提取'}`);
          console.log(`收货信息: ${extractedJson.deliveryAddress || '未提取'}`);
        } else {
          console.log('\n无法从内容中提取JSON格式的数据');
        }
      } catch (e) {
        console.error('\n提取JSON失败:', e.message);
      }
    }
  } catch (error) {
    console.error('请求出错:', error.message);
  }
}

// 执行测试
testSiliconFlowAPI(); 