// ==========================================
// MMO NETWORKING MODULE
// Add this to your game HTML before the closing </script> tag
// ==========================================

// Configuration - Change this to your server URL after deployment
const SERVER_URL = 'http://localhost:3000'; // Change to your Glitch/Render URL

// Socket.io connection
let socket = null;
let myPlayerId = null;
let otherPlayers = new Map();
let isConnected = false;

// Player name input
let playerName = localStorage.getItem('playerName') || 'Player' + Math.floor(Math.random() * 9999);

// Initialize multiplayer
function initMultiplayer() {
    // Add Socket.io script dynamically
    const script = document.createElement('script');
    script.src = SERVER_URL + '/socket.io/socket.io.js';
    script.onload = () => {
        connectToServer();
    };
    script.onerror = () => {
        console.log('Running in offline mode (server not available)');
        showConnectionStatus('Offline Mode', '#f59e0b');
    };
    document.head.appendChild(script);
}

function connectToServer() {
    socket = io(SERVER_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
    });
    
    socket.on('connect', () => {
        console.log('Connected to MMO server');
        isConnected = true;
        showConnectionStatus('Connected', '#22c55e');
        
        // Join the game
        socket.emit('join', {
            name: playerName,
            class: gameState.selectedClass
        });
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        isConnected = false;
        showConnectionStatus('Disconnected', '#ef4444');
        otherPlayers.clear();
    });
    
    socket.on('joined', (data) => {
        myPlayerId = data.id;
        console.log(`Joined as ${data.player.name} (${myPlayerId})`);
        
        // Add existing players
        data.players.forEach(p => {
            if (p.id !== myPlayerId) {
                otherPlayers.set(p.id, createOtherPlayer(p));
            }
        });
        
        showNotification(`Welcome ${data.player.name}! ${otherPlayers.size} players online.`);
    });
    
    socket.on('playerJoined', (player) => {
        if (player.id !== myPlayerId) {
            otherPlayers.set(player.id, createOtherPlayer(player));
            showNotification(`${player.name} joined the game`);
        }
    });
    
    socket.on('playerLeft', (playerId) => {
        const player = otherPlayers.get(playerId);
        if (player) {
            showNotification(`${player.name} left the game`);
            otherPlayers.delete(playerId);
        }
    });
    
    socket.on('playerMoved', (data) => {
        const player = otherPlayers.get(data.id);
        if (player) {
            // Smooth interpolation
            player.targetX = data.x;
            player.targetY = data.y;
            player.facing = data.facing;
            player.isSprinting = data.isSprinting;
            player.health = data.health;
            player.maxHealth = data.maxHealth;
            player.energy = data.energy;
            player.isCasting = data.isCasting;
        }
    });
    
    socket.on('abilityUsed', (data) => {
        if (data.playerId !== myPlayerId) {
            // Show visual effects for other players' abilities
            createRemoteAbilityEffect(data);
        }
    });
    
    socket.on('projectileSpawned', (projectile) => {
        if (projectile.ownerId !== myPlayerId) {
            // Add remote projectile to game
            gameState.projectiles.push({
                ...projectile,
                isRemote: true
            });
        }
    });
    
    socket.on('playerDamaged', (data) => {
        if (data.playerId === myPlayerId) {
            const player = getCurrentPlayer();
            player.health = data.health;
            showDamageNumber(player.x, player.y, data.damage, 'pvp');
        } else {
            const otherPlayer = otherPlayers.get(data.playerId);
            if (otherPlayer) {
                otherPlayer.health = data.health;
            }
        }
    });
    
    socket.on('playerDied', (data) => {
        if (data.playerId === myPlayerId) {
            showNotification(`You were killed by ${data.killerName}!`, '#ef4444');
            // Show death screen
            showDeathScreen();
        } else {
            const victim = otherPlayers.get(data.playerId);
            if (victim) {
                showNotification(`${victim.name} was killed by ${data.killerName}`);
            }
        }
    });
    
    socket.on('respawn', (data) => {
        const player = getCurrentPlayer();
        player.x = data.x;
        player.y = data.y;
        player.health = data.health;
        hideDeathScreen();
        showNotification('You have respawned!', '#22c55e');
    });
    
    socket.on('playerRespawned', (data) => {
        const player = otherPlayers.get(data.id);
        if (player) {
            player.x = data.x;
            player.y = data.y;
            player.targetX = data.x;
            player.targetY = data.y;
            player.health = data.health;
        }
    });
    
    socket.on('takeDamage', (data) => {
        const player = getCurrentPlayer();
        player.health = Math.max(0, player.health - data.damage);
        showDamageNumber(player.x, player.y, data.damage, 'mob');
    });
    
    socket.on('mobSync', (data) => {
        // Sync goblin positions from server
        data.goblins.forEach(serverGoblin => {
            let goblin = gameState.goblins.find(g => g.id === serverGoblin.id);
            if (goblin) {
                goblin.x = serverGoblin.x;
                goblin.y = serverGoblin.y;
                goblin.health = serverGoblin.health;
                goblin.facing = serverGoblin.facing;
            }
        });
        
        // Sync orc positions from server
        data.orcs.forEach(serverOrc => {
            let orc = gameState.orcs.find(o => o.id === serverOrc.id);
            if (orc) {
                orc.x = serverOrc.x;
                orc.y = serverOrc.y;
                orc.health = serverOrc.health;
                orc.facing = serverOrc.facing;
            }
        });
    });
    
    socket.on('mobDied', (data) => {
        let mob = null;
        if (data.type === 'goblin') {
            mob = gameState.goblins.find(g => g.id === data.id);
        } else if (data.type === 'orc') {
            mob = gameState.orcs.find(o => o.id === data.id);
        }
        
        if (mob) {
            mob.health = 0;
            if (data.killerId === myPlayerId) {
                showNotification(`You killed a ${data.type}!`, '#22c55e');
            }
        }
    });
    
    socket.on('mobRespawned', (data) => {
        if (data.type === 'goblin') {
            let goblin = gameState.goblins.find(g => g.id === data.mob.id);
            if (goblin) {
                Object.assign(goblin, data.mob);
            }
        } else if (data.type === 'orc') {
            let orc = gameState.orcs.find(o => o.id === data.mob.id);
            if (orc) {
                Object.assign(orc, data.mob);
            }
        }
    });
    
    socket.on('chatMessage', (data) => {
        showChatMessage(data.playerName, data.message);
    });
    
    socket.on('pvpToggled', (enabled) => {
        showNotification(`PvP ${enabled ? 'enabled' : 'disabled'}`, enabled ? '#ef4444' : '#22c55e');
    });
}

