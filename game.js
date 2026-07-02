const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
    canvas.width = window.innerWidth / 2; 
    canvas.height = window.innerHeight / 2;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// --- HANG BEÁLLÍTÁSOK ---
let hatterZene = null; // Csak indításkor hozzuk létre a hibák elkerülésére
let kozelsegHang = null; // Narancssárga zóna hangja

// --- JÁTÉK BEÁLLÍTÁSOK ---
const MAP_SIZE = 32;     
let map = [];
const FOV = Math.PI / 3; 
const DEPTH = 24;        

let gameActive = false;
let depthBuffer = []; 

let player = {
    x: 2.5,
    y: 2.5,
    angle: 0,
    speed: 0.06, 
    stamina: 100
};

let monster = {
    x: 12.5, 
    y: 12.5, 
    speed: 0.035,
    active: false,
    distanceToPlayer: 999
};

// FIX KIJÁRAT POZÍCIÓ (Távol a játékostól, a jobb alsó sarok közelében)
const exitPos = { x: 29, y: 29 };

const keys = {};
window.addEventListener("keydown", (e) => keys[e.key.toLowerCase()] = true);
window.addEventListener("keyup", (e) => keys[e.key.toLowerCase()] = false);

// --- EGÉR IRÁNYÍTÁS ---
const startScreen = document.getElementById("start-screen");
if (startScreen) {
    startScreen.addEventListener("click", () => {
        canvas.requestPointerLock();
    });
}

document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement === canvas) {
        if (startScreen) startScreen.classList.add("hidden");
        const uiElement = document.getElementById("ui");
        if (uiElement) uiElement.classList.remove("hidden");
        gameActive = true;
        monster.active = true;
        
        // --- BIZTONSÁGOS HANG INDÍTÁSOK ---
        if (!hatterZene) {
            hatterZene = new Audio('still_life.mp3');
            hatterZene.loop = true;
            hatterZene.volume = 0.25;
        }
        if (!kozelsegHang) {
            kozelsegHang = new Audio('proximity.mp3');
            kozelsegHang.loop = true;
            kozelsegHang.volume = 0.6;
        }
        
        hatterZene.play().catch(err => {
            console.error("Zene hiba:", err);
        });
    } else {
        gameActive = false;
        if (hatterZene) hatterZene.pause();
        if (kozelsegHang) kozelsegHang.pause();
    }
});

document.addEventListener("mousemove", (e) => {
    if (document.pointerLockElement === canvas && gameActive) {
        let sensitivity = 0.003;
        player.angle += e.movementX * sensitivity;
    }
});

// --- PÁLYAGENERÁTOR ---
function generateMap() {
    for (let y = 0; y < MAP_SIZE; y++) {
        map[y] = [];
        for (let x = 0; x < MAP_SIZE; x++) {
            // Külső falak védelme
            if (x === 0 || x === MAP_SIZE - 1 || y === 0 || y === MAP_SIZE - 1) {
                map[y][x] = 1;
            } 
            // Játékos biztonsági zóna (bal felül)
            else if (x < 5 && y < 5) {
                map[y][x] = 0; 
            }
            // Kijárat biztonsági zóna (jobb alul, fix környezet)
            else if (Math.abs(x - exitPos.x) <= 2 && Math.abs(y - exitPos.y) <= 2) {
                map[y][x] = 0;
            }
            // Véletlenszerű falak mindenhol máshol
            else if (Math.random() < 0.22) { 
                map[y][x] = 1;
            } else {
                map[y][x] = 0;
            }
        }
    }
    // A fix pontra elhelyezzük a kijárat blokkját
    map[exitPos.y][exitPos.x] = 2; 
}

// --- FIXÁLT SZÖRNY MOZGÁS ---
function moveMonster() {
    if (!monster.active) return;

    let dx = player.x - monster.x;
    let dy = player.y - monster.y;
    monster.distanceToPlayer = Math.sqrt(dx * dx + dy * dy);

    if (monster.distanceToPlayer < 0.1) return;

    let stepX = (dx / monster.distanceToPlayer) * monster.speed;
    let stepY = (dy / monster.distanceToPlayer) * monster.speed;

    let buffer = 0.3; 
    let checkX = monster.x + stepX + (stepX > 0 ? buffer : -buffer);
    let checkY = monster.y + stepY + (stepY > 0 ? buffer : -buffer);

    if (map[Math.floor(monster.y)][Math.floor(checkX)] === 0) {
        monster.x += stepX;
    }
    if (map[Math.floor(checkY)][Math.floor(monster.x)] === 0) {
        monster.y += stepY;
    }

    if (monster.distanceToPlayer < 0.45) {
        endGame("Meghaltál.", "Itt maradsz örökre.", "#ff0033");
    }
}

