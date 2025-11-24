# Combat MMO - Free Multiplayer Game Server

A real-time multiplayer RPG with 6 character classes, PvP combat, and PvE monsters.

## Features

- **6 Character Classes**: Ranger, Ice Mage, Fire Mage, Rogue, Monk, Warrior
- **Real-time PvP**: Toggle-able player vs player combat
- **PvE Combat**: Fight goblins, orcs, and other monsters
- **Synchronized Mobs**: Server-authoritative mob AI
- **Chat System**: Press Enter to chat with other players
- **Free to Host**: Works with free hosting providers

## Quick Start (Local Testing)

```bash
# Install dependencies
npm install

# Start the server
npm start

# Open http://localhost:3000 in your browser
```

## FREE Hosting Options

### Option 1: Glitch.com (RECOMMENDED - Completely Free)

1. Go to [glitch.com](https://glitch.com) and sign up
2. Click "New Project" → "Import from GitHub"
3. Or create a new project and upload these files:
   - `server.js`
   - `package.json`
   - `public/` folder with all files

4. Your server URL will be: `https://your-project-name.glitch.me`

5. **Update the game**: Edit `public/game.html` and change:
   ```javascript
   window.MMO_SERVER_URL = 'https://your-project-name.glitch.me';
   ```

**Glitch Pros:**
- Completely free forever
- Auto-restarts on crash
- Easy to edit online
- Instant deploy

**Glitch Cons:**
- Sleeps after 5 minutes of inactivity (wakes up on request)
- 4000 hours/month free tier

---

### Option 2: Render.com (Free Tier)

1. Go to [render.com](https://render.com) and sign up
2. Click "New" → "Web Service"
3. Connect your GitHub repo or upload files
4. Settings:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free

5. Your URL will be: `https://your-service.onrender.com`

**Render Pros:**
- More reliable than Glitch
- Auto-deploy from GitHub
- 750 free hours/month

**Render Cons:**
- Spins down after 15 minutes of inactivity
- May take 30-60 seconds to wake up

---

### Option 3: Railway.app ($5 Free Credit)

1. Go to [railway.app](https://railway.app) and sign up
2. Click "New Project" → "Deploy from GitHub"
3. Select your repository
4. Railway auto-detects Node.js

5. Your URL will be: `https://your-app.up.railway.app`

**Railway Pros:**
- Fast and reliable
- Easy setup
- $5 free credit (lasts ~1-2 months for small games)

**Railway Cons:**
- Credit runs out eventually
- Requires payment after free tier

---

### Option 4: Cyclic.sh (Free Tier)

1. Go to [cyclic.sh](https://cyclic.sh)
2. Connect GitHub and deploy
3. Instant deployment with custom URL

---

## Deployment Checklist

1. ✅ Upload server files (server.js, package.json, public/)
2. ✅ Note your server URL (e.g., `https://my-game.glitch.me`)
3. ✅ Edit `public/game.html`:
   ```javascript
   window.MMO_SERVER_URL = 'https://YOUR-SERVER-URL-HERE';
   ```
4. ✅ Test by opening your server URL in a browser
5. ✅ Share the URL with friends!

## File Structure

```
mmo-server/
├── server.js           # Main server code
├── package.json        # Dependencies
├── README.md           # This file
└── public/
    ├── index.html      # Landing page
    ├── game.html       # The game (MMO-enabled)
    └── mmo-client.js   # Networking module (optional, inline version in game.html)
```

## Server API Endpoints

- `GET /` - Landing page
- `GET /game.html` - The game
- `GET /health` - Server health check (JSON)
- `GET /stats` - Player statistics (JSON)

## Socket Events

### Client → Server
- `join` - Join the game with name and class
- `move` - Send position update
- `ability` - Use an ability
- `projectile` - Spawn a projectile
- `damageMob` - Deal damage to a mob
- `damagePlayer` - Deal PvP damage
- `chat` - Send chat message
- `togglePvP` - Toggle PvP mode

### Server → Client
- `joined` - Successfully joined
- `playerJoined` - Another player joined
- `playerLeft` - Player disconnected
- `playerMoved` - Player position update
- `mobSync` - Mob positions (10x/sec)
- `mobDied` - Mob was killed
- `mobRespawned` - Mob respawned
- `chatMessage` - Chat message received
- `takeDamage` - You took damage

## Configuration

### Server Settings (server.js)
```javascript
const TICK_RATE = 20;        // Server updates per second
const WORLD_WIDTH = 8000;    // World size
const WORLD_HEIGHT = 9000;
```

### Client Settings (game.html)
```javascript
window.MMO_SERVER_URL = 'http://localhost:3000';  // Change this!
const MMO_UPDATE_INTERVAL = 50;  // Client updates (ms)
```

## Troubleshooting

### "Offline Mode" appearing
- Check that your server is running
- Verify the SERVER_URL is correct
- Check browser console for errors

### Players not seeing each other
- Both players must be connected to same server
- Check firewall settings
- Try refreshing the page

### Lag/Desync
- This is expected with free hosting
- Consider upgrading to a paid tier for better performance

## Upgrading (For Serious Use)

For 50+ concurrent players, consider:
- **DigitalOcean**: $4/month droplet
- **Vultr**: $2.50/month VPS
- **AWS EC2**: Free tier for 1 year

## License

MIT - Free to use, modify, and distribute.

## Credits

Built with:
- Node.js
- Express
- Socket.io
- HTML5 Canvas
