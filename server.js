// MMO Server - Combat System
// Free hosting: Glitch.com, Render.com, or Railway.app

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static('public'));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Game state
const players = new Map();
const projectiles = [];
const mobs = {
    goblins: [],
    orcs: [],
    skeletons: [],
    wolves: []
};

// World dimensions
const WORLD_WIDTH = 8000;
const WORLD_HEIGHT = 9000;

// Spawn zones for mobs
const MOB_SPAWN_ZONES = [
    { type: 'goblin', x: -2000, y: -2000, radius: 500, count: 8 },
    { type: 'goblin', x: 2000, y: -1500, radius: 400, count: 6 },
    { type: 'orc', x: -1500, y: 2000, radius: 600, count: 5 },
    { type: 'orc', x: 3000, y: 1000, radius: 500, count: 4 },
];

// Mob ID counter
let nextMobId = 0;

// Initialize mobs
function initializeMobs() {
    MOB_SPAWN_ZONES.forEach(zone => {
        for (let i = 0; i < zone.count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * zone.radius;
            const x = zone.x + Math.cos(angle) * dist;
            const y = zone.y + Math.sin(angle) * dist;
            
            if (zone.type === 'goblin') {
                mobs.goblins.push(createGoblin(x, y));
            } else if (zone.type === 'orc') {
                mobs.orcs.push(createOrc(x, y));
            }
        }
    });
}

function createGoblin(x, y) {
    return {
        id: nextMobId++,
        type: 'goblin',
        x, y,
        spawnX: x,
        spawnY: y,
        radius: 20,
        health: 300,
        maxHealth: 300,
        speed: 80,
        aggroRange: 250,
        attackRange: 35,
        attackDamage: 25,
        attackSpeed: 1.5,
        lastAttack: 0,
        target: null,
        facing: 0,
        isRooted: false,
        isSlowed: false,
        slowPercent: 0,
        isStunned: false,
        respawnTime: 30000 // 30 seconds
    };
}

function createOrc(x, y) {
    return {
        id: nextMobId++,
        type: 'orc',
        x, y,
        spawnX: x,
        spawnY: y,
        radius: 28,
        health: 600,
        maxHealth: 600,
        speed: 70,
        aggroRange: 300,
        attackRange: 45,
        attackDamage: 45,
        attackSpeed: 2.0,
        lastAttack: 0,
        target: null,
        facing: 0,
        isRooted: false,
        isSlowed: false,
        slowPercent: 0,
        isStunned: false,
        respawnTime: 45000
    };
}

// Class stats
const CLASS_STATS = {
    ranger: { health: 1000, speed: 100, autoAttackRange: 350, autoAttackDamage: 85 },
    icemage: { health: 800, speed: 90, autoAttackRange: 300, autoAttackDamage: 65 },
    firemage: { health: 850, speed: 95, autoAttackRange: 310, autoAttackDamage: 70 },
    rogue: { health: 1200, speed: 110, autoAttackRange: 120, autoAttackDamage: 120 },
    monk: { health: 1100, speed: 105, autoAttackRange: 100, autoAttackDamage: 110 },
    warrior: { health: 1300, speed: 85, autoAttackRange: 120, autoAttackDamage: 130 }
};