// --- LOGIKAI FRISSÍTÉSEK ---
function update() {
    if (!gameActive) return;

    let moveX = 0;
    let moveY = 0;
    let currentSpeed = player.speed;

    if (keys["shift"] && player.stamina > 5) {
        currentSpeed *= 1.5;
        player.stamina -= 1.5;
    } else if (player.stamina < 100) {
        player.stamina += 0.5;
    }
    
    const staminaFill = document.getElementById("stamina-fill");
    if (staminaFill) staminaFill.style.width = player.stamina + "%";

    if (keys["w"]) {
        moveX += Math.cos(player.angle) * currentSpeed;
        moveY += Math.sin(player.angle) * currentSpeed;
    }
    if (keys["s"]) {
        moveX -= Math.cos(player.angle) * currentSpeed;
        moveY -= Math.sin(player.angle) * currentSpeed;
    }
    if (keys["a"]) { 
        moveX += Math.sin(player.angle) * currentSpeed;
        moveY -= Math.cos(player.angle) * currentSpeed;
    }
    if (keys["d"]) { 
        moveX -= Math.sin(player.angle) * currentSpeed;
        moveY += Math.cos(player.angle) * currentSpeed;
    }

    let pBuffer = 0.25;
    let nextPX = player.x + moveX + (moveX > 0 ? pBuffer : -pBuffer);
    let nextPY = player.y + moveY + (moveY > 0 ? pBuffer : -pBuffer);

    if (map[Math.floor(player.y)][Math.floor(nextPX)] !== 1) player.x += moveX;
    if (map[Math.floor(nextPY)][Math.floor(player.x)] !== 1) player.y += moveY;

    if (map[Math.floor(player.y)][Math.floor(player.x)] === 2) {
        endGame("Gratulálok!", "Kijutottál a backroomsból.", "#00ff66");
    }

    moveMonster();

    // --- KÖZELSÉGI JELZÉSEK ÉS HANG KEZELÉSE ---
    let statusText = document.getElementById("status-text");
    if (statusText) {
        if (monster.distanceToPlayer < 4) {
            statusText.innerText = "Mozgás észlelve nagyon közel.";
            statusText.style.color = "#ff0033";
            if (kozelsegHang && kozelsegHang.paused) kozelsegHang.play().catch(() => {});
        } else if (monster.distanceToPlayer < 8) {
            statusText.innerText = "Mozgás észlelve a közelben.";
            statusText.style.color = "#ffaa00";
            // Elindul a hang a narancssárga zónában
            if (kozelsegHang && kozelsegHang.paused) kozelsegHang.play().catch(() => {});
        } else {
            statusText.innerText = "...Érzékelés...";
            statusText.style.color = "#ceca98";
            // Elnémul, ha eltávolodott
            if (kozelsegHang && !kozelsegHang.paused) kozelsegHang.pause();
        }
    }
}

function endGame(title, desc, color) {
    gameActive = false;
    document.exitPointerLock();
    
    const gameOverScreen = document.getElementById("game-over-screen");
    if (gameOverScreen) gameOverScreen.classList.remove("hidden");
    
    const endTitle = document.getElementById("end-title");
    if (endTitle) {
        endTitle.innerText = title;
        endTitle.style.color = color;
    }
    
    const endDesc = document.getElementById("end-desc");
    if (endDesc) endDesc.innerText = desc;
    
    if (hatterZene) {
        hatterZene.pause();
        hatterZene.currentTime = 0;
    }
    if (kozelsegHang) {
        kozelsegHang.pause();
        kozelsegHang.currentTime = 0;
    }
}

