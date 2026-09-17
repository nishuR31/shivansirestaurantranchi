import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_STORAGE_BUCKET } from "./src/core/config/envConfig";

async function testSupabase() {
  console.log("Testing Supabase connection...");
  console.log(`URL: ${SUPABASE_URL}`);
  console.log(`Bucket: ${SUPABASE_STORAGE_BUCKET}`);
  
  if (!SUPABASE_URL) {
    console.error("SUPABASE_URL is empty");
    return;
  }

  try {
    // Attempt to fetch the Supabase health endpoint or just a GET request to the URL
    console.log("Attempting to connect to:", SUPABASE_URL);
    const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      method: "GET",
      headers: {
        "apikey": SUPABASE_ANON_KEY || ""
      }
    });
    
    console.log("Response status:", res.status);
    console.log("Response text:", await res.text());
  } catch (error) {
    console.error("Connection failed with error:");
    console.error(error);
  }
}

testSupabase();
