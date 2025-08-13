# Ngrok Setup for Remote Access

## Quick Setup

1. **Download ngrok** (already included in repo):
   - Linux binary: `ngrok` (in repo root)
   - Archive: `ngrok.tgz`

2. **Sign up for free ngrok account**:
   - Go to: https://dashboard.ngrok.com/signup
   - Get your authtoken from: https://dashboard.ngrok.com/get-started/your-authtoken

3. **Configure ngrok**:
   ```bash
   ./ngrok config add-authtoken YOUR_AUTH_TOKEN
   ```

4. **Start local server**:
   ```bash
   python3 -m http.server 8080 --directory docs &
   ```

5. **Create tunnel**:
   ```bash
   ./ngrok http 8080
   ```

6. **Access from phone**:
   - Look for the URL like: `https://abc123.ngrok.io`
   - Open this URL on your phone!

## Alternative: Use existing ngrok binary

The repo includes:
- `ngrok` - Linux x64 binary (ready to use)
- `ngrok.tgz` - Archive file if needed

Just add your authtoken and run!