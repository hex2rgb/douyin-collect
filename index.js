const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 全局捕获未处理的 Promise 拒绝
process.on('unhandledRejection', (reason, promise) => {
    console.error('未处理的 Promise 拒绝:', reason);
    // 可以选择在此处退出进程，或者进行其他错误处理
    // process.exit(1);
});

const sourceJson = "胄空行仙传.json";

// 日志：同时输出到控制台与文件（download.log），并带时间戳
const logFilePath = path.join(__dirname, 'download.log');
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
const originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error
};

function timeStamp() {
    return new Date().toISOString();
}

function serializeArg(arg) {
    if (typeof arg === 'string') return arg;
    try {
        return JSON.stringify(arg);
    } catch (_) {
        return String(arg);
    }
}

function writeLog(level, args) {
    const line = `[${timeStamp()}] [${level.toUpperCase()}] ` + args.map(serializeArg).join(' ') + '\n';
    logStream.write(line);
}

console.log = (...args) => { originalConsole.log(...args); writeLog('log', args); };
console.info = (...args) => { originalConsole.info(...args); writeLog('info', args); };
console.warn = (...args) => { originalConsole.warn(...args); writeLog('warn', args); };
console.error = (...args) => { originalConsole.error(...args); writeLog('error', args); };

process.on('exit', () => {
    try { logStream.end(); } catch (_) {}
});

// 读取 source.json 文件
function readSourceData() {
    try {
        const data = fs.readFileSync(sourceJson, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('读取 source.json 文件失败:', error);
        return [];
    }
}

// 清理文件名，移除非法字符
function sanitizeFileName(fileName) {
    return fileName.replace(/[<>:"/\\|?*]/g, '_').trim();
}

// 使用 Puppeteer 获取视频链接
async function getVideoUrl(browser, url) {
    const page = await browser.newPage();
    try {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1280, height: 720 });

        console.log('正在访问页面...');
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // 设置手机模式
        await page.setViewport({
            width: 375,
            height: 667,
            isMobile: true,
            hasTouch: true,
            deviceScaleFactor: 2
        });

        // 动态随机选择手机设备 - 避免每次都使用相同设备
        const mobileDevices = [
            'iPhone 12',
            'iPhone 12 Pro',
            'iPhone 13',
            'iPhone 13 Pro',
            'iPhone 14',
            'iPhone 14 Pro',
            'iPhone SE',
            'Galaxy S III',
            'Galaxy S5',
            'Galaxy Note 3',
            'Galaxy Note II',
            'JioPhone 2',
            'Pixel 5',
            'Pixel 4',
            'Pixel 3'
        ];

        const randomDevice = mobileDevices[Math.floor(Math.random() * mobileDevices.length)];
        console.log(`使用设备: ${randomDevice}`);
        await page.emulate(puppeteer.KnownDevices[randomDevice]);

        // 访问页面
        const fullUrl = pageUrl.startsWith('http') ? pageUrl : `https://${pageUrl}`;
        console.log(`正在访问页面: ${fullUrl}`);
        await page.goto(fullUrl, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // 随机等待时间，模拟真实用户行为
        const randomWait = Math.floor(Math.random() * 3000) + 2000; // 2-5秒随机等待
        console.log(`随机等待 ${randomWait}ms...`);
        await new Promise(resolve => setTimeout(resolve, randomWait));

        // 等待视频元素加载
        await page.waitForSelector('#video-player', { timeout: 10000 });

        // 获取视频链接和请求头信息
        const result = await page.evaluate(() => {
            const videoElement = document.querySelector('#video-player');
            if (videoElement) {
                return {
                    videoSrc: videoElement.src || videoElement.getAttribute('src'),
                    userAgent: navigator.userAgent
                };
            }
            return null;
        });

        if (!result) {
            // 尝试其他可能的选择器
            const alternativeResult = await page.evaluate(() => {
                const video = document.querySelector('video');
                if (video) {
                    return {
                        videoSrc: video.src || video.getAttribute('src'),
                        userAgent: navigator.userAgent
                    };
                }
                return null;
            });

            if (!alternativeResult) {
                throw new Error('未找到视频链接');
            }
            console.log(`找到视频链接(备用): ${alternativeResult.videoSrc}`);
            return alternativeResult;
        }

        console.log(`找到视频链接: ${result.videoSrc}`);
        return result;

    } catch (error) {
        console.log(error);
        console.error(`获取视频链接失败 (${pageUrl}):`, error.message);
        return null;
    } finally {
        await page.close();
    }
}

// 下载视频文件
async function downloadVideo(videoInfo, fileName) {
    try {
        console.log(`[downloadVideo] 开始下载视频: ${fileName}`);

        // 确保 videos 目录存在
        const videosDir = path.join(__dirname, 'videos');
        if (!fs.existsSync(videosDir)) {
            fs.mkdirSync(videosDir, { recursive: true });
            console.log('创建 videos 目录');
        }

        // 目标文件路径（存在则跳过）
        const sanitizedFileName = sanitizeFileName(fileName) + '.mp4';
        const filePath = path.join(videosDir, sanitizedFileName);
        if (fs.existsSync(filePath)) {
            console.log(`已存在，跳过下载: ${fileName}`);
            // 如果文件已存在，则跳过下载
            return null; // 返回 null 表示跳过下载
        }

        // 使用从页面获取的 User-Agent 和一致的请求头
        console.log(`[downloadVideo] 发送 axios 请求下载: ${videoInfo.videoSrc}`);
        const response = await axios({
            method: 'GET',
            url: videoInfo.videoSrc,
            responseType: 'stream',
            timeout: 60000, // 增加超时时间到 60 秒
            maxRedirects: 5,
            headers: {
                'User-Agent': videoInfo.userAgent, // 使用页面获取的真实 User-Agent
                'Referer': 'https://www.douyin.com/',
                'Accept': 'video/mp4,video/*,*/*',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Sec-Fetch-Dest': 'video',
                'Sec-Fetch-Mode': 'no-cors',
                'Sec-Fetch-Site': 'cross-site'
            }
        });

        const writer = fs.createWriteStream(filePath);
        console.log(`[downloadVideo] 开始管道传输数据到文件: ${filePath}`);

        let downloadedBytes = 0;
        const totalBytes = parseInt(response.headers['content-length'], 10);

        response.data.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            const percentage = totalBytes ? ((downloadedBytes / totalBytes) * 100).toFixed(2) : 'N/A';
            process.stdout.write(`下载进度: ${percentage}% (${(downloadedBytes / (1024 * 1024)).toFixed(2)}MB / ${(totalBytes / (1024 * 1024)).toFixed(2)}MB)\r`);
        });

        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                process.stdout.write('\n'); // 下载完成后换行
                console.log(`[downloadVideo] 视频下载完成: ${sanitizedFileName}`);
                resolve(filePath);
            });
            writer.on('error', (error) => {
                console.error(`[downloadVideo] 写入文件失败: ${error.message}`);
                reject(error);
            });
        });

    } catch (error) {
        console.error(`[downloadVideo] 下载视频失败 (${fileName}):`, error.message);
        return null;
    }
}