// --- 3D SUGÁRKÖVETŐ KIRAJZOLÁS ---
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#16140d"; 
    ctx.fillRect(0, 0, canvas.width, canvas.height / 2);
    ctx.fillStyle = "#262214"; 
    ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2);

    for (let x = 0; x < canvas.width; x++) {
        let rayAngle = (player.angle - FOV / 2) + (x / canvas.width) * FOV;
        let distanceToWall = 0;
        let hitWall = 0; 

        let eyeX = Math.cos(rayAngle);
        let eyeY = Math.sin(rayAngle);

        while (!hitWall && distanceToWall < DEPTH) {
            distanceToWall += 0.05;
            let checkX = Math.floor(player.x + eyeX * distanceToWall);
            let checkY = Math.floor(player.y + eyeY * distanceToWall);

            if (checkX < 0 || checkX >= MAP_SIZE || checkY < 0 || checkY >= MAP_SIZE) {
                hitWall = 1;
                distanceToWall = DEPTH;
            } else if (map[checkY][checkX] > 0) {
                hitWall = map[checkY][checkX]; 
            }
        }

        let correctedDist = distanceToWall * Math.cos(rayAngle - player.angle);
        depthBuffer[x] = correctedDist; 

        let wallHeight = Math.min(canvas.height, canvas.height / correctedDist);
        let shade = Math.max(0, 160 - (correctedDist * 8)); 
        
        if (hitWall === 2) {
            ctx.fillStyle = `rgb(${shade + 70}, ${shade * 0.1}, ${shade * 0.1})`;
        } else {
            ctx.fillStyle = `rgb(${shade * 0.95}, ${shade * 0.85}, ${shade * 0.45})`;
        }

        ctx.fillRect(x, (canvas.height - wallHeight) / 2, 1, wallHeight);
    }

    if (monster.active) {
        let ex = monster.x - player.x;
        let ey = monster.y - player.y;

        let monsterAngle = Math.atan2(ey, ex) - player.angle;
        while (monsterAngle < -Math.PI) monsterAngle += Math.PI * 2;
        while (monsterAngle > Math.PI) monsterAngle -= Math.PI * 2;

        if (Math.abs(monsterAngle) < FOV / 2) {
            let monsterRow = (canvas.width / 2) + (Math.tan(monsterAngle) * (canvas.width / 2));
            let monsterSize = Math.min(canvas.height, canvas.height / monster.distanceToPlayer);
            
            let startX = Math.floor(monsterRow - monsterSize / 4);
            let endX = Math.floor(monsterRow + monsterSize / 4);

            let opacity = Math.min(1, 4 / monster.distanceToPlayer);
            let jitter = (Math.random() - 0.5) * (monsterSize * 0.08);
            let my = (canvas.height - monsterSize) / 2;

            for (let rx = startX; rx < endX; rx++) {
                if (rx >= 0 && rx < canvas.width) {
                    if (monster.distanceToPlayer < depthBuffer[rx]) { 
                        ctx.fillStyle = `rgba(15, 12, 8, ${opacity})`;
                        
                        let normX = (rx - startX) / (endX - startX); 
                        let mx = rx + jitter;

                        if (normX > 0.4 && normX < 0.6) {
                            ctx.fillRect(mx, my + monsterSize * 0.1, 1, monsterSize * 0.8);
                        }
                        if (normX > 0.38 && normX < 0.62) {
                            ctx.fillRect(mx, my, 1, monsterSize * 0.12);
                        }
                        if (normX > 0.1 && normX < 0.9 && Math.random() < 0.15) {
                            ctx.fillRect(mx, my + monsterSize * 0.2, 1, monsterSize * 0.04);
                        }
                        if ((normX > 0.15 && normX < 0.2) || (normX > 0.8 && normX < 0.85)) {
                            ctx.fillRect(mx, my + monsterSize * 0.2, 1, monsterSize * 0.35);
                        }
                        if ((normX > 0.25 && normX < 0.3) || (normX > 0.7 && normX < 0.75) || (normX > 0.48 && normX < 0.52)) {
                            ctx.fillRect(mx, my + monsterSize * 0.6, 1, monsterSize * 0.4);
                        }
                        // A PIROS PÖTTY RÉSZ ELTÁVOLÍTVA INNEN!
                    }
                }
            }
        }
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

generateMap();
gameLoop();