// Player class icons/colors
const CLASS_COLORS = {
    ranger: '#48bb78',
    icemage: '#93c5fd',
    firemage: '#ff6b35',
    rogue: '#e879f9',
    monk: '#d97706',
    warrior: '#94a3b8'
};

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    
    // Handle player join
    socket.on('join', (data) => {
        const stats = CLASS_STATS[data.class] || CLASS_STATS.ranger;
        const spawnX = 7000 + (Math.random() - 0.5) * 200;
        const spawnY = 7800 + (Math.random() - 0.5) * 200;
        
        const player = {
            id: socket.id,
            name: data.name || `Player${Math.floor(Math.random() * 9999)}`,
            class: data.class || 'ranger',
            x: spawnX,
            y: spawnY,
            health: stats.health,
            maxHealth: stats.health,
            energy: 100,
            maxEnergy: 100,
            speed: stats.speed,
            facing: 0,
            isSprinting: false,
            isCasting: false,
            color: CLASS_COLORS[data.class] || '#48bb78',
            lastUpdate: Date.now(),
            kills: 0,
            deaths: 0,
            pvpEnabled: true
        };
        
        players.set(socket.id, player);
        
        // Send player their ID and initial state
        socket.emit('joined', {
            id: socket.id,
            player: player,
            players: Array.from(players.values()),
            mobs: mobs
        });
        
        // Broadcast new player to others
        socket.broadcast.emit('playerJoined', player);
        
        console.log(`${player.name} (${player.class}) joined the game`);
    });
    
    // Handle player movement updates
    socket.on('move', (data) => {
        const player = players.get(socket.id);
        if (player) {
            player.x = data.x;
            player.y = data.y;
            player.facing = data.facing;
            player.isSprinting = data.isSprinting;
            player.health = data.health;
            player.energy = data.energy;
            player.isCasting = data.isCasting;
            player.lastUpdate = Date.now();
            
            // Broadcast to other players
            socket.broadcast.emit('playerMoved', {
                id: socket.id,
                x: data.x,
                y: data.y,
                facing: data.facing,
                isSprinting: data.isSprinting,
                health: data.health,
                maxHealth: player.maxHealth,
                energy: data.energy,
                isCasting: data.isCasting
            });
        }
    });
    
    // Handle ability usage
    socket.on('ability', (data) => {
        const player = players.get(socket.id);
        if (player) {
            // Broadcast ability to all players for visual effects
            io.emit('abilityUsed', {
                playerId: socket.id,
                ability: data.ability,
                targetX: data.targetX,
                targetY: data.targetY,
                direction: data.direction
            });
        }
    });
    
    // Handle projectile creation
    socket.on('projectile', (data) => {
        const projectile = {
            id: Date.now() + Math.random(),
            ownerId: socket.id,
            x: data.x,
            y: data.y,
            vx: data.vx,
            vy: data.vy,
            damage: data.damage,
            type: data.type,
            radius: data.radius || 8,
            lifetime: data.lifetime || 2,
            createdAt: Date.now()
        };
        
        projectiles.push(projectile);
        
        // Broadcast to all players
        io.emit('projectileSpawned', projectile);
    });
    
    // Handle damage to mobs
    socket.on('damageMob', (data) => {
        let mob = null;
        let mobList = null;
        
        if (data.type === 'goblin') {
            mobList = mobs.goblins;
            mob = mobs.goblins.find(g => g.id === data.id);
        } else if (data.type === 'orc') {
            mobList = mobs.orcs;
            mob = mobs.orcs.find(o => o.id === data.id);
        }
        
        if (mob && mob.health > 0) {
            mob.health -= data.damage;
            mob.target = socket.id;
            
            if (mob.health <= 0) {
                mob.health = 0;
                
                // Give kill credit
                const player = players.get(socket.id);
                if (player) {
                    player.kills++;
                }
                
                // Broadcast death
                io.emit('mobDied', {
                    type: data.type,
                    id: data.id,
                    killerId: socket.id
                });
                
                // Schedule respawn
                setTimeout(() => {
                    mob.health = mob.maxHealth;
                    mob.x = mob.spawnX + (Math.random() - 0.5) * 100;
                    mob.y = mob.spawnY + (Math.random() - 0.5) * 100;
                    mob.target = null;
                    
                    io.emit('mobRespawned', {
                        type: data.type,
                        mob: mob
                    });
                }, mob.respawnTime);
            }
            
            // Broadcast damage
            io.emit('mobDamaged', {
                type: data.type,
                id: data.id,
                health: mob.health,
                damage: data.damage
            });
        }
    });
    
    // Handle PvP damage
    socket.on('damagePlayer', (data) => {
        const target = players.get(data.targetId);
        const attacker = players.get(socket.id);
        
        if (target && attacker && target.pvpEnabled && attacker.pvpEnabled) {
            target.health -= data.damage;
            
            if (target.health <= 0) {
                target.health = 0;
                target.deaths++;
                attacker.kills++;
                
                // Broadcast death
                io.emit('playerDied', {
                    playerId: data.targetId,
                    killerId: socket.id,
                    killerName: attacker.name
                });
                
                // Respawn after 5 seconds
                setTimeout(() => {
                    target.health = target.maxHealth;
                    target.x = 7000 + (Math.random() - 0.5) * 200;
                    target.y = 7800 + (Math.random() - 0.5) * 200;
                    
                    io.to(data.targetId).emit('respawn', {
                        x: target.x,
                        y: target.y,
                        health: target.health
                    });
                    
                    io.emit('playerRespawned', {
                        id: data.targetId,
                        x: target.x,
                        y: target.y,
                        health: target.health
                    });
                }, 5000);
            }
            
            // Broadcast damage
            io.emit('playerDamaged', {
                playerId: data.targetId,
                health: target.health,
                damage: data.damage,
                attackerId: socket.id
            });
        }
    });
    
    // Handle chat messages
    socket.on('chat', (message) => {
        const player = players.get(socket.id);
        if (player) {
            io.emit('chatMessage', {
                playerId: socket.id,
                playerName: player.name,
                message: message.substring(0, 200) // Limit message length
            });
        }
    });
    
    // Toggle PvP
    socket.on('togglePvP', () => {
        const player = players.get(socket.id);
        if (player) {
            player.pvpEnabled = !player.pvpEnabled;
            socket.emit('pvpToggled', player.pvpEnabled);
            socket.broadcast.emit('playerPvPChanged', {
                id: socket.id,
                pvpEnabled: player.pvpEnabled
            });
        }
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
        const player = players.get(socket.id);
        if (player) {
            console.log(`${player.name} disconnected`);
            players.delete(socket.id);
            io.emit('playerLeft', socket.id);
        }
    });
});

