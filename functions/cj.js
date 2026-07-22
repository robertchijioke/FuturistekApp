const fetch = require("node-fetch");
const CJ_API_KEY = process.env.CJ_API_KEY;
const CJ_BASE_URL = "https://developers.cjdropshipping.com/api2.0/v1";

console.log("CJ_API_KEY EXISTS:", !!process.env.CJ_API_KEY);
console.log("CJ_API_KEY START:", process.env.CJ_API_KEY?.slice(0, 6));

async function cjRequest(endpoint, body = {}, accessToken = "") {
  const headers = {
    "Content-Type": "application/json",
  };

  if (accessToken) {
    headers["CJ-Access-Token"] = accessToken;
  }

  console.log("CJ KEY EXISTS:", !!CJ_API_KEY);
  console.log("CJ KEY START:", CJ_API_KEY?.slice(0, 6));

  const res = await fetch(`${CJ_BASE_URL}${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  return await res.json();
}

module.exports = { cjRequest };