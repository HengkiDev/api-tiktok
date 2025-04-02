// File: index.js
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));

// Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Home route
app.get('/', (req, res) => {
  res.json({
    status: true,
    creator: "Your Name",
    message: "SnaptikPro TikTok Downloader API",
    endpoints: {
      tiktok: "/api/tiktok?url=https://www.tiktok.com/@username/video/1234567890123456789"
    }
  });
});

// TikTok Downloader API using SnaptikPro
app.get('/api/tiktok', async (req, res) => {
  const tiktokUrl = req.query.url;
  
  if (!tiktokUrl) {
    return res.status(400).json({
      status: false,
      message: 'URL parameter is required'
    });
  }

  try {
    // Validate TikTok URL
    if (!tiktokUrl.match(/^https?:\/\/(www\.|vm\.)?tiktok\.com\/.+/)) {
      return res.status(400).json({
        status: false,
        message: 'Invalid TikTok URL'
      });
    }

    // First, get the token by fetching the main page
    const mainPageResponse = await axios.get('https://pro.snaptik.app/en', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://pro.snaptik.app/en',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0'
      }
    });

    const $ = cheerio.load(mainPageResponse.data);
    const token = $('input[name="token"]').attr('value');
    
    if (!token) {
      throw new Error('Failed to extract token from SnaptikPro');
    }

    // Now send the actual request to download the video
    const formData = new URLSearchParams();
    formData.append('url', tiktokUrl);
    formData.append('token', token);
    
    const response = await axios.post('https://pro.snaptik.app/action.php', formData, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.5',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': 'https://pro.snaptik.app',
        'Referer': 'https://pro.snaptik.app/en',
        'Connection': 'keep-alive'
      }
    });

    if (response.data) {
      const $download = cheerio.load(response.data);
      
      // Extract video information
      const videoInfo = {
        author: {
          name: $download('.metadata .user-info a.user-name').text().trim() || null,
          avatar: $download('.metadata .user-info img.profile-pic').attr('src') || null,
        },
        title: $download('.video-info a.link-video').text().trim() || null,
      };
      
      // Extract download links
      const downloadLinks = [];
      $download('.snapbutton').each((index, element) => {
        const buttonText = $download(element).text().trim();
        const downloadLink = $download(element).attr('href');
        
        if (downloadLink && !downloadLink.includes('javascript:void')) {
          downloadLinks.push({
            type: buttonText.includes('watermark') ? 'with_watermark' : 'no_watermark',
            url: downloadLink
          });
        }
      });
      
      const musicLink = $download('a.music-link').attr('href') || null;
      
      if (downloadLinks.length === 0) {
        throw new Error('No download links found');
      }
      
      // Format downloadLinks into a nicer structure
      const videos = {};
      downloadLinks.forEach(link => {
        videos[link.type] = link.url;
      });
      
      return res.json({
        status: true,
        creator: "Your Name",
        data: {
          id: tiktokUrl.split('/').pop() || null,
          title: videoInfo.title,
          author: videoInfo.author,
          video: videos,
          music: musicLink
        }
      });
    } else {
      throw new Error('Failed to fetch video data from SnaptikPro');
    }
  } catch (error) {
    console.error('Error:', error.message);
    return res.status(500).json({
      status: false,
      message: 'Failed to fetch TikTok video data',
      error: error.message
    });
  }
});

// Backup route using alternative method if the main one fails
app.get('/api/tiktok/backup', async (req, res) => {
  const tiktokUrl = req.query.url;
  
  if (!tiktokUrl) {
    return res.status(400).json({
      status: false,
      message: 'URL parameter is required'
    });
  }

  try {
    // Simple backup method using a different service
    const response = await axios.get('https://api.snaptik.app/GetVideoInfo', {
      params: {
        key: 'your-backup-service-key', // You might need to get a key from the service
        url: tiktokUrl
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
      }
    });

    if (response.data && response.data.status === 'success') {
      return res.json({
        status: true,
        creator: "Your Name",
        data: {
          id: response.data.data.id || null,
          title: response.data.data.title || null,
          author: {
            name: response.data.data.author.name || null,
            avatar: response.data.data.author.avatar || null
          },
          video: {
            no_watermark: response.data.data.play || null,
            with_watermark: response.data.data.wmplay || null
          },
          music: response.data.data.music || null
        }
      });
    } else {
      throw new Error('Backup service failed to fetch video data');
    }
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: 'All methods failed to fetch TikTok video data',
      error: error.message
    });
  }
});

// 404 middleware
app.use((req, res) => {
  res.status(404).json({
    status: false,
    message: 'Endpoint Not Found'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    status: false,
    message: 'Internal Server Error',
    error: err.message
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
