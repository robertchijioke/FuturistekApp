
const CJ_API_KEY = process.env.CJ_API_KEY || "YOUR_API_KEY_HERE";

const CJ_BASE_URL = "https://developers.cjdropshipping.com/api2.0/v1";

export async function cjRequest(endpoint: string, body: any = {}) {
  const res = await fetch(`${CJ_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "CJ-Access-Token": CJ_API_KEY,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return data;
}

async function testCJ() {
  const res = await cjRequest("/authentication/getAccessToken");
  console.log(res);
}

testCJ();