// Game loop - Update mobs and sync state
const TICK_RATE = 20; // 20 ticks per second
setInterval(() => {
    const now = Date.now();
    
    // Update mob AI
    [...mobs.goblins, ...mobs.orcs].forEach(mob => {
        if (mob.health <= 0) return;
        
        // Find closest player in aggro range
        let closestPlayer = null;
        let closestDist = mob.aggroRange;
        
        players.forEach((player, playerId) => {
            if (player.health <= 0) return;
            
            const dx = player.x - mob.x;
            const dy = player.y - mob.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < closestDist) {
                closestDist = dist;
                closestPlayer = playerId;
            }
        });
        
        if (closestPlayer) {
            mob.target = closestPlayer;
            const player = players.get(closestPlayer);
            
            if (player && !mob.isStunned && !mob.isRooted) {
                const dx = player.x - mob.x;
                const dy = player.y - mob.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                mob.facing = Math.atan2(dy, dx);
                
                // Move towards player if not in attack range
                if (dist > mob.attackRange) {
                    const speed = mob.isSlowed ? mob.speed * (1 - mob.slowPercent / 100) : mob.speed;
                    const moveX = (dx / dist) * speed * (1 / TICK_RATE);
                    const moveY = (dy / dist) * speed * (1 / TICK_RATE);
                    mob.x += moveX;
                    mob.y += moveY;
                } else {
                    // Attack
                    if (now - mob.lastAttack > mob.attackSpeed * 1000) {
                        mob.lastAttack = now;
                        
                        // Send damage to player
                        io.to(closestPlayer).emit('takeDamage', {
                            damage: mob.attackDamage,
                            attackerId: mob.id,
                            attackerType: 'mob'
                        });
                    }
                }
            }
        } else {
            mob.target = null;
            // Return to spawn if too far
            const dx = mob.spawnX - mob.x;
            const dy = mob.spawnY - mob.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist > 50 && !mob.isStunned && !mob.isRooted) {
                const moveX = (dx / dist) * mob.speed * 0.5 * (1 / TICK_RATE);
                const moveY = (dy / dist) * mob.speed * 0.5 * (1 / TICK_RATE);
                mob.x += moveX;
                mob.y += moveY;
                mob.facing = Math.atan2(dy, dx);
            }
        }
    });
    
    // Clean up old projectiles
    const now2 = Date.now();
    for (let i = projectiles.length - 1; i >= 0; i--) {
        if (now2 - projectiles[i].createdAt > projectiles[i].lifetime * 1000) {
            projectiles.splice(i, 1);
        }
    }
    
    // Remove inactive players (no update in 30 seconds)
    players.forEach((player, id) => {
        if (now - player.lastUpdate > 30000) {
            console.log(`Removing inactive player: ${player.name}`);
            players.delete(id);
            io.emit('playerLeft', id);
        }
    });
    
}, 1000 / TICK_RATE);

// Broadcast mob positions periodically
setInterval(() => {
    io.emit('mobSync', {
        goblins: mobs.goblins.filter(g => g.health > 0).map(g => ({
            id: g.id,
            x: g.x,
            y: g.y,
            health: g.health,
            facing: g.facing,
            target: g.target
        })),
        orcs: mobs.orcs.filter(o => o.health > 0).map(o => ({
            id: o.id,
            x: o.x,
            y: o.y,
            health: o.health,
            facing: o.facing,
            target: o.target
        }))
    });
}, 100); // 10 times per second

// Initialize mobs on server start
initializeMobs();

// Health endpoint for monitoring
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        players: players.size,
        mobs: mobs.goblins.length + mobs.orcs.length
    });
});

// Stats endpoint
app.get('/stats', (req, res) => {
    res.json({
        players: Array.from(players.values()).map(p => ({
            name: p.name,
            class: p.class,
            kills: p.kills,
            deaths: p.deaths
        }))
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🎮 MMO Server running on port ${PORT}`);
    console.log(`📊 ${mobs.goblins.length} goblins and ${mobs.orcs.length} orcs spawned`);
});
