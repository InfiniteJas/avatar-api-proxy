// server.js
const http = require('http');
const https = require('https');
const url = require('url');

const PORT = process.env.PORT || 3000;

// Helper function for making HTTP requests
function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const protocol = options.port === 443 ? https : http;
    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Parse URL
  const parsedUrl = url.parse(req.url, true);

  // Health check endpoint
  if (req.method === 'GET' && parsedUrl.pathname === '/') {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'Avatar API Proxy is running',
      endpoints: ['/api/assistant'],
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // Main API endpoint for Assistant function calls
  if (req.method === 'POST' && parsedUrl.pathname === '/api/assistant') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { function_name, arguments: args } = JSON.parse(body);
        
        console.log(`Function called: ${function_name}`);
        console.log(`Arguments:`, args);

        let apiUrl, model, question;

        // Route function calls to appropriate APIs
        switch (function_name) {
          case 'get_kazakhstan_law_info':
            apiUrl = 'https://nitec-ai.kz/api/chat/completions';
            model = 'qazaq_law_langchain_openai_local';
            question = args.user_question;
            break;
            
          case 'get_egov_service_info':
            apiUrl = 'https://nitec-ai.kz/api/chat/completions';
            model = 'eGov_v3_Ollama';
            question = args.service_question;
            break;
            
          default:
            res.writeHead(400);
            res.end(JSON.stringify({ 
              error: `Unknown function: ${function_name}`,
              success: false 
            }));
            return;
        }

        // Parse the external API URL
        const apiUrlParsed = url.parse(apiUrl);
        
        // Prepare request options
        const options = {
          hostname: apiUrlParsed.hostname,
          port: apiUrlParsed.port || 443,
          path: apiUrlParsed.path,
          method: 'POST',
          headers: {
            'Authorization': 'Bearer sk-196c1fe7e5be40b2b7b42bc235c49147',
            'Content-Type': 'application/json'
          }
        };

        // Prepare request body
        const requestBody = JSON.stringify({
          model: model,
          stream: false,
          messages: [{
            role: 'user',
            content: question
          }]
        });

        try {
          // Make request to external API
          const apiResponse = await makeRequest(options, requestBody);
          
          if (apiResponse.choices && apiResponse.choices[0]) {
            const answer = apiResponse.choices[0].message.content;
            
            res.writeHead(200);
            res.end(JSON.stringify({
              result: answer,
              function_name: function_name,
              success: true,
              timestamp: new Date().toISOString()
            }));
          } else {
            throw new Error('Invalid API response format');
          }

        } catch (apiError) {
          console.error('API Error:', apiError);
          res.writeHead(500);
          res.end(JSON.stringify({
            error: `API request failed: ${apiError.message}`,
            function_name: function_name,
            success: false
          }));
        }

      } catch (parseError) {
        console.error('Parse Error:', parseError);
        res.writeHead(400);
        res.end(JSON.stringify({
          error: `Request parsing failed: ${parseError.message}`,
          success: false
        }));
      }
    });
    
    return;
  }

  // 404 for other routes
  res.writeHead(404);
  res.end(JSON.stringify({
    error: 'Not Found',
    availableEndpoints: ['GET /', 'POST /api/assistant']
  }));
});

server.listen(PORT, () => {
  console.log(`Avatar API Proxy server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/`);
  console.log(`API endpoint: http://localhost:${PORT}/api/assistant`);
});