function createOtherPlayer(data) {
    return {
        id: data.id,
        name: data.name,
        class: data.class,
        x: data.x,
        y: data.y,
        targetX: data.x,
        targetY: data.y,
        health: data.health,
        maxHealth: data.maxHealth,
        energy: data.energy || 100,
        facing: data.facing || 0,
        radius: 20,
        color: data.color || '#48bb78',
        isSprinting: false,
        isCasting: false,
        pvpEnabled: data.pvpEnabled !== false
    };
}

// Send player state to server
function sendPlayerUpdate() {
    if (!socket || !isConnected) return;
    
    const player = getCurrentPlayer();
    socket.emit('move', {
        x: player.x,
        y: player.y,
        facing: player.facing,
        isSprinting: player.isSprinting,
        health: player.health,
        energy: player.energy,
        isCasting: player.isCasting
    });
}

// Send ability usage
function sendAbility(ability, targetX, targetY, direction) {
    if (!socket || !isConnected) return;
    
    socket.emit('ability', {
        ability: ability,
        targetX: targetX,
        targetY: targetY,
        direction: direction
    });
}

// Send projectile
function sendProjectile(projectile) {
    if (!socket || !isConnected) return;
    
    socket.emit('projectile', {
        x: projectile.x,
        y: projectile.y,
        vx: projectile.vx,
        vy: projectile.vy,
        damage: projectile.damage,
        type: projectile.type,
        radius: projectile.radius,
        lifetime: projectile.lifetime
    });
}

// Send mob damage
function sendMobDamage(type, id, damage) {
    if (!socket || !isConnected) return;
    
    socket.emit('damageMob', {
        type: type,
        id: id,
        damage: damage
    });
}

// Send PvP damage
function sendPvPDamage(targetId, damage) {
    if (!socket || !isConnected) return;
    
    socket.emit('damagePlayer', {
        targetId: targetId,
        damage: damage
    });
}

// Send chat message
function sendChatMessage(message) {
    if (!socket || !isConnected) return;
    
    socket.emit('chat', message);
}

// Toggle PvP
function togglePvP() {
    if (!socket || !isConnected) return;
    
    socket.emit('togglePvP');
}

// Draw other players
function drawOtherPlayers(ctx, currentTime) {
    otherPlayers.forEach((player, id) => {
        // Interpolate position
        const lerp = 0.15;
        player.x += (player.targetX - player.x) * lerp;
        player.y += (player.targetY - player.y) * lerp;
        
        // Draw player
        drawRemotePlayer(ctx, player, currentTime);
    });
}