// 主函数
async function main() {
    console.log('脚本开始执行...');
    console.log('开始处理视频下载任务...');

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            timeout: 60000, // 增加启动超时时间到 60 秒
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--incognito',  // 无痕模式
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--single-process'
            ]
        });

        const sourceData = readSourceData();
        if (sourceData.length === 0) {
            console.log('没有找到要处理的视频数据');
            return;
        }

        console.log(`找到 ${sourceData.length} 个视频需要处理`);

        for (let i = 0; i < sourceData.length; i++) {
            const item = sourceData[i];
            console.log(`\n处理第 ${i + 1}/${sourceData.length} 个视频:`);
            console.log(`标题: ${item.text}`);
            console.log(`链接: ${item.url}`);

            try {
                // 获取视频链接和请求头信息
                const videoInfo = await getVideoUrl(browser, item.url); // 传递 browser 实例

                if (videoInfo && videoInfo.videoSrc) {
                    // 下载视频
                    const filePath = await downloadVideo(videoInfo, item.text);
                    if (filePath) {
                        console.log(`✅ 成功下载: ${path.basename(filePath)}`);
                    } else {
                        console.log(`✅ 已跳过下载: ${item.text}`); // 修改日志信息
                    }
                } else {
                    console.log(`❌ 获取视频链接失败: ${item.text}`);
                }

                // 随机延迟避免请求过于频繁，模拟真实用户行为
                if (i < sourceData.length - 1) {
                    const randomDelay = Math.floor(Math.random() * 5000) + 30000; // 3-8秒随机延迟
                    console.log(`随机等待 ${randomDelay}ms 后处理下一个视频...`);
                    await new Promise(resolve => setTimeout(resolve, randomDelay));
                }

            } catch (error) {
                console.error(`处理视频时出错 (${item.text}):`, error.message);
            }
        }

        console.log('\n所有视频处理完成！');
    } catch (error) {
        console.error('脚本运行失败:', error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// 运行主函数
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    readSourceData,
    getVideoUrl,
    downloadVideo,
    main
};
