const apiKey = "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";

async function testOpenRouter() {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      models: [
        'google/gemma-4-31b-it:free',
        'meta-llama/llama-3.1-8b-instruct:free',
        'mistralai/mistral-7b-instruct:free'
      ],
      messages: [{ role: 'user', content: 'test' }]
    })
  });
  const data = await response.json();
  console.log("Status:", response.status);
  console.log(JSON.stringify(data, null, 2));
}

testOpenRouter();
