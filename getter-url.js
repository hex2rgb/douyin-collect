const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// 丹道.html
// 散聊.html
// 祖边神运传.html
// 西游记.html
const htmlFilePath = path.join(__dirname, '胄空行仙传.html');
const outputFilePath = path.join(__dirname, '胄空行仙传.json');

try {
  const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
  const $ = cheerio.load(htmlContent);

  const results = [];

  // 遍历每个 li 元素
  $('li.YGmRi0kR').each((index, element) => {
    const $li = $(element);

    // 提取 URL
    const url = $li.find('a[href]').attr('href')?.replace('//', '') || '';

    // 提取文本
    const text = $li.find('span.arnSiSbK span span span span').text().trim();

    if (url && text) {
      results.push({
        url: url,
        text: text
      });
    }
  });

  // 写入 JSON 文件
  fs.writeFileSync(outputFilePath, JSON.stringify(results, null, 2), 'utf8');

  console.log(`成功提取 ${results.length} 条数据并保存到 ${outputFilePath}`);

} catch (error) {
  console.error('处理文件时出错:', error);
}