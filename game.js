const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// UI এলিমেন্টসমূহ
const menuScreen = document.getElementById("menu-screen");
const pauseScreen = document.getElementById("pause-screen");
const gameoverScreen = document.getElementById("gameover-screen");
const hud = document.getElementById("hud");
const scoreElement = document.getElementById("score");
const coinsElement = document.getElementById("coins");
const finalScoreElement = document.getElementById("final-score");
const finalCoinsElement = document.getElementById("final-coins");

// বাটনের লিসেনার্স
document.getElementById("start-btn").addEventListener("click", startGame);
document.getElementById("pause-btn").addEventListener("click", pauseGame);
document.getElementById("resume-btn").addEventListener("click", resumeGame);
document.getElementById("restart-from-pause-btn").addEventListener("click", resetToPlay);
document.getElementById("retry-btn").addEventListener("click", resetToPlay);

// গেইম স্টেট সিস্টেম
const STATES = { MENU: 'MENU', PLAYING: 'PLAYING', PAUSED: 'PAUSED', GAMEOVER: 'GAMEOVER' };
let currentState = STATES.MENU;

// গেইম কনফিগারেশন ও ভ্যারিয়েবল
let score = 0;
let coins = 0;
let cameraX = 0;
const gravity = 0.45; 
const angularGravity = 0.75;

const player = {
    x: 0, y: 0, vx: 5, vy: 0, radius: 12,
    isGrappled: false, pivot: null, ropeLength: 0,
    angle: 0, angularVelocity: 0, trail: []
};

let anchors = [];
let collectibles = [];
let obstacles = [];

// রেসপনসিভ ক্যানভাস সাইজ
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ইনপুত ট্রিগার (UI বাটন ছাড়া বাকি ক্যানভাস এরিয়াতে কাজ করবে)
window.addEventListener("mousedown", (e) => { if(e.target.tagName !== 'BUTTON') handleActionStart(); });
window.addEventListener("touchstart", (e) => { if(e.target.tagName !== 'BUTTON') handleActionStart(); });
window.addEventListener("mouseup", handleActionEnd);
window.addEventListener("touchend", handleActionEnd);

function handleActionStart() {
    if (currentState !== STATES.PLAYING || player.isGrappled) return;

    let bestAnchor = null;
    let minDistance = 450; // ম্যাক্সিমাম রেঞ্জ

    for (let anchor of anchors) {
        if (anchor.x > player.x) {
            let dist = Math.hypot(anchor.x - player.x, anchor.y - player.y);
            if (dist < minDistance) {
                minDistance = dist;
                bestAnchor = anchor;
            }
        }
    }

    if (bestAnchor) {
        player.isGrappled = true;
        player.pivot = bestAnchor;
        player.ropeLength = minDistance;
        player.angle = Math.atan2(player.y - player.pivot.y, player.x - player.pivot.x);
        
        let dotProduct = (player.vx * -Math.sin(player.angle)) + (player.vy * Math.cos(player.angle));
        player.angularVelocity = dotProduct / player.ropeLength;
    }
}

function handleActionEnd() {
    if (currentState !== STATES.PLAYING || !player.isGrappled) return;
    
    player.vx = -Math.sin(player.angle) * player.angularVelocity * player.ropeLength;
    player.vy = Math.cos(player.angle) * player.angularVelocity * player.ropeLength;
    
    player.vx = Math.max(4.5, Math.min(player.vx, 14)); // স্পিড ব্যালেন্সার
    player.isGrappled = false;
    player.pivot = null;
}

// গেইম শুরু ও নিয়ন্ত্রণ ফাংশনসমূহ
function startGame() {
    currentState = STATES.PLAYING;
    menuScreen.classList.add("hidden");
    hud.classList.remove("hidden");
    resetToPlay();
}

function pauseGame() {
    if (currentState !== STATES.PLAYING) return;
    currentState = STATES.PAUSED;
    pauseScreen.classList.remove("hidden");
}

function resumeGame() {
    currentState = STATES.PLAYING;
    pauseScreen.classList.add("hidden");
}

function gameOver() {
    currentState = STATES.GAMEOVER;
    hud.classList.add("hidden");
    gameoverScreen.classList.remove("hidden");
    finalScoreElement.innerText = score;
    finalCoinsElement.innerText = coins;
}

function resetToPlay() {
    score = 0;
    coins = 0;
    cameraX = 0;
    scoreElement.innerText = "0";
    coinsElement.innerText = "0";
    
    player.x = canvas.width * 0.2;
    player.y = canvas.height * 0.4;
    player.vx = 5.5;
    player.vy = 0;
    player.isGrappled = false;
    player.pivot = null;
    player.trail = [];

    anchors = [];
    collectibles = [];
    obstacles = [];

    // প্রাথমিক বিশ্ব তৈরি
    for (let i = 0; i < 5; i++) {
        generateWorldSegment(canvas.width * 0.4 + (i * 280));
    }

    pauseScreen.classList.add("hidden");
    gameoverScreen.classList.add("hidden");
    hud.classList.remove("hidden");
    currentState = STATES.PLAYING;
}

