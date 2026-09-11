import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
load_dotenv("../backend/.env")
load_dotenv("../.env")

NEXT_PUBLIC_SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

supabase = create_client(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_KEY)

def setup_user_profiles():
    print("Checking 'user_profiles' table in Supabase...")
    try:
        res = supabase.from_("user_profiles").select("*").limit(1).execute()
        print("✅ 'user_profiles' table accessible.")
    except Exception as e:
        print(f"Table check notice: {e}")

    # Seed existing signups
    try:
        signups_res = supabase.from_("signups").select("*").execute()
        existing_signups = signups_res.data or []
        print(f"Found {len(existing_signups)} existing signup users to calibrate/seed.")

        for u in existing_signups:
            email = u.get("email")
            if not email:
                continue
            
            prof_check = supabase.from_("user_profiles").select("id").eq("email", email).execute()
            if not prof_check.data or len(prof_check.data) == 0:
                new_prof = {
                    "email": email,
                    "user_id": str(u.get("id", email)),
                    "full_name": email.split("@")[0].replace(".", " ").title(),
                    "role": u.get("role") or "Policy Researcher / Legal",
                    "primary_domain": "Banking, Finance & Tax",
                    "subscribed_authorities": ["Reserve Bank of India (RBI)", "Central Board of Direct Taxes (CBDT)", "Ministry of Finance"],
                    "onboarding_completed": True
                }
                supabase.from_("user_profiles").insert(new_prof).execute()
                print(f"✅ Seeded default profile for existing user: {email}")
            else:
                print(f"⏩ User profile already exists for: {email}")

        # Seed a default anonymous / demo user
        demo_check = supabase.from_("user_profiles").select("id").eq("email", "demo@pramaan.gov.in").execute()
        if not demo_check.data or len(demo_check.data) == 0:
            supabase.from_("user_profiles").insert({
                "email": "demo@pramaan.gov.in",
                "user_id": "demo-user-default",
                "full_name": "Senior Policy Officer",
                "role": "Chief Compliance Officer (CCO)",
                "primary_domain": "Banking, Finance & Tax",
                "subscribed_authorities": ["Reserve Bank of India (RBI)", "Securities and Exchange Board of India (SEBI)", "Ministry of Finance"],
                "onboarding_completed": True
            }).execute()
            print("✅ Seeded default demo user profile.")

    except Exception as e:
        print(f"Notice during seeding: {e}")

if __name__ == "__main__":
    setup_user_profiles()
