from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from supabase import create_client, Client
import socket  # New import

app = FastAPI()

SUPABASE_URL = "https://hrusklvqncfkgyzoqiap.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhydXNsa3ZscW5jZmtneXpxaXFwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODU4NDMyNiwiZXhwIjoyMDg0MTYwMzI2fQ.CSV2V4NCe_OuoCEZwwXENjtd2w2J-q1Lkg7NVBojTOw"  # Use service_role as before
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

class RFIDRequest(BaseModel):
    rfid_id: str

@app.post("/check-payment")
async def check_payment(request: RFIDRequest):
    try:
        # Quick internet check
        socket.getaddrinfo("google.com", 80)  # Raises error if no DNS/internet
        
        response = supabase.table("products").select("is_paid").eq("rfid_id", request.rfid_id).execute()
        if response.data:
            return {"paid": response.data[0]["is_paid"]}
        else:
            return {"paid": True}
    except Exception as e:
        print(str(e))  # Log in terminal
        return {"paid": False}  # Fallback to deny if error (safer)