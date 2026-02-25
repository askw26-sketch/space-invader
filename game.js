const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const scoreElement = document.getElementById('score');
const livesElement = document.getElementById('lives');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const victoryScreen = document.getElementById('victory-screen');
const finalScoreElement = document.getElementById('final-score');
const victoryScoreElement = document.getElementById('victory-score');

// Buttons
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);
document.getElementById('play-again-btn').addEventListener('click', startGame);

// Game Constants
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;

const PLAYER_SPEED = 5;
const PLAYER_BULLET_SPEED = 14; // User requested: 14 (was 21)
const ENEMY_BULLET_SPEED = 4;
const MAX_PLAYER_BULLETS = 2; // User requested: Max 2 player bullets
const MAX_ENEMY_BULLETS = 3;  // User requested: Max 3 enemy bullets
const ENEMY_ROWS = 5;         // User requested: 5 rows
const ENEMY_COLS = 10;        // User requested: 10 columns
const MAX_ENEMIES = ENEMY_ROWS * ENEMY_COLS;

// Game State
let gameState = 'START'; // START, PLAYING, GAME_OVER, VICTORY
let score = 0;
let lives = 3;
let animationId;
let lastTime = 0;

// Input State
const keys = {
    ArrowLeft: false,
    ArrowRight: false,
    Space: false
};

window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft') keys.ArrowLeft = true;
    if (e.code === 'ArrowRight') keys.ArrowRight = true;
    if (e.code === 'Space') {
        if (!keys.Space && gameState === 'PLAYING') {
            player.shoot();
        }
        keys.Space = true;
    }
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft') keys.ArrowLeft = false;
    if (e.code === 'ArrowRight') keys.ArrowRight = false;
    if (e.code === 'Space') keys.Space = false;
});

// Entities
class Player {
    constructor() {
        this.width = 40;
        this.height = 20;
        this.x = GAME_WIDTH / 2 - this.width / 2;
        this.y = GAME_HEIGHT - this.height - 20;
        this.color = '#00f3ff';
    }

    draw() {
        // Ship base
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y + 10, this.width, 10);
        // Ship top/cannon
        ctx.fillRect(this.x + 15, this.y, 10, 10);

        // Neon glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fillRect(this.x + 15, this.y, 10, 10);
        ctx.shadowBlur = 0;
    }

    update() {
        if (keys.ArrowLeft && this.x > 0) {
            this.x -= PLAYER_SPEED;
        }
        if (keys.ArrowRight && this.x < GAME_WIDTH - this.width) {
            this.x += PLAYER_SPEED;
        }
    }

    shoot() {
        if (playerBullets.length < MAX_PLAYER_BULLETS) {
            playerBullets.push(new Bullet(this.x + this.width / 2 - 2, this.y, -PLAYER_BULLET_SPEED, '#00f3ff'));
        }
    }
}

class Enemy {
    constructor(x, y) {
        this.width = 30;
        this.height = 30;
        this.x = x;
        this.y = y;
        this.color = '#ff00ea';
        this.alive = true;
    }

    draw() {
        if (!this.alive) return;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Glow
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillRect(this.x + 5, this.y + 5, this.width - 10, this.height - 10);
        ctx.shadowBlur = 0;
    }
}

class Bullet {
    constructor(x, y, speed, color) {
        this.x = x;
        this.y = y;
        this.width = 4;
        this.height = 15;
        this.speed = speed;
        this.color = color;
        this.active = true;
    }

    draw() {
        if (!this.active) return;
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.shadowBlur = 0;
    }

    update() {
        this.y += this.speed;
        if (this.y < 0 || this.y > GAME_HEIGHT) {
            this.active = false;
        }
    }
}

// Global scope entity containers
let player;
let enemies = [];
let playerBullets = [];
let enemyBullets = [];

// Enemy movement logic
let enemyDirection = 1; // 1 for right, -1 for left
let baseEnemySpeed = 1; // Base speed when all enemies are alive
let currentEnemySpeed = 1; // Dynamically calculated
let lastEnemyShot = 0;

function initEnemies() {
    enemies = [];
    const spacingX = 60; // Restored spacing for 10 columns
    const spacingY = 50; // Restored spacing for 5 rows
    const offsetX = (GAME_WIDTH - (ENEMY_COLS * spacingX)) / 2;
    const offsetY = 50;

    for (let row = 0; row < ENEMY_ROWS; row++) {
        for (let col = 0; col < ENEMY_COLS; col++) {
            enemies.push(new Enemy(offsetX + col * spacingX, offsetY + row * spacingY));
        }
    }
}

function startGame(e) {
    // Remove focus to prevent spacebar from triggering the button click again
    if (e && e.target && e.target.blur) {
        e.target.blur();
    }
    gameState = 'PLAYING';
    score = 0;
    lives = 3;
    scoreElement.innerText = score;
    livesElement.innerText = lives;

    player = new Player();
    initEnemies();
    playerBullets = [];
    enemyBullets = [];
    enemyDirection = 1;
    baseEnemySpeed = 0.5; // Start slower to compensate for inverse ratio
    currentEnemySpeed = baseEnemySpeed;

    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    victoryScreen.classList.remove('active');

    lastTime = performance.now();
    cancelAnimationFrame(animationId);
    gameLoop(lastTime);
}

