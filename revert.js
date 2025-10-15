const fs = require('fs');
const path = require('path');

// 文件路径
const filePath = path.join(__dirname, 'source.revert.json');

try {
  // 读取JSON文件
  const data = fs.readFileSync(filePath, 'utf8');

  // 解析JSON数据
  const jsonArray = JSON.parse(data);

  // 检查是否是数组
  if (!Array.isArray(jsonArray)) {
    throw new Error('JSON文件内容不是数组格式');
  }

  // 将数组倒序
  const reversedArray = jsonArray.reverse();

  // 将倒序后的数组写回文件
  fs.writeFileSync(filePath, JSON.stringify(reversedArray, null, 2));

  console.log('数组倒序完成！');
  console.log(`原数组长度: ${jsonArray.length}, 倒序后长度: ${reversedArray.length}`);

} catch (error) {
  console.error('处理文件时出错:', error.message);
}