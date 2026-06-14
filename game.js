const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreElement = document.getElementById("score");

// ক্যানভাস সাইজ রেসপনসিভ করা
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// গেইমের মূল ভ্যারিয়েবল
let score = 0;
let cameraX = 0;
const gravity = 0.5; // রৈখিক অভিকর্ষ (ফ্রি ফলের জন্য)
const angularGravity = 0.8; // কৌণিক অভিকর্ষ (দুলনের জন্য)

// প্লেয়ার অবজেক্ট
const player = {
    x: canvas.width * 0.2,
    y: canvas.height / 2,
    vx: 6,
    vy: 0,
    radius: 12,
    isGrappled: false,
    pivot: null,
    ropeLength: 0,
    angle: 0,
    angularVelocity: 0,
    trail: [] // মোশন ট্রেইলের জন্য
};

// হুক পয়েন্টগুলোর অ্যারে
let anchors = [];

// প্রাথমিক কিছু হুক তৈরি করা
function initAnchors() {
    anchors = [];
    for (let i = 0; i < 5; i++) {
        anchors.push({
            x: canvas.width * 0.4 + (i * 300),
            y: Math.random() * (canvas.height * 0.4) + 50
        });
    }
}
initAnchors();

// ইনপুট হ্যান্ডলিং (মাউস এবং টাচ)
window.addEventListener("mousedown", startGrapple);
window.addEventListener("touchstart", startGrapple);
window.addEventListener("mouseup", releaseGrapple);
window.addEventListener("touchend", releaseGrapple);

function startGrapple() {
    if (player.isGrappled) return;

    // কাছের এবং সামনের হুক খোঁজা (Smart Selection)
    let bestAnchor = null;
    let minDistance = 500; // সর্বোচ্চ ৫০০ পিক্সেল দূরের হুক ধরবে

    for (let anchor of anchors) {
        // হুকটি ক্যারেক্টারের সামনে থাকতে হবে
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

        // বর্তমান অবস্থান থেকে অ্যাঙ্গেল বের করা
        player.angle = Math.atan2(player.y - player.pivot.y, player.x - player.pivot.x);

        // প্লেয়ারের লিনিয়ার ভেলোসিটিকে (vx, vy) অ্যাঙ্গুলার ভেলোসিটিতে কনভার্ট করা
        // ট্যাঞ্জেন্ট ভেক্টর: (-sin, cos)
        let dotProduct = (player.vx * -Math.sin(player.angle)) + (player.vy * Math.cos(player.angle));
        player.angularVelocity = dotProduct / player.ropeLength;
    }
}

function releaseGrapple() {
    if (!player.isGrappled) return;

    // দড়ি ছাড়ার সময় কৌণিক বেগকে লিনিয়ার বেগে রূপান্তর (Momentum Release)
    player.vx = -Math.sin(player.angle) * player.angularVelocity * player.ropeLength;
    player.vy = Math.cos(player.angle) * player.angularVelocity * player.ropeLength;

    // গতি যেন খুব বেশি বা কম না হয় তার একটা লিমিট দেওয়া
    player.vx = Math.max(4, Math.min(player.vx, 15)); 
    
    player.isGrappled = false;
    player.pivot = null;
}