// প্রসিডিউরাল জেনারেশন (হুক, কয়েন এবং বাধা এক সাথে তৈরি)
function generateWorldSegment(startX) {
    let anchorY = Math.random() * (canvas.height * 0.35) + 60;
    anchors.push({ x: startX, y: anchorY });

    // কয়েন জেনারেশন (হুকের নিচে চমৎকার আর্কে থাকবে)
    if (Math.random() > 0.3) {
        let coinCount = 3;
        for(let j=0; j<coinCount; j++) {
            collectibles.push({
                x: startX + 60 + (j * 35),
                y: anchorY + 120 + Math.sin(j) * 20,
                radius: 6, collected: false
            });
        }
    }

    // লেজার বোমা/বাধা জেনারেশন (গেইমপ্লেকে কঠিন করার জন্য)
    if (score > 100 && Math.random() > 0.5) {
        obstacles.push({
            x: startX + 140,
            y: anchorY + 180 + (Math.random() * 80),
            radius: 14
        });
    }
}

// ফিজিক্স এবং পজিশন আপডেট
function update() {
    if (currentState !== STATES.PLAYING) return;

    // মোশন ট্রেইল লজিক
    player.trail.push({ x: player.x, y: player.y });
    if (player.trail.length > 12) player.trail.shift();

    if (!player.isGrappled) {
        player.vy += gravity;
        player.x += player.vx;
        player.y += player.vy;
    } else {
        let angularAcceleration = (-angularGravity / player.ropeLength) * Math.cos(player.angle);
        player.angularVelocity += angularAcceleration;
        player.angularVelocity *= 0.992; // ড্যাম্পিং
        player.angle += player.angularVelocity;

        player.x = player.pivot.x + player.ropeLength * Math.cos(player.angle);
        player.y = player.pivot.y + player.ropeLength * Math.sin(player.angle);
    }

    // ক্যামেরা ফলো ট্রিক
    let targetCameraX = canvas.width * 0.25;
    if (player.x - cameraX > targetCameraX) {
        let diff = (player.x - cameraX) - targetCameraX;
        cameraX += diff;
        score += Math.floor(diff * 0.08);
        scoreElement.innerText = score;
    }

    // কয়েন কালেকশন ডিটেকশন
    for (let coin of collectibles) {
        if (!coin.collected && Math.hypot(player.x - coin.x, player.y - coin.y) < player.radius + coin.radius) {
            coin.collected = true;
            coins++;
            coinsElement.innerText = coins;
        }
    }

    // বাধা/বোমা কলিশন ডিটেকশন (ধাক্কা লাগলে মৃত্যু)
    for (let obs of obstacles) {
        if (Math.hypot(player.x - obs.x, player.y - obs.y) < player.radius + obs.radius) {
            gameOver();
            return;
        }
    }

    // ইনফিনিট ম্যাপ হ্যান্ডলিং ও মেমোরি ক্লিনিং
    if (anchors[0] && anchors[0].x < cameraX - 100) {
        anchors.shift();
        let lastAnchor = anchors[anchors.length - 1];
        let nextX = lastAnchor.x + 260 + Math.random() * 100;
        generateWorldSegment(nextX);
    }

    // স্ক্রিনের বাইরে ময়লা পরিষ্কার (অপ্টিমাইজেশন)
    collectibles = collectibles.filter(c => !c.collected && c.x > cameraX - 100);
    obstacles = obstacles.filter(o => o.x > cameraX - 100);

    // মৃত্যু শর্ত (নিচে পড়ে গেলে বা বেশি উপরে উঠলে)
    if (player.y > canvas.height + 50 || player.y < -200) {
        gameOver();
    }
}

// ক্যানভাস রেন্ডারিং গ্রাফিক্স
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-cameraX, 0);

    // ১. হুক পয়েন্ট ড্রইং
    for (let anchor of anchors) {
        ctx.beginPath();
        ctx.arc(anchor.x, anchor.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = "#ff00ff";
        ctx.shadowBlur = 15;
        ctx.shadowColor = "#ff00ff";
        ctx.fill();
    }

    // ২. ক্রিস্টাল কয়েন ড্রইং
    for (let coin of collectibles) {
        ctx.beginPath();
        ctx.arc(coin.x, coin.y, coin.radius, 0, Math.PI * 2);
        ctx.fillStyle = "#ffff00";
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#ffff00";
        ctx.fill();
    }

    // ৩. ক্ষতিকারক লেজার বোমা ড্রইং
    for (let obs of obstacles) {
        ctx.beginPath();
        ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI * 2);
        ctx.fillStyle = "#ff3333";
        ctx.shadowBlur = 18;
        ctx.shadowColor = "#ff3333";
        ctx.fill();
    }

    // ৪. এনার্জি রোপ (দড়ি) ড্রইং
    if (player.isGrappled && player.pivot) {
        ctx.beginPath();
        ctx.moveTo(player.pivot.x, player.pivot.y);
        ctx.lineTo(player.x, player.y);
        ctx.strokeStyle = "rgba(0, 255, 255, 0.85)";
        ctx.lineWidth = 3;
        ctx.shadowBlur = 12;
        ctx.shadowColor = "#00ffff";
        ctx.stroke();
    }

    // ৫. প্লেয়ার মোশন ট্রেইল ড্রইং
    if (player.trail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(player.trail[0].x, player.trail[0].y);
        for (let pt of player.trail) ctx.lineTo(pt.x, pt.y);
        ctx.strokeStyle = "rgba(0, 255, 255, 0.25)";
        ctx.lineWidth = player.radius * 1.5;
        ctx.lineCap = "round";
        ctx.stroke();
    }

    // ৬. আসল প্লেয়ার ক্যারেক্টার ড্রইং
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.shadowBlur = 20;
    ctx.shadowColor = "#00ffff";
    ctx.fill();

    ctx.restore();
}

// নির্বিঘ্ন গেইম লুপ
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// খেলা শুরু করুন
gameLoop();