function drawRemotePlayer(ctx, player, currentTime) {
    const facingLeft = Math.abs(player.facing) > Math.PI / 2;
    const flip = facingLeft ? -1 : 1;
    
    // Draw shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(player.x, player.y + player.radius, player.radius * 0.8, player.radius * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // PvP indicator
    if (player.pvpEnabled) {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius + 15, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    // Body
    ctx.save();
    ctx.translate(player.x, player.y);
    
    // Main body circle
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Class icon
    const classIcons = {
        ranger: '🏹',
        icemage: '❄️',
        firemage: '🔥',
        rogue: '🗡️',
        monk: '🥋',
        warrior: '🛡️'
    };
    
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(classIcons[player.class] || '⚔️', 0, 0);
    
    ctx.restore();
    
    // Health bar
    const barWidth = 50;
    const barHeight = 6;
    const healthPercent = player.health / player.maxHealth;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(player.x - barWidth / 2, player.y - player.radius - 20, barWidth, barHeight);
    
    const healthColor = healthPercent > 0.5 ? '#22c55e' : healthPercent > 0.25 ? '#f59e0b' : '#ef4444';
    ctx.fillStyle = healthColor;
    ctx.fillRect(player.x - barWidth / 2, player.y - player.radius - 20, barWidth * healthPercent, barHeight);
    
    // Player name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(player.name, player.x, player.y - player.radius - 26);
    
    // Casting indicator
    if (player.isCasting) {
        const pulse = Math.sin(currentTime * 8) * 0.3 + 0.7;
        ctx.strokeStyle = `rgba(255, 255, 255, ${pulse})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius + 8, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    // Sprint effect
    if (player.isSprinting) {
        ctx.strokeStyle = 'rgba(255, 200, 50, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius + 5, 0, Math.PI * 2);
        ctx.stroke();
    }
}

// Check PvP collision
function checkPvPCollision(x, y, radius, damage, sourcePlayerId) {
    if (!isConnected) return;
    
    otherPlayers.forEach((player, id) => {
        if (!player.pvpEnabled) return;
        
        const dx = player.x - x;
        const dy = player.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < radius + player.radius) {
            sendPvPDamage(id, damage);
        }
    });
}

// UI Functions
function showConnectionStatus(text, color) {
    let statusEl = document.getElementById('connectionStatus');
    if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.id = 'connectionStatus';
        statusEl.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            color: white;
            z-index: 10000;
            font-family: 'Segoe UI', sans-serif;
        `;
        document.body.appendChild(statusEl);
    }
    statusEl.textContent = text;
    statusEl.style.background = color;
}

function showNotification(text, color = '#3b82f6') {
    const notif = document.createElement('div');
    notif.style.cssText = `
        position: fixed;
        top: 50px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 24px;
        background: ${color};
        color: white;
        border-radius: 8px;
        font-size: 14px;
        font-weight: bold;
        z-index: 10000;
        animation: fadeInOut 3s forwards;
        font-family: 'Segoe UI', sans-serif;
    `;
    notif.textContent = text;
    document.body.appendChild(notif);
    
    setTimeout(() => notif.remove(), 3000);
}

function showDeathScreen() {
    let deathScreen = document.getElementById('deathScreen');
    if (!deathScreen) {
        deathScreen = document.createElement('div');
        deathScreen.id = 'deathScreen';
        deathScreen.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            color: white;
            font-family: 'Segoe UI', sans-serif;
        `;
        deathScreen.innerHTML = `
            <div style="font-size: 48px; color: #ef4444; margin-bottom: 20px;">☠️ YOU DIED ☠️</div>
            <div style="font-size: 18px; color: #9ca3af;">Respawning in 5 seconds...</div>
        `;
        document.body.appendChild(deathScreen);
    }
    deathScreen.style.display = 'flex';
}

function hideDeathScreen() {
    const deathScreen = document.getElementById('deathScreen');
    if (deathScreen) {
        deathScreen.style.display = 'none';
    }
}

function showDamageNumber(x, y, damage, type) {
    const color = type === 'pvp' ? '#ef4444' : '#f59e0b';
    gameState.damageNumbers.push({
        damage: Math.floor(damage),
        x: x,
        y: y,
        type: type,
        createdAt: performance.now() / 1000,
        lifetime: 1.5
    });
}

// Chat UI
let chatMessages = [];
function showChatMessage(playerName, message) {
    chatMessages.push({ name: playerName, message, time: Date.now() });
    if (chatMessages.length > 10) chatMessages.shift();
    updateChatUI();
}

function updateChatUI() {
    let chatEl = document.getElementById('chatBox');
    if (!chatEl) {
        chatEl = document.createElement('div');
        chatEl.id = 'chatBox';
        chatEl.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 20px;
            width: 300px;
            max-height: 200px;
            overflow-y: auto;
            background: rgba(0, 0, 0, 0.6);
            border-radius: 8px;
            padding: 10px;
            z-index: 1000;
            font-family: 'Segoe UI', sans-serif;
        `;
        document.body.appendChild(chatEl);
    }
    
    chatEl.innerHTML = chatMessages.map(m => 
        `<div style="color: #9ca3af; font-size: 12px; margin-bottom: 4px;">
            <span style="color: #3b82f6; font-weight: bold;">${m.name}:</span> ${m.message}
        </div>`
    ).join('');
    
    chatEl.scrollTop = chatEl.scrollHeight;
}

// Chat input
function setupChatInput() {
    const chatInput = document.createElement('input');
    chatInput.id = 'chatInput';
    chatInput.type = 'text';
    chatInput.placeholder = 'Press Enter to chat...';
    chatInput.maxLength = 200;
    chatInput.style.cssText = `
        position: fixed;
        bottom: 60px;
        left: 20px;
        width: 300px;
        padding: 8px 12px;
        background: rgba(0, 0, 0, 0.7);
        border: 2px solid #374151;
        border-radius: 6px;
        color: white;
        font-size: 13px;
        z-index: 1000;
        display: none;
        font-family: 'Segoe UI', sans-serif;
    `;
    document.body.appendChild(chatInput);
    
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            if (chatInput.style.display === 'none') {
                chatInput.style.display = 'block';
                chatInput.focus();
            } else {
                if (chatInput.value.trim()) {
                    sendChatMessage(chatInput.value.trim());
                }
                chatInput.value = '';
                chatInput.style.display = 'none';
            }
        }
        if (e.key === 'Escape' && chatInput.style.display === 'block') {
            chatInput.value = '';
            chatInput.style.display = 'none';
        }
    });
}

