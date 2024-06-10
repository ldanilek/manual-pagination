import os

from dotenv import load_dotenv

from convex import ConvexClient

load_dotenv(".env.local")
load_dotenv()

client = ConvexClient(os.getenv("VITE_CONVEX_URL"))

for word in open('/usr/share/dict/words'):
    client.mutation("words:insert", { "word": word.strip() })