function updateEnemies(deltaTime) {
    let anyAlive = false;
    let aliveCount = 0;
    let hitEdge = false;

    // First pass: check if any alive enemy has hit the edge
    for (const enemy of enemies) {
        if (!enemy.alive) continue;
        anyAlive = true;
        aliveCount++;

        // Project the next move to see if it hits the edge
        let nextX = enemy.x + (currentEnemySpeed * enemyDirection);
        if (nextX + enemy.width > GAME_WIDTH - 20 || nextX < 20) {
            hitEdge = true;
        }
    }

    if (!anyAlive) {
        gameState = 'VICTORY';
        return;
    }

    // Inverse proportion speed logic
    let speedMultiplier = MAX_ENEMIES / Math.max(1, aliveCount);
    speedMultiplier = Math.min(speedMultiplier, 6);
    currentEnemySpeed = baseEnemySpeed * speedMultiplier;

    // Second pass: Move enemies
    if (hitEdge) {
        enemyDirection *= -1; // Reverse direction

        for (const enemy of enemies) {
            enemy.y += 30; // Move down
            enemy.x += currentEnemySpeed * enemyDirection; // Move in new direction immediately

            if (enemy.y > GAME_HEIGHT - 100) {
                gameState = 'GAME_OVER';
            }
        }

        // Cap base speed increase
        baseEnemySpeed = Math.min(baseEnemySpeed + 0.05, 3);
    } else {
        // Normal horizontal movement
        for (const enemy of enemies) {
            enemy.x += currentEnemySpeed * enemyDirection;
        }
    }

    // Enemy Shooting
    if (enemyBullets.length < MAX_ENEMY_BULLETS) {
        // Simple random chance based on time
        if (Math.random() < 0.02) {
            const aliveEnemies = enemies.filter(e => e.alive);
            if (aliveEnemies.length > 0) {
                const shooter = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
                enemyBullets.push(new Bullet(shooter.x + shooter.width / 2, shooter.y + shooter.height, ENEMY_BULLET_SPEED, '#ff00ea'));
            }
        }
    }
}

function detectCollisions() {
    // Player bullets hitting enemies
    for (let i = playerBullets.length - 1; i >= 0; i--) {
        const pBul = playerBullets[i];
        if (!pBul.active) continue;

        for (const enemy of enemies) {
            if (!enemy.alive) continue;

            // AABB Collision
            if (pBul.x < enemy.x + enemy.width &&
                pBul.x + pBul.width > enemy.x &&
                pBul.y < enemy.y + enemy.height &&
                pBul.y + pBul.height > enemy.y) {

                enemy.alive = false;
                pBul.active = false;
                score += 100;
                scoreElement.innerText = score;
                break; // Bullet destroyed
            }
        }
    }

    // Enemy bullets hitting player
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const eBul = enemyBullets[i];
        if (!eBul.active) continue;

        if (eBul.x < player.x + player.width &&
            eBul.x + eBul.width > player.x &&
            eBul.y < player.y + player.height &&
            eBul.y + eBul.height > player.y) {

            eBul.active = false;
            lives--;
            livesElement.innerText = lives;

            if (lives <= 0) {
                gameState = 'GAME_OVER';
            } else {
                // Temporary invulnerability could go here
            }
        }
    }
}

function drawBackground() {
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
}

function gameLoop(currentTime) {
    if (gameState !== 'PLAYING') {
        if (gameState === 'GAME_OVER') {
            gameOverScreen.classList.add('active');
            finalScoreElement.innerText = score;
        } else if (gameState === 'VICTORY') {
            victoryScreen.classList.add('active');
            victoryScoreElement.innerText = score;
        }
        return; // Stop loop
    }

    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    // Update
    player.update();

    // Update Bullets
    for (const b of playerBullets) b.update();
    for (const b of enemyBullets) b.update();

    // Cleanup inactive bullets
    playerBullets = playerBullets.filter(b => b.active);
    enemyBullets = enemyBullets.filter(b => b.active);

    updateEnemies(deltaTime);
    detectCollisions();

    // Draw
    drawBackground();

    // Draw simple stars as background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    for (let i = 0; i < 30; i++) {
        // pseudo-random pseudo-static stars
        const x = (Math.sin(i * 123) * 0.5 + 0.5) * GAME_WIDTH;
        const y = (Math.cos(i * 321) * 0.5 + 0.5) * GAME_HEIGHT;
        ctx.fillRect(x, (y + currentTime * 0.05) % GAME_HEIGHT, 2, 2);
    }

    for (const b of playerBullets) b.draw();
    for (const b of enemyBullets) b.draw();
    for (const e of enemies) e.draw();
    player.draw();

    animationId = requestAnimationFrame(gameLoop);
}

// Initial clear
drawBackground();

