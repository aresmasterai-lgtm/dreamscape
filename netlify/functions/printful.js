const fetch = require("node-fetch");

exports.handler = async function (event, context) {
  const PRINTFUL_API_KEY = process.env.PRINTFUL_API_KEY;

  if (!PRINTFUL_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Missing PRINTFUL_API_KEY environment variable" }),
    };
  }

  try {
    // Fetch all sync products from the store
    const response = await fetch("https://api.printful.com/store/products?limit=100", {
      headers: {
        Authorization: `Bearer ${PRINTFUL_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: "Printful API error", details: errorText }),
      };
    }

    const data = await response.json();

    // Return all products — no type filtering
    const products = (data.result || []).map((product) => ({
      id: product.id,
      name: product.name,
      thumbnail_url: product.thumbnail_url,
      variants: product.variants,
      synced: product.synced,
    }));

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ products }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Unexpected error", details: err.message }),
    };
  }
};