// Player list UI
function createPlayerList() {
    const list = document.createElement('div');
    list.id = 'playerList';
    list.style.cssText = `
        position: fixed;
        top: 50px;
        right: 10px;
        width: 180px;
        background: rgba(0, 0, 0, 0.7);
        border-radius: 8px;
        padding: 10px;
        z-index: 1000;
        font-family: 'Segoe UI', sans-serif;
        color: white;
        font-size: 12px;
    `;
    document.body.appendChild(list);
    
    setInterval(() => {
        let html = `<div style="font-weight: bold; margin-bottom: 8px; color: #fbbf24;">Players Online (${otherPlayers.size + 1})</div>`;
        html += `<div style="color: #22c55e; margin-bottom: 4px;">• ${playerName} (You)</div>`;
        
        otherPlayers.forEach(p => {
            const healthPercent = Math.round((p.health / p.maxHealth) * 100);
            html += `<div style="margin-bottom: 4px;">
                • ${p.name} 
                <span style="color: ${p.pvpEnabled ? '#ef4444' : '#22c55e'};">[${p.class}]</span>
                <span style="color: #9ca3af;">${healthPercent}%</span>
            </div>`;
        });
        
        list.innerHTML = html;
    }, 500);
}

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeInOut {
        0% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        15% { opacity: 1; transform: translateX(-50%) translateY(0); }
        85% { opacity: 1; transform: translateX(-50%) translateY(0); }
        100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
    }
`;
document.head.appendChild(style);

// Update rate limiter
let lastUpdateTime = 0;
const UPDATE_INTERVAL = 50; // 20 updates per second

function networkUpdate() {
    const now = performance.now();
    if (now - lastUpdateTime > UPDATE_INTERVAL) {
        sendPlayerUpdate();
        lastUpdateTime = now;
    }
}

// Initialize everything when game starts
function initMMO() {
    initMultiplayer();
    setupChatInput();
    createPlayerList();
    
    // Add PvP toggle button
    const pvpBtn = document.createElement('button');
    pvpBtn.id = 'pvpToggleBtn';
    pvpBtn.textContent = '⚔️ PvP: ON';
    pvpBtn.style.cssText = `
        position: fixed;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        padding: 8px 20px;
        background: #ef4444;
        color: white;
        border: none;
        border-radius: 20px;
        cursor: pointer;
        font-weight: bold;
        z-index: 1000;
        font-family: 'Segoe UI', sans-serif;
    `;
    pvpBtn.onclick = () => {
        togglePvP();
        const isOn = pvpBtn.textContent.includes('ON');
        pvpBtn.textContent = isOn ? '⚔️ PvP: OFF' : '⚔️ PvP: ON';
        pvpBtn.style.background = isOn ? '#22c55e' : '#ef4444';
    };
    document.body.appendChild(pvpBtn);
}

// Export functions for use in main game code
window.MMO = {
    init: initMMO,
    sendUpdate: networkUpdate,
    drawOtherPlayers: drawOtherPlayers,
    sendAbility: sendAbility,
    sendProjectile: sendProjectile,
    sendMobDamage: sendMobDamage,
    checkPvPCollision: checkPvPCollision,
    isConnected: () => isConnected,
    getOtherPlayers: () => otherPlayers
};

// Auto-initialize after DOM loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMMO);
} else {
    // DOM already loaded, wait for game to init
    setTimeout(initMMO, 1000);
}
