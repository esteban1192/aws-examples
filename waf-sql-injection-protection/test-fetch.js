async function testVulnerableEndpoint() {
  const response = await fetch('https://vindk0gyuh.execute-api.us-east-1.amazonaws.com/prod/vulnerable-endpoint', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ param: "' R 1=1 --" })
  });

  console.log("Status:", response.status);

  const data = await response.json();

  console.log("Response Data:", data);
}

testVulnerableEndpoint();