function update() {
    // ট্রেইল আপডেট করা (পেছনে দাগ তৈরি করার জন্য)
    player.trail.push({ x: player.x, y: player.y });
    if (player.trail.length > 15) player.trail.shift();

    if (!player.isGrappled) {
        // বাতাসে ভাসমান অবস্থা (Free Fall)
        player.vy += gravity;
        player.x += player.vx;
        player.y += player.vy;
    } else {
        // পেন্ডুলাম ফিজিক্স (Swinging)
        // Cosine ব্যবহার করা হয়েছে কারণ Math.atan2 এর 0 ডিগ্রি মানে ডান দিক
        let angularAcceleration = (-angularGravity / player.ropeLength) * Math.cos(player.angle);
        player.angularVelocity += angularAcceleration;
        player.angularVelocity *= 0.99; // বাতাসের ঘর্ষণ (Damping)
        player.angle += player.angularVelocity;

        // নতুন পজিশন সেট করা
        player.x = player.pivot.x + player.ropeLength * Math.cos(player.angle);
        player.y = player.pivot.y + player.ropeLength * Math.sin(player.angle);
    }

    // ক্যামেরা স্ক্রোলিং লজিক (প্লেয়ার স্ক্রিনের নির্দিষ্ট জায়গায় আসলে ক্যামেরা এগোবে)
    let screenTargetX = canvas.width * 0.3;
    if (player.x - cameraX > screenTargetX) {
        let diff = (player.x - cameraX) - screenTargetX;
        cameraX += diff; // ক্যামেরা সামনে আগানো
        
        // স্কোর আপডেট
        score += Math.floor(diff * 0.1);
        scoreElement.innerText = score;
    }

    // স্ক্রিনের পেছনের হুকগুলো ডিলিট করা এবং সামনে নতুন হুক তৈরি করা
    if (anchors[0] && anchors[0].x < cameraX - 100) {
        anchors.shift();
        let lastAnchor = anchors[anchors.length - 1];
        // স্কোরের ওপর ভিত্তি করে হুকের দূরত্ব বাড়বে (কাঠিন্য লেভেল)
        let gapX = 250 + Math.random() * 150 + (score * 0.2); 
        let newY = Math.random() * (canvas.height * 0.6) + 50;
        anchors.push({ x: lastAnchor.x + gapX, y: newY });
    }

    // গেইম ওভার কন্ডিশন (স্ক্রিনের নিচে পড়ে গেলে)
    if (player.y > canvas.height + 100 || player.y < -150) {
        resetGame();
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    // ক্যামেরার পজিশন অনুযায়ী পুরো ক্যানভাসকে শিফট করা
    ctx.translate(-cameraX, 0);

    // ১. হুক পয়েন্ট ড্র করা
    for (let anchor of anchors) {
        ctx.beginPath();
        ctx.arc(anchor.x, anchor.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = "#ff00ff";
        ctx.shadowBlur = 15;
        ctx.shadowColor = "#ff00ff";
        ctx.fill();
        ctx.closePath();

        // হুকের ভেতরের সাদা অংশ
        ctx.beginPath();
        ctx.arc(anchor.x, anchor.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
        ctx.fill();
        ctx.closePath();
    }

    // ২. দড়ি (Grappling Rope) ড্র করা
    if (player.isGrappled) {
        ctx.beginPath();
        ctx.moveTo(player.pivot.x, player.pivot.y);
        ctx.lineTo(player.x, player.y);
        ctx.strokeStyle = "rgba(0, 255, 255, 0.8)";
        ctx.lineWidth = 3;
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#00ffff";
        ctx.stroke();
        ctx.closePath();
    }

    // ৩. প্লেয়ারের মোশন ট্রেইল ড্র করা
    ctx.beginPath();
    for (let i = 0; i < player.trail.length; i++) {
        let pt = player.trail[i];
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
    }
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = player.radius;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#00ffff";
    ctx.stroke();
    ctx.closePath();

    // ৪. প্লেয়ার ড্র করা
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.shadowBlur = 20;
    ctx.shadowColor = "#00ffff";
    ctx.fill();
    ctx.closePath();

    ctx.restore();
}

function resetGame() {
    player.x = canvas.width * 0.2;
    player.y = canvas.height / 2;
    player.vx = 6;
    player.vy = 0;
    player.isGrappled = false;
    player.trail = [];
    cameraX = 0;
    score = 0;
    scoreElement.innerText = score;
    initAnchors();
}

// মেইন গেইম লুপ
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// গেইম স্টার্ট
gameLoop();